"use client";

import { useEffect, useRef, useState } from "react";
import { Client, Room } from "colyseus.js";
// import { MoveInput } from "@openworld/shared"; // optional typing

type Vec = { x: number; y: number };

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState<Vec>({ x: 0, y: 0 });
  const [camera, setCamera] = useState<Vec>({ x: 0, y: 0 });
  const [color, setColor] = useState<string>(randomColor());
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Record<string, { x: number; y: number; color: string; stage: number; points: number }>>({});
  const [status, setStatus] = useState<string>("disconnected");
  const [selfId, setSelfId] = useState<string | null>(null);
  const selfColorSet = useRef(false);
  const lastDxDy = useRef({ dx: 0, dy: 0 });

  // Connect to Colyseus server with simple reconnect loop
  useEffect(() => {
    let disposed = false;
    const url = process.env.NEXT_PUBLIC_SERVER_URL || "ws://localhost:2567";
    const client = new Client(url.replace(/^http/, "ws"));

    let reconnectDelay = 500;
    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      client
        .joinOrCreate("world")
        .then((joined) => {
          if (disposed) return;
          setRoom(joined);
          setStatus("connected");
          setSelfId(joined.sessionId);
          reconnectDelay = 500; // reset backoff

          joined.onStateChange((state: any) => {
            if (!state || !state.players) return;
            const copy: Record<string, { x: number; y: number; color: string; stage: number; points: number }> = {};
            if (typeof state.players.forEach === "function") {
              state.players.forEach((p: any, id: string) => {
                copy[id] = { x: p.x, y: p.y, color: p.color, stage: p.stage, points: p.points };
              });
            } else {
              for (const id in state.players) {
                const p = state.players[id];
                copy[id] = { x: p.x, y: p.y, color: p.color, stage: p.stage, points: p.points };
              }
            }
            setPlayers(copy);
            const sid = joined.sessionId;
            if (sid && copy[sid] && !selfColorSet.current) {
              setColor(copy[sid].color); // set color once from server
              selfColorSet.current = true;
            }
          });
          joined.onLeave(() => {
            setStatus("disconnected");
            setTimeout(connect, reconnectDelay);
            reconnectDelay = Math.min(reconnectDelay * 2, 5000);
          });
        })
        .catch((err) => {
          console.error("Failed to connect:", err);
          setStatus("error");
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 5000);
        });
    };

    connect();

    return () => {
      disposed = true;
      try {
        room?.leave();
      } catch {}
    };
  }, []);

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
      // sloppy-scroll camera towards player
      const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
      setCamera((cam) => ({ x: lerp(cam.x, pos.x, 0.1), y: lerp(cam.y, pos.y, 0.1) }));

      // draw background grid
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

      // draw other players from server state
      for (const id in players) {
        if (id === selfId) continue;
        const pl = players[id];
        const px = Math.floor(pl.x - camera.x + c.width / 2);
        const py = Math.floor(pl.y - camera.y + c.height / 2);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = pl.color;
        ctx.beginPath();
        ctx.arc(px, py, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      
      // draw self using local position
      const px = Math.floor(pos.x - camera.x + c.width / 2);
      const py = Math.floor(pos.y - camera.y + c.height / 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [pos, color, camera.x, camera.y, players, selfId]);

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
      const speed = 3;
      let dx = 0;
      let dy = 0;
      if (pressed.has("ArrowRight") || pressed.has("d")) dx += 1;
      if (pressed.has("ArrowLeft") || pressed.has("a")) dx -= 1;
      if (pressed.has("ArrowDown") || pressed.has("s")) dy += 1;
      if (pressed.has("ArrowUp") || pressed.has("w")) dy -= 1;
      lastDxDy.current = { dx, dy };
      if (dx !== 0 || dy !== 0) {
        setPos((p) => ({ x: p.x + dx * speed, y: p.y + dy * speed }));
      }
    }, 16); // smooth local movement

    const sendServer = setInterval(() => {
      try {
        const { dx, dy } = lastDxDy.current;
        room?.send({ type: "move", dx, dy });
      } catch {}
    }, 50); // 20 Hz network

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
        status: {status} • players: {Object.keys(players).length}
      </div>
    </main>
  );
}

function randomColor() {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f"];
  return colors[Math.floor(Math.random() * colors.length)];
}
