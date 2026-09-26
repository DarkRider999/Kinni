# SubZero Relay Server

The small backend that lets two SubZero phones reach each other over the
internet. It is **zero-knowledge**: it only ever sees end-to-end-encrypted
ciphertext and the routing address it must deliver to — never message text,
never keys.

## What it does
1. **Relays encrypted envelopes** between devices (real-time when both are
   online; store-and-forward while the recipient is offline).
2. **Relays WebRTC call signaling** (offer/answer/ICE) so voice/video calls can
   connect.
3. **Hosts a prekey directory** — the *public* X3DH prekey bundles devices
   publish so a session can be set up without both being online at once.

Everything is in memory; nothing is written to disk and no payloads are logged.
A restart just makes sessions re-establish.

## Run it locally
```bash
cd subzero/server
npm install
npm start          # listens on :8080  (GET /health -> "ok")
npm test           # end-to-end relay tests
```

## Deploy it (pick one)
It's a single WebSocket service on `$PORT`. Any of these work:

- **Render / Railway / Fly.io**: point them at this folder. Build `npm install`,
  start `npm start`. They set `$PORT` automatically. Use the Dockerfile if asked.
- **Docker**: `docker build -t subzero-relay . && docker run -p 8080:8080 subzero-relay`
- **A small VPS**: `npm install && PORT=8080 node src/server.js` behind a TLS
  reverse proxy (Caddy/nginx) so clients connect over `wss://`.

> Use **`wss://`** (TLS) in production — the app sends ciphertext, but TLS also
> hides the routing metadata from the network. Any host with a certificate
> (Render/Fly give you one automatically) covers this.

## Point the app at it
In the Android app, set the relay URL (see `subzero/android` —
`RelayConfig.URL`) to your deployed `wss://…` address. Leaving it blank keeps
the app fully offline (no delivery), which is the default.

## Calls need a TURN server too
WebRTC media (the actual audio/video) uses peer-to-peer with a STUN server for
NAT traversal, and a **TURN** relay as a fallback when a direct path can't be
found (common on mobile networks). This signaling server carries the setup
messages; add a STUN/TURN server (e.g. a hosted `coturn`) to the WebRTC engine
config for reliable connections. Public STUN (`stun:stun.l.google.com:19302`)
is enough to test; TURN is needed for reliability.

## Protocol (JSON over WebSocket)
```
-> { t:"reg",       address }                          register this socket
-> { t:"bundle",    address, bundle }                  publish a public prekey bundle
-> { t:"getBundle", address }                          request a peer's bundle
<- { t:"bundle",    address, bundle|null }
-> { t:"env", to, kind:"message"|"signal", payload }   send a ciphertext envelope
<- { t:"env",       kind, payload }                    deliver an envelope
<- { t:"ack",       queued }
<- { t:"err",       reason }
```
`payload` is opaque base64 ciphertext. `address` is a client-chosen routing id
(e.g. a hash of the identity key); the server treats it as an opaque label.
