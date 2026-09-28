# SubZero API Reference

This document describes the interfaces that make SubZero work: the **relay
server protocol**, the **cryptographic/session API**, and the **client
integration seams** (transport + directory). All of it is designed around one
rule — the server and network see only ciphertext and routing labels, never
plaintext or keys.

---

## 1. Relay server protocol (WebSocket)

The relay (`subzero/server/`) is a single WebSocket endpoint plus an HTTP
`GET /health` returning `ok`. All frames are JSON.

### Client → server

| Frame | Fields | Meaning |
|---|---|---|
| `reg` | `address` | Register this socket under a routing address. |
| `bundle` | `address`, `bundle` | Publish this address's public prekey bundle. |
| `getBundle` | `address` | Request a peer's published bundle. |
| `env` | `to`, `kind`, `payload` | Send an opaque envelope. `kind` = `"message"` or `"signal"`. |

### Server → client

| Frame | Fields | Meaning |
|---|---|---|
| `bundle` | `address`, `bundle`\|`null` | Reply to `getBundle`. |
| `env` | `kind`, `payload` | Delivered envelope. **No sender field** (sealed sender). |
| `ack` | `queued` | Send acknowledged; `queued=true` means stored for an offline peer. |
| `err` | `reason` | Error (`bad-json`, `bad-address`, `bad-envelope`, …). |

### Semantics
- **`address`** is an opaque, client-chosen routing label (8–128 chars), e.g. a
  hash of the identity key. The server never interprets it.
- **`payload`** is an opaque string (base64 ciphertext / a JSON envelope). The
  server never parses it.
- **Store-and-forward**: `kind:"message"` to an offline peer is queued (cap 500,
  oldest dropped) and flushed on the peer's next `reg`. `kind:"signal"` (call
  setup) is **not** queued when the peer is offline.
- **State** is in-memory only; nothing is persisted, no payloads are logged.
- Max frame size 256 KiB.

### Example
```json
→ {"t":"reg","address":"a1b2c3d4e5"}
→ {"t":"bundle","address":"a1b2c3d4e5","bundle":"<base64|base64|base64|base64>"}
→ {"t":"getBundle","address":"f6g7h8i9j0"}
← {"t":"bundle","address":"f6g7h8i9j0","bundle":"<…>"}
→ {"t":"env","to":"f6g7h8i9j0","kind":"message","payload":"{\"hs\":\"…\",\"h\":\"…\",\"c\":\"…\"}"}
← {"t":"ack","queued":false}
```

---

## 2. Wire formats

### Prekey bundle (published to the directory)
`identityKey | identityKeyX | signedPreKey | signedPreKeySignature`, each field
base64 (X.509 SubjectPublicKeyInfo for keys), joined by `|`.
- `identityKey` — Ed25519 public (signs the signed prekey).
- `identityKeyX` — X25519 public (X3DH agreement).
- `signedPreKey` — X25519 public.
- `signedPreKeySignature` — Ed25519 signature over `signedPreKey`.

### Handshake (attached to the first message)
`identityKey | identityKeyX | ephemeral`, each base64, joined by `|`.

### Message envelope (the `payload` of a `message` env)
```json
{ "hs": "<handshake, first message only>", "h": "<base64 ratchet header>", "c": "<base64 ciphertext>" }
```

---

## 3. Cryptographic / session API (`crypto/`)

### `CryptoEngine`
Owns one device's identity + prekeys and one Double Ratchet session per
conversation.

| Method | Purpose |
|---|---|
| `myBundle(): X3DH.PreKeyBundle` | This device's public bundle (objects). |
| `myBundleWire(): String` | Serialized bundle to publish to the directory. |
| `verifyPreKey(bundle): Boolean` | Verify a peer bundle's signed-prekey signature. |
| `startOutbound(cid, peerWireBundle): Handshake` | Initiator: establish session, return handshake to send. |
| `acceptInbound(cid, handshake)` | Responder: open session from a received handshake. |
| `hasSession(cid): Boolean` | Whether a session exists for a conversation. |
| `encrypt(cid, text): EncryptedMessage` | Ratchet-encrypt UTF-8 text. |
| `decrypt(cid, msg): String` | Ratchet-decrypt to text. |
| `wipeSessions()` | Drop all sessions (secure logout). |
| `CryptoEngine.Wire.encode/decodeBundle`, `encode/decodeHandshake` | (De)serialize wire strings. |

### Primitives
- **X3DH** (`X3DH.initiate` / `X3DH.respond`) → shared root (HKDF-SHA256 over
  the three DH outputs; verified to agree on both sides).
- **Double Ratchet** (`DoubleRatchet`): X25519 DH ratchet + symmetric-key chain;
  AEAD is AES-256-GCM (`Aead`). Header is authenticated as associated data.
- **KeyStoreManager**: hardware-backed (StrongBox→TEE fallback) AES key wrapping
  data at rest; used by the vault.

### Session bootstrap flow
```
Responder: publish myBundleWire()  ──▶ relay directory
Initiator: getBundle(responder)    ◀── peerWireBundle
Initiator: hs = startOutbound(cid, peerWireBundle)
Initiator: send { hs, h, c }       ──▶ relay ──▶ Responder
Responder: acceptInbound(cid, hs); decrypt(cid, {h,c})
… thereafter both sides just encrypt()/decrypt() (ratchet turns over) …
```

---

## 4. Client integration seams

### `ChatRepository.Transport`
```kotlin
fun send(envelope: String)
fun onReceive(handler: (envelope: String) -> Unit)
```

### `ChatRepository.Directory`
```kotlin
fun publish(bundleWire: String)
fun requestPeerBundle()
fun onPeerBundle(handler: (bundleWire: String) -> Unit)
```

`WebSocketTransport` implements both over one relay socket. `RelaySettings`
(SharedPreferences, set on the in-app ⚙ setup screen) supplies `url`,
`selfAddress`, `peerAddress`; blank `url` keeps the app fully offline.

### Calling seam — `RtcEngine`
```kotlin
fun start(type, asCaller, listener)      // listener: onLocalSdp/onIceCandidate/onConnected/onEnded
fun acceptRemoteOffer(sdp); acceptRemoteAnswer(sdp); addRemoteIce(mid, idx, cand)
fun setMicMuted(b); setVideoEnabled(b); switchCamera(); close()
```
`CallManager` drives the state machine and hands `SignalingMessage`s (Offer/
Answer/IceCandidate/Hangup) to a sender that E2E-encrypts them before relaying as
`kind:"signal"` envelopes. `LoopbackRtcEngine` ships today; a `WebRtcEngine`
(PeerConnectionFactory + a STUN/TURN config) plugs in for live media.

---

## 5. Security properties (summary)
- **Confidentiality/integrity**: E2E via X3DH + Double Ratchet; forward secrecy +
  post-compromise security. Server sees ciphertext only.
- **Metadata**: sealed sender (no sender id on the wire); no address-book upload;
  no payload logging; ephemeral server state.
- **At rest**: RAM-only message buffer; vault blobs AES-GCM encrypted under a
  hardware/Keychain key; no cloud backup.
- **Not provided (by design)**: anti-forensic self-wipe, app-hiding from the OS,
  automatic evidence destruction. See `SECURITY.md`.
