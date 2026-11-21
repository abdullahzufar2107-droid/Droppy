// Droppy server: file statis + signaling WebSocket + konfigurasi ICE (STUN/TURN).
// Jalankan: node server/index.js   (tanpa npm install)
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleUpgrade } from './ws.js';
import { createSignaling } from './signaling.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../client');

// Baca file .env kalau ada (Node 20.12+). Kalau tidak ada, pakai nilai default.
try {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
} catch {}

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/** Daftar ICE server yang dikirim ke browser. TURN opsional lewat environment variable. */
function iceConfig() {
  const stunUrls = (process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const iceServers = [{ urls: stunUrls }];
  if (process.env.TURN_URL) {
    iceServers.push({
      urls: process.env.TURN_URL.split(',').map((s) => s.trim()),
      username: process.env.TURN_USER || '',
      credential: process.env.TURN_PASS || '',
    });
  }
  return { iceServers };
}

const signaling = createSignaling({ log: (m) => console.log(`[signal] ${m}`) });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/config') {
    res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(iceConfig()));
  }
  if (url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': MIME['.json'] });
    return res.end(JSON.stringify({ ok: true, online: signaling.online() }));
  }

  // File statis dari folder client/ (dengan perlindungan path traversal)
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname !== '/signal') return socket.destroy();
  handleUpgrade(req, socket, head, signaling.onConnection);
});

server.listen(PORT, HOST, () => {
  console.log('\n  Droppy berjalan\n');
  console.log(`  Lokal    : http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal) console.log(`  Jaringan : http://${i.address}:${PORT}`);
    }
  }
  console.log(process.env.TURN_URL ? '\n  TURN     : aktif' : '\n  TURN     : tidak diatur (hanya STUN)');
  console.log('');
});
