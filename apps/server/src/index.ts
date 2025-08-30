import http from "http";
import express from "express";
import fs from "fs";
import { Server, Room } from "colyseus";
import { MoveInput } from "@openworld/shared";
import { Schema, MapSchema, type } from "@colyseus/schema";
import { getDb } from "@db/client";
import { childProfiles, families } from "@db/schema";
import { eq } from "drizzle-orm";
import cookie from "cookie";

class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: string = randomColor();
  @type("number") stage: number = 0;
  @type("number") points: number = 0;
}

class WorldState extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();
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

class WorldRoom extends Room {
  maxClients = 100;

  async onAuth(client: any, options: any, request: any) {
    try {
      const headers = request?.headers || {};
      const cookieHeader = headers.cookie || headers.Cookie;
      const requireKid = process.env.REQUIRE_KID_AUTH === "1";
      if (!cookieHeader) return !requireKid; // allow if not required
      const jar = cookie.parse(cookieHeader);
      if (jar.kid_id) {
        const db = getDb();
        const kidId = jar.kid_id as string;
        const rows = await db.select().from(childProfiles).where(eq(childProfiles.id, kidId)).limit(1);
        if (rows.length === 0) return false;
        // Optional: verify family's status as well
        const famRows = await db.select().from(families).where(eq(families.id, rows[0].familyId)).limit(1);
        const famOk = famRows.length > 0 && (famRows[0] as any).status !== "blocked"; // simple gate
        return rows[0].status === "approved" && famOk;
      }
      return !requireKid; // allow if not required
    } catch {
      return false;
    }
  }

  onCreate() {
    this.setState(new WorldState());
    const TICK_HZ = Number(process.env.TICK_HZ || 60);
    this.setSimulationInterval(() => this.update(), 1000 / TICK_HZ);
    flog(`room:create id=${this.roomId}`);

    this.onMessage("move", (client, message: any) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const parsed = MoveInput.partial({ seq: true, keys: true }).safeParse(message);
      if (!parsed.success) return;
      const { dx, dy } = parsed.data;
      p.x += clamp(dx ?? 0, -1, 1) * 3;
      p.y += clamp(dy ?? 0, -1, 1) * 3;
    });
  }

  onJoin(client: any) {
    const p = new Player();
    p.x = 0;
    p.y = 0;
    p.color = randomColor();
    this.state.players.set(client.sessionId, p);
    flog(`room:join room=${this.roomId} session=${client.sessionId} clients=${this.clients.length}`);
  }

  onLeave(client: any) {
    this.state.players.delete(client.sessionId);
    flog(`room:leave room=${this.roomId} session=${client.sessionId} clients=${this.clients.length}`);
  }

  update() {
    // Tick loop placeholder
  }
}

const app = express();
const server = http.createServer(app);
const game = new Server({ server });

app.get("/health", (_req, res) => {
  res.json({ ok: true, pid: process.pid, time: new Date().toISOString() });
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
