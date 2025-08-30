"use client";

import { useEffect, useRef, useState } from "react";

type Vec = { x: number; y: number };

export default function HomePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [pos, setPos] = useState<Vec>({ x: 0, y: 0 });
  const [camera, setCamera] = useState<Vec>({ x: 0, y: 0 });
  const [color, setColor] = useState<string>(randomColor());

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

      // draw player (simple circle)
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
  }, [pos, color, camera.x, camera.y]);

  useEffect(() => {
    const pressed = new Set<string>();
    const onDown = (e: KeyboardEvent) => pressed.add(e.key);
    const onUp = (e: KeyboardEvent) => pressed.delete(e.key);
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    const id = setInterval(() => {
      const speed = 3;
      setPos((p) => ({
        x: p.x + (pressed.has("ArrowRight") || pressed.has("d") ? speed : 0) - (pressed.has("ArrowLeft") || pressed.has("a") ? speed : 0),
        y: p.y + (pressed.has("ArrowDown") || pressed.has("s") ? speed : 0) - (pressed.has("ArrowUp") || pressed.has("w") ? speed : 0)
      }));
    }, 16);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  return (
    <main>
      <canvas ref={canvasRef} style={{ display: "block", width: "100vw", height: "100vh" }} />
    </main>
  );
}

function randomColor() {
  const colors = ["#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f"];
  return colors[Math.floor(Math.random() * colors.length)];
}

