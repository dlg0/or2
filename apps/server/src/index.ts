import http from "http";
import express from "express";
import { Server, Room } from "colyseus";
import { MoveInput } from "@openworld/shared";
import { Schema, MapSchema, type } from "@colyseus/schema";

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

class WorldRoom extends Room {
  maxClients = 100;

  onCreate() {
    this.setState(new WorldState());
    this.setSimulationInterval(() => this.update(), 1000 / 15);
  }

  onJoin(client: any) {
    const p = new Player();
    p.x = 0;
    p.y = 0;
    p.color = randomColor();
    this.state.players.set(client.sessionId, p);
    // eslint-disable-next-line no-console
    console.log(`[world] join ${client.sessionId} clients=${this.clients.length} players=${this.state.players.size}`);
  }

  onMessage(client: any, message: any) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;
    if (message?.type === "move") {
      const parsed = MoveInput.partial({ seq: true, keys: true }).safeParse({ dx: message.dx, dy: message.dy });
      if (!parsed.success) return;
      const { dx, dy } = parsed.data;
      p.x += clamp(dx ?? 0, -1, 1) * 3;
      p.y += clamp(dy ?? 0, -1, 1) * 3;
    }
  }

  onLeave(client: any) {
    this.state.players.delete(client.sessionId);
    // eslint-disable-next-line no-console
    console.log(`[world] leave ${client.sessionId} clients=${this.clients.length} players=${this.state.players.size}`);
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
