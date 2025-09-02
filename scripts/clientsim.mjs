#!/usr/bin/env node
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { Client } = require('colyseus.js');

const name = process.env.NAME || `sim-${Math.random().toString(16).slice(-4)}`;
const url = (process.env.SERVER_URL || 'ws://localhost:2567').replace(/^http/, 'ws');
const tokenSecret = process.env.TOKEN_SECRET || null;
const kidId = process.env.KID_ID || null;
const logDir = new URL('../logs/', import.meta.url);
const logPath = new URL(`client-${name}.log`, logDir).pathname;
fs.mkdirSync(logDir, { recursive: true });
const log = fs.createWriteStream(logPath, { flags: 'a' });
function flog(msg) {
  const line = `[${new Date().toISOString()}] [${name}] ${msg}\n`;
  process.stdout.write(line);
  log.write(line);
}

let room;
let reconnect = 500;

async function connect() {
  try {
    const client = new Client(url);
    flog(`connecting ${url}`);
    let opts = {};
    if (tokenSecret && kidId) {
      const payload = Buffer.from(JSON.stringify({ kid: kidId, exp: Math.floor(Date.now()/1000) + 60*5 }));
      const data = payload.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
      const crypto = await import('crypto');
      const sig = crypto.createHmac('sha256', tokenSecret).update(data).digest('hex');
      opts.kidToken = `${data}.${sig}`;
      flog(`using kidToken for kid=${kidId}`);
    }
    room = await client.joinOrCreate('world', opts);
    flog(`connected room=${room.roomId} session=${room.sessionId}`);
    reconnect = 500;
    room.onStateChange((_state) => {
      // minimal
    });
    room.onError((code, message) => {
      flog(`room error code=${code} message=${message}`);
    });
    room.onLeave(() => {
      flog(`room leave`);
      scheduleReconnect();
    });
  } catch (err) {
    flog(`connect error ${err && err.message ? err.message : err}`);
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  setTimeout(connect, reconnect);
  reconnect = Math.min(reconnect * 2, 5000);
}

// send periodic input
setInterval(() => {
  try {
    if (!room) return;
    const dx = (Math.random() < 0.5 ? -1 : 1);
    const dy = (Math.random() < 0.5 ? -1 : 1);
    room.send('move', { dx, dy });
  } catch {}
}, 200);

connect();
