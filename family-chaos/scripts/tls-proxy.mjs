// Test tool: an HTTPS/WSS reverse proxy in front of the game server, like Render's edge.
// It terminates TLS (self-signed cert), adds X-Forwarded-For, and can simulate a remote
// network: fixed extra latency per direction and an endpoint that drops all connections.
//
//   node scripts/tls-proxy.mjs --listen 8443 --target 8790 [--delay 60]
//   GET https://localhost:8443/__proxy/drop   -> kills every proxied socket (simulated Wi-Fi drop)
//   GET https://localhost:8443/__proxy/freeze -> current sockets silently stop delivering data (dead network, no close)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:https';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const arg = (name, d) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const LISTEN = Number(arg('listen', 8443));
const TARGET = Number(arg('target', 8790));
const DELAY = Number(arg('delay', 0));

const dir = join(tmpdir(), 'fc-tls');
mkdirSync(dir, { recursive: true });
const key = join(dir, 'key.pem'), cert = join(dir, 'cert.pem');
if (!existsSync(key)) {
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert,
    '-days', '30', '-subj', '/CN=localhost'], { stdio: 'ignore' });
}

const sockets = new Set();
const frozen = new WeakSet();
const later = (fn) => (DELAY ? setTimeout(fn, DELAY) : fn());

/** Pipes two sockets with optional added latency in both directions. */
function pipe(a, b) {
  sockets.add(a); sockets.add(b);
  a.on('data', (d) => later(() => !frozen.has(a) && b.writable && b.write(d)));
  b.on('data', (d) => later(() => !frozen.has(a) && a.writable && a.write(d)));
  const end = () => { a.destroy(); b.destroy(); sockets.delete(a); sockets.delete(b); };
  a.on('close', end); b.on('close', end); a.on('error', end); b.on('error', end);
}

function rawRequest(req) {
  const fwd = req.headers['x-forwarded-for'];
  const ip = req.socket.remoteAddress;
  const headers = { ...req.headers, 'x-forwarded-for': fwd ? `${fwd}, ${ip}` : ip, 'x-forwarded-proto': 'https' };
  let head = `${req.method} ${req.url} HTTP/1.1\r\n`;
  for (const [k, v] of Object.entries(headers)) for (const vv of [].concat(v)) head += `${k}: ${vv}\r\n`;
  return head + '\r\n';
}

const server = createServer({ key: readFileSync(key), cert: readFileSync(cert) }, (req, res) => {
  if (req.url === '/__proxy/freeze') {
    let n = 0;
    for (const s of sockets) { frozen.add(s); n++; }
    res.end(`frozen ${n}`);
    return;
  }
  if (req.url === '/__proxy/drop') {
    const n = sockets.size;
    for (const s of sockets) s.destroy();
    sockets.clear();
    res.end(`dropped ${n}`);
    return;
  }
  // plain HTTP requests
  const fwd = req.headers['x-forwarded-for'];
  const up = httpRequest({
    host: '127.0.0.1', port: TARGET, method: req.method, path: req.url,
    headers: { ...req.headers, 'x-forwarded-for': fwd ? `${fwd}, ${req.socket.remoteAddress}` : req.socket.remoteAddress, 'x-forwarded-proto': 'https' },
  }, (upRes) => later(() => { res.writeHead(upRes.statusCode ?? 502, upRes.headers); upRes.pipe(res); }));
  up.on('error', () => { res.statusCode = 502; res.end(); });
  req.pipe(up);
});

server.on('upgrade', (req, socket, head) => {
  const up = connect(TARGET, '127.0.0.1', () => {
    up.write(rawRequest(req));
    if (head.length) up.write(head);
    pipe(socket, up);
  });
  up.on('error', () => socket.destroy());
});

server.listen(LISTEN, () => console.log(`TLS proxy https://localhost:${LISTEN} -> http://127.0.0.1:${TARGET} (delay ${DELAY}ms)`));
