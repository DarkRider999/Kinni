'use strict';
/*
 * SubZero relay + signaling server.
 *
 * ZERO-KNOWLEDGE BY DESIGN. This server never sees message plaintext. Clients
 * end-to-end encrypt everything (Double Ratchet) before it arrives here; the
 * server only routes opaque ciphertext envelopes to the recipient, and holds a
 * directory of *public* prekey bundles so two devices can establish an X3DH
 * session without being online at the same time.
 *
 * What it stores (all in memory, nothing on disk):
 *   - address -> live WebSocket (who is currently connected)
 *   - address -> queued ciphertext envelopes (store-and-forward while offline)
 *   - address -> published public prekey bundle (opaque base64 to the server)
 *
 * A restart drops everything, which is fine: sessions re-establish and queued
 * ciphertext the sender still holds can be re-sent. No payloads are ever logged.
 *
 * Protocol: JSON frames over WebSocket.
 *   -> { t:"reg",       address }                         register this socket
 *   -> { t:"bundle",    address, bundle }                 publish a prekey bundle
 *   -> { t:"getBundle", address }                         request a peer's bundle
 *   <- { t:"bundle",    address, bundle|null }            bundle reply
 *   -> { t:"env", to, kind:"message"|"signal", payload }  send a ciphertext envelope
 *   <- { t:"env",       kind, payload }                   deliver an envelope
 *   <- { t:"ack",       queued }                          send acknowledged
 *   <- { t:"err",       reason }
 */

const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const MAX_QUEUE = 500;          // per-recipient offline ciphertext cap
const MAX_FRAME = 256 * 1024;   // reject oversized frames

const sockets = new Map();      // address -> ws
const queues = new Map();       // address -> [envelope]
const bundles = new Map();      // address -> bundle (opaque)

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200); res.end('ok'); return; }
  res.writeHead(404); res.end();
});

const wss = new WebSocketServer({ server, maxPayload: MAX_FRAME });

wss.on('connection', (ws) => {
  ws.address = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return send(ws, { t: 'err', reason: 'bad-json' }); }
    switch (msg.t) {
      case 'reg': return onRegister(ws, msg);
      case 'bundle': return onPublishBundle(ws, msg);
      case 'getBundle': return onGetBundle(ws, msg);
      case 'env': return onEnvelope(ws, msg);
      default: return send(ws, { t: 'err', reason: 'unknown-type' });
    }
  });

  ws.on('close', () => {
    if (ws.address && sockets.get(ws.address) === ws) sockets.delete(ws.address);
  });
  ws.on('error', () => {});
});

function onRegister(ws, { address }) {
  if (!validAddress(address)) return send(ws, { t: 'err', reason: 'bad-address' });
  // Replace any previous socket for this address (single active device).
  const prev = sockets.get(address);
  if (prev && prev !== ws) try { prev.close(); } catch {}
  ws.address = address;
  sockets.set(address, ws);
  // Flush anything queued while offline.
  const q = queues.get(address);
  if (q && q.length) {
    for (const env of q) send(ws, env);
    queues.delete(address);
  }
}

function onPublishBundle(ws, { address, bundle }) {
  if (!validAddress(address) || typeof bundle !== 'string') return send(ws, { t: 'err', reason: 'bad-bundle' });
  bundles.set(address, bundle);
}

function onGetBundle(ws, { address }) {
  if (!validAddress(address)) return send(ws, { t: 'err', reason: 'bad-address' });
  send(ws, { t: 'bundle', address, bundle: bundles.get(address) || null });
}

function onEnvelope(ws, { to, kind, payload }) {
  if (!validAddress(to) || typeof payload !== 'string') return send(ws, { t: 'err', reason: 'bad-envelope' });
  if (kind !== 'message' && kind !== 'signal') return send(ws, { t: 'err', reason: 'bad-kind' });
  const env = { t: 'env', kind, payload };           // NB: sender identity is not attached (sealed sender)
  const dest = sockets.get(to);
  if (dest && dest.readyState === dest.OPEN) {
    send(dest, env);
    return send(ws, { t: 'ack', queued: false });
  }
  // Offline: queue ciphertext messages; drop time-sensitive call signaling.
  if (kind === 'message') {
    const q = queues.get(to) || [];
    if (q.length >= MAX_QUEUE) q.shift();
    q.push(env);
    queues.set(to, q);
  }
  send(ws, { t: 'ack', queued: kind === 'message' });
}

function send(ws, obj) { try { ws.send(JSON.stringify(obj)); } catch {} }

// Address = a client-chosen routing id (e.g. a hash of the identity key).
// It is opaque to the server; we only sanity-check shape.
function validAddress(a) { return typeof a === 'string' && a.length >= 8 && a.length <= 128; }

// Auto-start only when run directly (`node src/server.js`); tests import and
// control the listener themselves.
if (require.main === module) {
  server.listen(PORT, () => {
    // Deliberately minimal, payload-free logging.
    console.log(`SubZero relay listening on :${PORT}`);
  });
}

module.exports = { server, wss };
