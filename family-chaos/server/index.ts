import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { networkInterfaces } from 'node:os';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import type { C2S } from '../shared/protocol';
import type { Client } from './room';
import { TIMING } from './room';
import { Rooms } from './rooms';
import { Bucket } from './util';

const PORT = Number(process.env.PORT ?? 8787);
const HOST = process.env.HOST ?? '0.0.0.0';
const here = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(process.env.WEB_ROOT ?? join(here, '..', 'client'));
const TRUST_PROXY = process.env.TRUST_PROXY === '1';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg',
};

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data: blob:; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; " +
    "script-src 'self'; frame-ancestors 'none'",
};

function lanUrls(): string[] {
  const out: string[] = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const i of list ?? []) {
      if (i.family === 'IPv4' && !i.internal) out.push(`http://${i.address}:${PORT}`);
    }
  }
  return out;
}

function clientIp(req: IncomingMessage): string {
  if (TRUST_PROXY) {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function serveStatic(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x');
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }
  if (url.pathname === '/api/info') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ lan: lanUrls(), publicUrl: process.env.PUBLIC_URL ?? null, rooms: rooms.rooms.size }));
  }
  let file = normalize(join(WEB_ROOT, decodeURIComponent(url.pathname)));
  if (!file.startsWith(WEB_ROOT)) {
    res.writeHead(403);
    return res.end();
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(WEB_ROOT, 'index.html'); // SPA fallback
  if (!existsSync(file)) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Client not built. Run `npm run build` (or use `npm run dev`).');
  }
  const immutable = file.includes(`${join(WEB_ROOT, 'assets')}`);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(file).pipe(res);
}

const rooms = new Rooms();
const server = createServer(serveStatic);
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 8 * 1024, perMessageDeflate: false });

wss.on('connection', (ws: WebSocket & { alive?: boolean }, req) => {
  const ip = clientIp(req);
  const bucket = new Bucket(90, 180); // msgs/sec; controllers send ~30/s
  let strikes = 0;
  const client: Client = {
    role: 'none', room: null, playerId: null, rtt: 0,
    send: (m) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(m)); },
    close: () => ws.close(4000, 'closed'),
  };
  ws.alive = true;
  ws.on('pong', () => { ws.alive = true; });
  ws.on('message', (data, isBinary) => {
    if (isBinary) return;
    if (!bucket.take()) {
      if (++strikes > 200) ws.close(4008, 'rate');
      return;
    }
    let m: C2S;
    try {
      m = JSON.parse(data.toString());
    } catch {
      return client.send({ t: 'error', code: 'bad_message' });
    }
    if (!m || typeof m !== 'object' || typeof m.t !== 'string') return;
    try {
      rooms.route(client, m, ip);
    } catch (e) {
      console.error('route error', e);
    }
  });
  ws.on('close', () => rooms.disconnect(client));
});

// heartbeat: drop dead sockets so reconnecting players get their slot back quickly
setInterval(() => {
  for (const ws of wss.clients as Set<WebSocket & { alive?: boolean }>) {
    if (ws.alive === false) { ws.terminate(); continue; }
    ws.alive = false;
    ws.ping();
  }
}, 15_000);

// fixed-step game loop (drift-corrected)
let next = performance.now();
function loop() {
  try {
    rooms.tick();
  } catch (e) {
    console.error('tick error', e);
  }
  next += TIMING.TICK_MS;
  const delay = next - performance.now();
  if (delay < -250) next = performance.now(); // fell far behind: resync
  setTimeout(loop, Math.max(0, delay));
}
loop();

server.listen(PORT, HOST, () => {
  console.log(`FAMILY CHAOS server on http://localhost:${PORT}`);
  for (const u of lanUrls()) console.log(`  LAN: ${u}  (open /host on the TV/PC, phones scan the QR)`);
});
