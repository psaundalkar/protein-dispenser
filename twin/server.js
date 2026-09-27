'use strict';

/**
 * Digital Twin server.
 *   - serves the operator dashboard (public/index.html)
 *   - pushes telemetry over WebSocket at 10 Hz
 *   - exposes a small REST API for machine commands
 *
 * Run:  node twin/server.js   ->  http://localhost:5177
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const Machine = require('./machine');
const IO = require('./io');

const PORT = process.env.PORT || 5177;
const PUBLIC = path.join(__dirname, 'public');

const machine = new Machine(new IO());

// ---------------------------------------------------------------- static files
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };

function serveStatic(req, res) {
  let p = req.url.split('?')[0];
  if (p === '/') p = '/index.html';
  const file = path.join(PUBLIC, path.normalize(p).replace(/^([.][.][/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403).end('forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

// ---------------------------------------------------------------- REST API
function json(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(body));
}

const PRODUCTS = require('./products');

function route(req, res, body) {
  const [url, qs] = req.url.split('?');
  const q = new URLSearchParams(qs || '');
  switch (url) {
    case '/api/state': return json(res, 200, machine.snapshot());
    case '/api/history': return json(res, 200, machine.history);
    case '/api/products': return json(res, 200, PRODUCTS);
    case '/api/power':
      machine.power.booted ? machine.powerOff() : machine.powerOn();
      return json(res, 200, { ok: true, booted: machine.power.booted });
    case '/api/maintenance':
      machine.setMaintenance(q.get('on') === '1');
      return json(res, 200, { ok: true, maintenance: machine.power.maintenance });
    case '/api/brew': {
      const product = PRODUCTS.find((p) => p.id === q.get('product')) || PRODUCTS[0];
      return json(res, 200, machine.brew(product));
    }
    case '/api/refill': return json(res, 200, machine.refill());
    case '/api/fault': return json(res, 200, (machine.fault(q.get('code') || 'E99'), { ok: true }));
    case '/api/clear': return json(res, 200, (machine.clearFault(), { ok: true }));
    case '/api/door':
      machine.io.setDoor(q.get('closed') === '1');
      machine.gpio.door_switch = machine.io.doorClosed();
      return json(res, 200, { ok: true, door_closed: machine.io.doorClosed() });
    default: return json(res, 404, { err: 'unknown endpoint' });
  }
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' }).end();
    return;
  }
  if (req.url.startsWith('/api/')) return route(req, res);
  return serveStatic(req, res);
});

// ---------------------------------------------------------------- simulate + push
let last = Date.now();
setInterval(() => {
  const now = Date.now();
  const dt = now - last;
  last = now;
  // run several sub-steps for stability
  const steps = Math.max(1, Math.round(dt / Machine.TICK_MS));
  for (let i = 0; i < steps; i++) machine.step(Machine.TICK_MS);
  broadcast({ type: 'state', data: machine.snapshot(), history: machine.history.slice(-180) });
}, Machine.TICK_MS);

// ---------------------------------------------------------------- websocket (raw)
const crypto = require('crypto');
const clients = new Set();

server.on('upgrade', (req, socket) => {
  if (req.headers.upgrade !== 'websocket') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  clients.add(socket);
  send(socket, { type: 'hello', products: PRODUCTS });
  socket.on('close', () => clients.delete(socket));
  socket.on('error', () => clients.delete(socket));
});

function frame(obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, len]); }
  else if (len < 65536) { header = Buffer.from([0x81, 126, len >> 8, len & 0xff]); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
  return Buffer.concat([header, payload]);
}
function send(socket, obj) { try { socket.write(frame(obj)); } catch { clients.delete(socket); } }
function broadcast(obj) { for (const c of clients) send(c, obj); }

server.listen(PORT, () => {
  console.log(`Protein Dispenser digital twin  ->  http://localhost:${PORT}`);
  machine.powerOn();
});
