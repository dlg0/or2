import http from "http";
import express from "express";
import { Server, Room } from "colyseus";

class WorldRoom extends Room {
  maxClients = 100;

  onCreate() {
    // Minimal state; expand with schema later
    this.setState({ players: {} as Record<string, { x: number; y: number; color: string; stage: number; points: number }> });
    this.setSimulationInterval(() => this.update(), 1000 / 15);
  }

  onJoin(client: any) {
    this.state.players[client.sessionId] = { x: 0, y: 0, color: randomColor(), stage: 0, points: 0 };
  }

  onMessage(client: any, message: any) {
    const p = this.state.players[client.sessionId];
    if (!p) return;
    if (message.type === "move") {
      const { dx, dy } = message;
      p.x += clamp(dx, -1, 1) * 3;
      p.y += clamp(dy, -1, 1) * 3;
    }
  }

  onLeave(client: any) {
    delete this.state.players[client.sessionId];
  }

  update() {
    // Tick loop placeholder
  }
}

const app = express();
const server = http.createServer(app);
const game = new Server({ server });
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

