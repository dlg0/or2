"use client";

import { useEffect, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
import { getUpgradeById } from "@openworld/shared";

type Vec = { x: number; y: number };
type PlayerClient = { x: number; y: number; color: string; stage: number; points: number; role?: "kid" | "parent"; upgrades?: string[] };

export default function PlayPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [camera, setCamera] = useState<Vec>({ x: 0, y: 0 });
  const [color, setColor] = useState<string>(randomColor());
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, PlayerClient>>({});
  const [items, setItems] = useState<Array<{ id: string; x: number; y: number; upgradeId: string }>>([]);
  const [status, setStatus] = useState<string>("disconnected");
  const [selfId, setSelfId] = useState<string | null>(null);
  const selfColorSet = useRef(false);
  const lastDxDy = useRef({ dx: 0, dy: 0 });
  const connectedRef = useRef(false);
  const [serverUrl] = useState<string>(process.env.NEXT_PUBLIC_SERVER_URL || "ws://localhost:2567");
  const trailsRef = useRef<Record<string, Array<{ x: number; y: number }>>>({});

  // Live debug/progress state
  const [dbg, setDbg] = useState<{ 
    token?: string | null;
    tokenKid?: string | null;
    tokenExpIso?: string | null;
    tokenValid?: boolean;
    tokenFetchOk?: boolean;
    serverHealth?: any;
    connectAttempt?: number;
    connectOk?: boolean;
    connectError?: { code?: number; message?: string } | null;
    authAccepted?: boolean | null; // null: unknown; false: rejected; true: accepted
    roomStateSeen?: boolean;
    docCookie?: string;
  }>({ connectAttempt: 0, authAccepted: null, roomStateSeen: false });

  useEffect(() => {
    let kidToken: string | null = null;
    let connectAttempt = 0;
    const fetchToken = async () => {
      try {
        console.info("[play] fetching kid token...");
        const res = await fetch("/api/kid/token");
        if (res.ok) {
          const j = await res.json();
          kidToken = j.token;
          try {
            const [data, sig] = (kidToken || "").split(".");
            const b64 = (data || "").replace(/-/g, "+").replace(/_/g, "/");
            const pad = b64 + "===".slice((b64.length + 3) % 4);
            const payload = JSON.parse(atob(pad));
            const exp = payload?.exp ? new Date(payload.exp * 1000).toISOString() : "n/a";
            const valid = !!payload?.exp && Date.now() < payload.exp * 1000;
            setDbg((d) => ({ ...d, token: kidToken, tokenKid: payload?.kid || null, tokenExpIso: exp, tokenValid: valid, tokenFetchOk: true }));
            console.info("[play] kid token fetched", {
              hasToken: !!kidToken,
              tokenSigFp: (sig || "").slice(0, 8),
              kid: payload?.kid,
              exp,
            });
          } catch (e) {
            console.warn("[play] could not parse token payload", e);
            setDbg((d) => ({ ...d, token: kidToken, tokenKid: null, tokenExpIso: null, tokenValid: false, tokenFetchOk: true }));
          }
        } else {
          console.warn("[play] kid token fetch failed", { status: res.status });
          setDbg((d) => ({ ...d, tokenFetchOk: false }));
        }
      } catch (e) {
        console.warn("[play] kid token fetch threw", e);
        setDbg((d) => ({ ...d, tokenFetchOk: false }));
      }
    };
    const fetchParentTokenIfNeeded = async () => {
      if (kidToken) return; // prefer kid token
      try {
        console.info("[play] fetching parent token...");
        const res = await fetch("/api/parent/token");
        if (res.ok) {
          const j = await res.json();
          kidToken = null;
          setDbg((d) => ({ ...d, tokenFetchOk: true }));
          // Reuse kidToken slot as generic token holder, but send as parentToken in opts
          (fetchParentTokenIfNeeded as any)._parentToken = j.token;
          console.info("[play] parent token fetched");
        } else {
          console.info("[play] parent token not available (not signed in?)");
        }
      } catch (e) {
        console.warn("[play] parent token fetch threw", e);
      }
    };
    // Kick off server health probe (via Next API to avoid CORS) for debugging
    fetch("/api/server/health")
      .then((r) => r.json())
      .then((j) => {
        console.info("[play] server health", j);
        setDbg((d) => ({ ...d, serverHealth: j }));
      })
      .catch((e) => console.warn("[play] server health failed", e));

    fetchToken().then(fetchParentTokenIfNeeded).then(() => connect());
    let disposed = false;
    const retryTimer = { id: 0 as any };
    const client = new Client(serverUrl.replace(/^http/, "ws"));

    let reconnectDelay = 500;
    const connect = () => {
      if (disposed || connectedRef.current) return;
      setStatus("connecting");
      const opts: any = {};
      if (kidToken) opts.kidToken = kidToken;
      const parentToken = (fetchToken as any)._parentToken || (fetchParentTokenIfNeeded as any)?._parentToken;
      if (!kidToken && parentToken) opts.parentToken = parentToken;
      connectAttempt += 1;
      console.info("[play] connect attempt", {
        attempt: connectAttempt,
        serverUrl: serverUrl.replace(/^ws:\/\//, ""),
        hasKidToken: !!kidToken,
        now: new Date().toISOString(),
      });
      setDbg((d) => ({ ...d, connectAttempt, connectOk: false, connectError: null }));
      // Log cookies visible to JS (httpOnly cookies will not appear here)
      try { console.info("[play] document.cookie", document.cookie); } catch {}
      try { setDbg((d) => ({ ...d, docCookie: document.cookie })); } catch {}

      client
        .joinOrCreate("world", opts)
        .then((joined) => {
          if (disposed) return;
          connectedRef.current = true;
          setRoom(joined);
          setStatus("connected");
          setSelfId(joined.sessionId);
          console.info("[play] joined room", {
            roomId: joined.roomId,
            sessionId: joined.sessionId,
          });
          setDbg((d) => ({ ...d, connectOk: true, authAccepted: true }));
          reconnectDelay = 500;

          joined.onStateChange((state: any) => {
            if (!state || !state.players) return;
            const copy: Record<string, PlayerClient> = {};
            if (typeof state.players.forEach === "function") {
              state.players.forEach((p: any, id: string) => {
                const ups: string[] = [];
                try {
                  if (Array.isArray(p.upgrades)) {
                    for (const u of p.upgrades) ups.push(String(u));
                  } else if (p.upgrades && typeof p.upgrades.forEach === "function") {
                    p.upgrades.forEach((u: any) => ups.push(String(u)));
                  }
                } catch {}
                copy[id] = { x: p.x, y: p.y, color: p.color, stage: p.stage, points: p.points, role: p.role, upgrades: ups };
              });
            } else {
              for (const id in state.players) {
                const p = state.players[id];
                const ups: string[] = [];
                try {
                  if (Array.isArray((p as any).upgrades)) {
                    for (const u of (p as any).upgrades) ups.push(String(u));
                  } else if ((p as any).upgrades && typeof (p as any).upgrades.forEach === "function") {
                    (p as any).upgrades.forEach((u: any) => ups.push(String(u)));
                  }
                } catch {}
                copy[id] = { x: (p as any).x, y: (p as any).y, color: (p as any).color, stage: (p as any).stage, points: (p as any).points, role: (p as any).role, upgrades: ups };
              }
            }
            setPlayers(copy);
            // items
            const itemsCopy: Array<{ id: string; x: number; y: number; upgradeId: string }> = [];
            try {
              if (state.items && typeof state.items.forEach === "function") {
                state.items.forEach((it: any) => itemsCopy.push({ id: String(it.id), x: it.x, y: it.y, upgradeId: String(it.upgradeId) }));
              } else if (Array.isArray(state.items)) {
                for (const it of state.items) itemsCopy.push({ id: String((it as any).id), x: (it as any).x, y: (it as any).y, upgradeId: String((it as any).upgradeId) });
              }
            } catch {}
            setItems(itemsCopy);
            setDbg((d) => (d?.roomStateSeen ? d : { ...d, roomStateSeen: true }));
            const sid = joined.sessionId;
            if (sid && copy[sid] && !selfColorSet.current) {
              setColor(copy[sid].color);
              selfColorSet.current = true;
            }
          });
          joined.onError((code, message) => {
            console.error("[play] room error", { code, message, time: new Date().toISOString() });
            setDbg((d) => ({ ...d, connectError: { code, message } }));
          });
          joined.onLeave((code?: number) => {
            setStatus("disconnected");
            connectedRef.current = false;
            console.warn("[play] room left", { code, time: new Date().toISOString() });
            setDbg((d) => ({ ...d, connectOk: false }));
            clearTimeout(retryTimer.id);
            retryTimer.id = setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 5000);
          });
        })
        .catch((err) => {
          const details: any = {
            name: (err && (err as any).name) || undefined,
            code: (err && (err as any).code) || undefined,
            message: (err && (err as any).message) || String(err),
          };
          try {
            // some errors may have response / data
            if ((err as any)?.data) details.data = (err as any).data;
            if ((err as any)?.stack) details.stack = (err as any).stack.split("\n").slice(0, 3).join(" | ");
          } catch {}
          console.error("[play] Failed to connect", details);
          setDbg((d) => ({ ...d, connectOk: false, connectError: { code: details.code, message: details.message }, authAccepted: details.code === 4215 ? false : d.authAccepted }));
          setStatus("error");
          clearTimeout(retryTimer.id);
          retryTimer.id = setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 5000);
        });
    };

    // connect() is called after token fetch

    return () => {
      disposed = true;
      clearTimeout(retryTimer.id);
    };
  }, [serverUrl]);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;

    const onResize = () => {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);
    onResize();

    const render = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      const me = selfId ? players[selfId] : undefined;
      if (me) setCamera((cam) => ({ x: lerp(cam.x, me.x, 0.1), y: lerp(cam.y, me.y, 0.1) }));

      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1;
      for (let gx = -1000; gx < 1000; gx += 64) {
        const sx = Math.floor(gx - camera.x + c.width / 2);
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, c.height);
        ctx.stroke();
      }
      for (let gy = -1000; gy < 1000; gy += 64) {
        const sy = Math.floor(gy - camera.y + c.height / 2);
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(c.width, sy);
        ctx.stroke();
      }

      // Draw items (upgrade pickups)
      for (const it of items) {
        const px = Math.floor(it.x - camera.x + c.width / 2);
        const py = Math.floor(it.y - camera.y + c.height / 2);
        const up = getUpgradeById(it.upgradeId);
        const vis = up?.visual;
        const vcolor = (vis?.color as string) || "#f1c40f";
        if (vis?.type === "glow" || vis?.type === "aura") {
          const t = (performance.now() % 1200) / 1200;
          const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
          const r = 12 + 10 * pulse;
          ctx.save();
          ctx.globalAlpha = 0.25 + 0.35 * pulse;
          ctx.fillStyle = vcolor;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // core
        ctx.save();
        ctx.fillStyle = vcolor;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const id in players) {
        if (id === selfId) continue;
        const pl = players[id];
        const px = Math.floor(pl.x - camera.x + c.width / 2);
        const py = Math.floor(pl.y - camera.y + c.height / 2);
        // Visual: pulsing glow for upgrades with visual.type === "glow"
        if (hasGlow(pl.upgrades)) {
          const t = (performance.now() % 1200) / 1200; // 0..1
          const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
          const r = (pl.role === "parent" ? 18 : 12) + 6 * pulse;
          ctx.save();
          ctx.globalAlpha = 0.2 + 0.25 * pulse;
          ctx.fillStyle = pl.color;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
        // Trails: show for parents or if player has upgrades. Color reflects strongest upgrade visual color.
        const trail = getTrailStyle(pl);
        if (trail.hasTrail) {
          const arr = (trailsRef.current[id] ||= []);
          arr.push({ x: pl.x, y: pl.y });
          const max = Math.max(8, Math.min(40, trail.length));
          if (arr.length > max) arr.shift();
          for (let i = 0; i < arr.length; i++) {
            const t = i / arr.length;
            const ax = Math.floor(arr[i].x - camera.x + c.width / 2);
            const ay = Math.floor(arr[i].y - camera.y + c.height / 2);
            const baseA = 0.10, vary = 0.25;
            ctx.globalAlpha = Math.min(0.6, (baseA + vary * t) * trail.alphaScale);
            ctx.fillStyle = trail.color;
            ctx.beginPath();
            ctx.arc(ax, ay, trail.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pl.color;
        ctx.beginPath();
        ctx.arc(px, py, pl.role === "parent" ? 14 : 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      const meSelf: PlayerClient | undefined = selfId ? players[selfId] : undefined;
      const px = Math.floor((meSelf ? meSelf.x : 0) - camera.x + c.width / 2);
      const py = Math.floor((meSelf ? meSelf.y : 0) - camera.y + c.height / 2);
      if (meSelf) {
        const trail = getTrailStyle(meSelf);
        if (trail.hasTrail) {
          const arr = (trailsRef.current[selfId!] ||= []);
          arr.push({ x: meSelf.x, y: meSelf.y });
          const max = Math.max(8, Math.min(40, trail.length));
          if (arr.length > max) arr.shift();
          for (let i = 0; i < arr.length; i++) {
            const t = i / arr.length;
            const ax = Math.floor(arr[i].x - camera.x + c.width / 2);
            const ay = Math.floor(arr[i].y - camera.y + c.height / 2);
            const baseA = 0.10, vary = 0.25;
            ctx.globalAlpha = Math.min(0.6, (baseA + vary * t) * trail.alphaScale);
            ctx.fillStyle = trail.color;
            ctx.beginPath();
            ctx.arc(ax, ay, trail.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      ctx.globalAlpha = 1;
      // Visual: pulsing glow around self if present
      if (hasGlow(meSelf?.upgrades)) {
        const t = (performance.now() % 1200) / 1200; // 0..1
        const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2);
        const baseR = meSelf && meSelf.role === "parent" ? 18 : 12;
        const r = baseR + 8 * pulse;
        ctx.save();
        ctx.globalAlpha = 0.25 + 0.25 * pulse;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, meSelf && meSelf.role === "parent" ? 16 : 10, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [color, camera.x, camera.y, players, selfId, items]);

  useEffect(() => {
    const pressed = new Set<string>();
    const onDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      pressed.add(e.key);
    };
    const onUp = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      pressed.delete(e.key);
    };
    window.addEventListener("keydown", onDown, { passive: false } as any);
    window.addEventListener("keyup", onUp, { passive: false } as any);

    const moveLocal = setInterval(() => {
      let dx = 0;
      let dy = 0;
      if (pressed.has("ArrowRight") || pressed.has("d")) dx += 1;
      if (pressed.has("ArrowLeft") || pressed.has("a")) dx -= 1;
      if (pressed.has("ArrowDown") || pressed.has("s")) dy += 1;
      if (pressed.has("ArrowUp") || pressed.has("w")) dy -= 1;
      lastDxDy.current = { dx, dy };
    }, 16);

    const sendServer = setInterval(() => {
      try {
        const { dx, dy } = lastDxDy.current;
        room?.send("move", { dx, dy });
      } catch {}
    }, 16);

    return () => {
      clearInterval(moveLocal);
      clearInterval(sendServer);
      window.removeEventListener("keydown", onDown as any);
      window.removeEventListener("keyup", onUp as any);
    };
  }, [room]);

  return (
    <main>
      <canvas ref={canvasRef} style={{ display: "block", width: "100vw", height: "100vh" }} />
      <div style={{ position: "fixed", top: 8, left: 8, color: "#aaa", fontFamily: "monospace", fontSize: 12 }}>
        status: {status} • players: {Object.keys(players).length} • url: {serverUrl.replace(/^ws:\/\//, '')} {room ? `• room: ${room.roomId.slice(-4)} • id: ${room.sessionId.slice(-4)}` : ''}
      </div>
      {/* Debug/progress checklist */}
      <div style={{ position: "fixed", top: 8, right: 8, color: "#ddd", fontFamily: "monospace", fontSize: 12, background: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 6, maxWidth: 700, width: "min(80vw, 700px)", whiteSpace: "pre-wrap", lineHeight: 1.35 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Play Setup</div>
        {renderStep("1. Kid session cookie", dbg.tokenFetchOk === true, dbg.tokenFetchOk === false, dbg.docCookie || "")}
        {renderStep("2. Token fetched", !!dbg.token, dbg.tokenFetchOk === false, dbg.tokenKid ? `kid=${dbg.tokenKid}` : "")}
        {renderStep("3. Token valid (not expired)", dbg.tokenValid === true, dbg.tokenValid === false, dbg.tokenExpIso ? `exp=${dbg.tokenExpIso}` : "")}
        {renderStep("4. Server reachable", !!dbg.serverHealth && !!dbg.serverHealth.ok, !!dbg.serverHealth && !dbg.serverHealth.ok, dbg.serverHealth ? `fp=${dbg.serverHealth?.data?.secretFp ?? dbg.serverHealth?.secretFp}` : "")}
        {renderStep("5. Auth accepted", dbg.authAccepted === true, dbg.authAccepted === false, dbg.serverHealth?.data?.lastAuth ? `last=${dbg.serverHealth.data.lastAuth.reason}` : (dbg.serverHealth?.lastAuth ? `last=${dbg.serverHealth.lastAuth.reason}` : ""))}
        {renderStep("6. Connection attempted", (dbg.connectAttempt || 0) > 0, false, `#${dbg.connectAttempt || 0}`)}
        {renderStep("7. Joined room", dbg.connectOk === true, dbg.connectError != null, dbg.connectError ? `${dbg.connectError.code}: ${dbg.connectError.message}` : (room ? `id=${room.roomId.slice(-4)}` : ""))}
        {renderStep("8. State received", dbg.roomStateSeen === true, false, Object.keys(players).length ? `${Object.keys(players).length} players` : "")}
      </div>
    </main>
  );
}

function randomColor() {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function renderStep(label: string, ok: boolean, fail: boolean, detail?: string) {
  let icon = "…";
  if (ok) icon = "✓";
  else if (fail) icon = "✗";
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }} key={label}>
      <span style={{ width: 12, color: ok ? "#2ecc71" : (fail ? "#e74c3c" : "#f1c40f") }}>{icon}</span>
      <span style={{ flexShrink: 0 }}>{label}</span>
      {detail ? <span style={{ color: "#999", overflowWrap: "anywhere", flex: 1 }}> • {detail}</span> : null}
    </div>
  );
}

function hasGlow(upgrades?: string[]) {
  if (!upgrades || upgrades.length === 0) return false;
  for (const id of upgrades) {
    const up = getUpgradeById(id);
    if (up && up.visual.type === "glow") return true;
  }
  return false;
}

function getTrailStyle(pl: PlayerClient): { hasTrail: boolean; color: string; length: number; radius: number; alphaScale: number } {
  const hasTrail = pl.role === "parent" || !!(pl.upgrades && pl.upgrades.length);
  let color = pl.color;
  const baseLen = pl.role === "parent" ? 24 : 16;
  const baseRadius = pl.role === "parent" ? 12 : 10;
  let bestVisual: ReturnType<typeof getUpgradeById> | null = null;
  let speedBonus = 0;
  if (pl.upgrades && pl.upgrades.length) {
    for (const id of pl.upgrades) {
      const up = getUpgradeById(id);
      if (!up) continue;
      if (up.power?.type === "speed") speedBonus = Math.max(speedBonus, Number(up.power.value) || 0);
      if (!bestVisual || (Number(up.power?.value) || 0) > (Number(bestVisual.power?.value) || 0)) bestVisual = up;
    }
  }
  if (bestVisual && bestVisual.visual?.color) color = bestVisual.visual.color as string;
  const length = baseLen + Math.round(speedBonus * 20);
  const radius = baseRadius + Math.round(speedBonus * 6);
  const alphaScale = Math.max(0.7, Math.min(2, 1 + speedBonus));
  return { hasTrail, color, length, radius, alphaScale };
}
