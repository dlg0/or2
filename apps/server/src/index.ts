import http from "http";
import express from "express";
import fs from "fs";
import path from "path";
import { Server, Room } from "colyseus";
import { MoveInput, speedMultiplierFromUpgrades, getUpgradeById, UPGRADE_CATALOG } from "@openworld/shared";
import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { getDb } from "@db/client";
import { childProfiles, families } from "@db/schema";
import { eq } from "drizzle-orm";
import cookie from "cookie";
import crypto from "crypto";

class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: string = randomColor();
  @type("number") stage: number = 0;
  @type("number") points: number = 0;
  @type("string") role: string = "kid"; // "kid" | "parent"
  @type(["string"]) upgrades = new ArraySchema<string>();
}

class UpgradeItem extends Schema {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") upgradeId: string = "";
}

class WorldState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();
  @type([UpgradeItem])
  items = new ArraySchema<UpgradeItem>();
}

// Simple file logger
const logDir = `${process.cwd()}/../../logs`;
try { fs.mkdirSync(logDir, { recursive: true }); } catch {}
const serverLog = fs.createWriteStream(`${logDir}/server.log`, { flags: "a" });
function flog(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  serverLog.write(line);
  // also mirror to console for dev
  // eslint-disable-next-line no-console
  console.log(msg);
}

// Minimal .env loader (no dependency): ensure server picks up repo root .env when not provided
function loadRootEnvOnce() {
  try {
    // Derive repo root .env relative to apps/server
    const rootEnv = path.resolve(process.cwd(), "../../.env");
    if (!process.env.TOKEN_SECRET && fs.existsSync(rootEnv)) {
      const content = fs.readFileSync(rootEnv, "utf8");
      for (const line of content.split(/\r?\n/)) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const idx = t.indexOf("=");
        if (idx === -1) continue;
        const key = t.slice(0, idx).trim();
        let val = t.slice(idx + 1).trim();
        // strip surrounding quotes
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!(key in process.env)) process.env[key] = val;
      }
    }
  } catch {
    // ignore
  }
}
loadRootEnvOnce();

// Boot-time validation: fail fast when TOKEN_SECRET is missing in all modes
const REQUIRE_KID = process.env.REQUIRE_KID_AUTH === "1";
if (!process.env.TOKEN_SECRET) {
  // eslint-disable-next-line no-console
  console.error("[server] FATAL: TOKEN_SECRET is not set. Configure it via environment or root .env.");
  process.exit(1);
}

// fingerprint the TOKEN_SECRET once at boot for debugging env mismatches
const TOKEN_SECRET = process.env.TOKEN_SECRET as string;
const SECRET_FP = crypto.createHash("sha256").update(TOKEN_SECRET).digest("hex").slice(0, 8);

// Preflight: log key non-sensitive configuration for quick diagnosis
function fp(str: string) {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 8);
}
function preflight() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const port = Number(process.env.PORT || 2567);
  const tick = Number(process.env.TICK_HZ || 60);
  flog(`[preflight] env node_env=${nodeEnv} require_kid=${REQUIRE_KID ? 1 : 0} port=${port} tick_hz=${tick}`);
  flog(`[preflight] auth secret.fp=${SECRET_FP}`);
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    let host = "?", db = "?";
    try { const u = new URL(dbUrl); host = u.host; db = u.pathname.replace(/^\//, "") || ""; } catch {}
    flog(`[preflight] db host=${host} db=${db} url.fp=${fp(dbUrl)}`);
  } else {
    flog(`[preflight] db missing`);
  }
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    let host = "?";
    try { const u = new URL(redisUrl); host = u.host; } catch {}
    flog(`[preflight] redis host=${host} url.fp=${fp(redisUrl)}`);
  } else {
    flog(`[preflight] redis missing`);
  }
}
preflight();

// Development-only: capture last auth decision for easier debugging
const lastAuth: { ok: boolean; reason: string; time: string } = { ok: true, reason: "", time: new Date().toISOString() };
function noteAuth(ok: boolean, reason: string) {
  lastAuth.ok = ok;
  lastAuth.reason = reason;
  lastAuth.time = new Date().toISOString();
}

class WorldRoom extends Room {
  maxClients = 100;
  private kidSessions: Map<string, { childId: string; remaining: number; lastSave: number } > = new Map();

  async onAuth(client: any, options: any, request: any) {
    try {
      const requireKid = process.env.REQUIRE_KID_AUTH === "1";
      // Verify signed parent token (Clerk-authenticated parent) or kid token
      const parentToken = options?.parentToken as string | undefined;
      if (parentToken) {
        const [data, sig] = parentToken.split(".");
        const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("hex");
        if (sig !== expected) {
          const reason = `bad_signature(parent) got=${(sig||"").slice(0,8)} exp=${expected.slice(0,8)} data.len=${data?.length ?? 0} secret.fp=${SECRET_FP}`;
          flog(`auth: ${reason}`);
          noteAuth(false, reason);
          return false;
        }
        const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64 + "===".slice((b64.length + 3) % 4);
        let payload: any;
        try { payload = JSON.parse(Buffer.from(pad, "base64").toString()); }
        catch { flog("auth: invalid payload(parent)"); noteAuth(false, "invalid_payload_parent"); return false; }
        if (!payload?.parent) { flog("auth: no parent in payload"); noteAuth(false, "no_parent"); return false; }
        if (payload.exp < Math.floor(Date.now()/1000)) { flog("auth: parent token expired"); noteAuth(false, "parent_expired"); return false; }
        // Verify the parent has a family in DB and is not blocked
        const db = getDb();
        const rows = await db.select().from(families).where(eq(families.parentUserId, payload.parent)).limit(1);
        if (rows.length === 0) { flog("auth: parent family not found"); noteAuth(false, "parent_family_not_found"); return false; }
        const fam = rows[0] as any;
        const famOk = fam.status !== "blocked";
        if (!famOk) { noteAuth(false, "family_blocked"); return false; }
        noteAuth(true, "ok_parent");
        return { role: "parent", parentId: payload.parent, familyId: fam.id };
      }

      // Verify signed kid token (preferred for kids)
      const token = options?.kidToken as string | undefined;
      if (token) {
        const [data, sig] = token.split(".");
        const expected = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest("hex");
        if (sig !== expected) {
          // Log short diagnostics to help align secrets without exposing them
          const reason = `bad_signature got=${(sig||"").slice(0,8)} exp=${expected.slice(0,8)} data.len=${data?.length ?? 0} secret.fp=${SECRET_FP}`;
          flog(`auth: ${reason}`);
          noteAuth(false, reason);
          return false;
        }
        // base64url -> base64 with padding
        const b64 = data.replace(/-/g, "+").replace(/_/g, "/");
        const pad = b64 + "===".slice((b64.length + 3) % 4);
        let payload: any;
        try { payload = JSON.parse(Buffer.from(pad, "base64").toString()); }
        catch { flog("auth: invalid payload"); noteAuth(false, "invalid_payload"); return false; }
        if (!payload?.kid) { flog("auth: no kid in payload"); noteAuth(false, "no_kid"); return false; }
        if (payload.exp < Math.floor(Date.now()/1000)) { flog("auth: token expired"); noteAuth(false, "expired"); return false; }
        const db = getDb();
        const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, payload.kid)).limit(1);
        if (rows.length === 0) { flog("auth: kid not found"); noteAuth(false, "kid_not_found"); return false; }
        const famRows = await db.select().from(families).where(eq(families.id, rows[0].familyId)).limit(1);
        const famOk = famRows.length > 0 && (famRows[0] as any).status !== "blocked";
        const ok = rows[0].status === "approved" && famOk;
        if (!ok) { flog("auth: not approved or family blocked"); noteAuth(false, "not_approved_or_family_blocked"); }
        else { noteAuth(true, "ok"); }
        return ok ? { role: "kid", childId: payload.kid } : false;
      }

      // Fallback (dev): cookie-based auth (may not work cross-origin)
      const headers = request?.headers || {};
      const cookieHeader = headers.cookie || headers.Cookie;
      if (!cookieHeader) { if (requireKid) flog("auth: no cookie"); noteAuth(!requireKid, "no_cookie"); return !requireKid; }
      const jar = cookie.parse(cookieHeader);
      if (jar.kid_id) {
        const db = getDb();
        const kidId = jar.kid_id as string;
        const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, kidId)).limit(1);
        if (rows.length === 0) { flog("auth(c): kid not found"); noteAuth(false, "cookie_kid_not_found"); return false; }
        // Optional: verify family's status as well
        const famRows = await db.select().from(families).where(eq(families.id, rows[0].familyId)).limit(1);
        const famOk = famRows.length > 0 && (famRows[0] as any).status !== "blocked"; // simple gate
        const ok = rows[0].status === "approved" && famOk;
        noteAuth(ok, ok ? "ok(cookie)" : "cookie_not_approved_or_family_blocked");
        return ok ? { role: "kid", childId: kidId } : false;
      }
      if (requireKid) flog("auth: no kid cookie");
      noteAuth(!requireKid, "no_kid_cookie");
      return !requireKid; // allow if not required
    } catch (e) {
      flog("auth: exception " + (e as any)?.message);
      noteAuth(false, "exception");
      return false;
    }
  }

  onCreate() {
    this.setState(new WorldState());
    const TICK_HZ = Number(process.env.TICK_HZ || 60);
    this.setSimulationInterval(() => this.update(), 1000 / TICK_HZ);
    flog(`room:create id=${this.roomId}`);
    this.populateUpgradeItems();

    this.onMessage("move", (client, message: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const parsed = MoveInput.partial({ seq: true, keys: true }).safeParse(message);
      if (!parsed.success) return;
      const { dx, dy } = parsed.data;
      const base = 3;
      const speedMul = speedMultiplierFromUpgrades(p.upgrades as unknown as string[]);
      p.x += clamp(dx ?? 0, -1, 1) * base * speedMul;
      p.y += clamp(dy ?? 0, -1, 1) * base * speedMul;
      this.checkItemPickup(client.sessionId, p);
    });
  }

  async onJoin(client: any, _options: any, request: any) {
    const headers = request?.headers || {};
    const cookieHeader = headers.cookie || headers.Cookie;
    let childId: string | null = null;
    if (cookieHeader) {
      const jar = cookie.parse(cookieHeader);
      if (jar.kid_id) childId = jar.kid_id as string;
    }

    const p = new Player();
    p.x = 0;
    p.y = 0;
    p.color = randomColor();
    const role = (client as any).auth?.role === "parent" ? "parent" : "kid";
    p.role = role;
    this.state.players.set(client.sessionId, p);

    if (childId) {
      try {
        const db = getDb();
        const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, childId)).limit(1);
        if (rows.length > 0) {
          const remaining = Math.max(0, (rows[0] as any).timeLeftDay ?? 0);
          this.kidSessions.set(client.sessionId, { childId, remaining, lastSave: Date.now() });
        }
      } catch (e) {
        flog(`admission: failed to load kid ${childId}: ${e}`);
      }
    }

    flog(`room:join room=${this.roomId} session=${client.sessionId} role=${p.role} clients=${this.clients.length}`);
  }

  onLeave(client: any) {
    const k = this.kidSessions.get(client.sessionId);
    if (k) {
      const db = getDb();
      db.update(childProfiles).set({ timeLeftDay: Math.max(0, Math.floor(k.remaining)) }).where(eq(childProfiles.id, k.childId)).execute().catch(()=>{});
      this.kidSessions.delete(client.sessionId);
    }
    this.state.players.delete(client.sessionId);
    flog(`room:leave room=${this.roomId} session=${client.sessionId} clients=${this.clients.length}`);
  }

  update() {
    // Decrement kid time budgets
    const now = Date.now();
    for (const client of this.clients) {
      const sess = this.kidSessions.get(client.sessionId);
      if (!sess) continue;
      // assume update() called at TICK_HZ; compute dt ms since lastSave but decrement continuously
      // We'll just decrement 1 / TICK_HZ seconds per tick
      sess.remaining -= 1 / 60; // approx seconds per 60Hz; adjust by env if needed
      if (sess.remaining <= 0) {
        try { client.leave(1000, 'time_up'); } catch {}
        sess.remaining = 0;
      }
      // persist every 5 seconds
      if (now - sess.lastSave > 5000) {
        sess.lastSave = now;
        const db = getDb();
        db.update(childProfiles).set({ timeLeftDay: Math.max(0, Math.floor(sess.remaining)) }).where(eq(childProfiles.id, sess.childId)).execute().catch(()=>{});
      }
    }
  }

  private nextItemId = 1;
  private populateUpgradeItems() {
    try {
      const ids = Object.keys(UPGRADE_CATALOG);
      const placements: Array<{ x: number; y: number; upgradeId: string }> = [];
      const radius = 200;
      let angle = 0;
      for (const upId of ids) {
        for (let i = 0; i < 2; i++) {
          const x = Math.round(Math.cos(angle) * radius + (i * 40 - 20));
          const y = Math.round(Math.sin(angle) * radius + (i * 40 - 20));
          placements.push({ x, y, upgradeId: upId });
          angle += Math.PI / (ids.length * 2);
        }
      }
      for (const pl of placements) {
        const it = new UpgradeItem();
        it.id = `i${this.nextItemId++}`;
        it.x = pl.x;
        it.y = pl.y;
        it.upgradeId = pl.upgradeId;
        (this.state.items as any).push(it);
      }
      flog(`items:spawn count=${this.state.items.length}`);
    } catch (e) {
      flog(`items:spawn error ${e}`);
    }
  }

  private checkItemPickup(sessionId: string, p: Player) {
    const items = this.state.items as ArraySchema<UpgradeItem>;
    const pickupRadius = 16;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const dx = (p.x - it.x);
      const dy = (p.y - it.y);
      if (dx * dx + dy * dy <= pickupRadius * pickupRadius) {
        const up = getUpgradeById(it.upgradeId);
        if (up) {
          const has = (p.upgrades as any).includes(up.id);
          if (!has) {
            try { (p.upgrades as any).push(up.id); } catch {}
          }
        }
        try { (items as any).splice(i, 1); } catch {}
        flog(`items:pickup session=${sessionId} upgrade=${it.upgradeId} remaining=${items.length}`);
        break;
      }
    }
  }
}

const app = express();
const server = http.createServer(app);
const game = new Server({ server });

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    pid: process.pid,
    time: new Date().toISOString(),
    secretFp: SECRET_FP,
    requireKidAuth: process.env.REQUIRE_KID_AUTH === "1",
    lastAuth,
  });
});
game.define("world", WorldRoom);

const PORT = Number(process.env.PORT || 2567);
server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on :${PORT}`);
});

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function randomColor() {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f"];
  return colors[Math.floor(Math.random() * colors.length)];
}
