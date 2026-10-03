// Generates the SubZero API reference as a .docx.
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
} = require("docx");
const fs = require("fs");

const NEON = "16A594", INK = "0B0F14", GREY = "667079", CODEBG = "F2F4F5";

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 },
  children: [new TextRun({ text: t, bold: true, color: NEON })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 90 },
  children: [new TextRun({ text: t, bold: true, color: INK })] });
const P = (t) => new Paragraph({ spacing: { after: 110 }, children: [new TextRun(t)] });
const Bullet = (t) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 50 }, children: [new TextRun(t)] });
const mono = (line) => new TextRun({ text: line, font: "Consolas", size: 18 });
function Code(lines) {
  return new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: CODEBG, color: "auto" },
    spacing: { before: 60, after: 120 }, border: {
      top: { style: BorderStyle.SINGLE, size: 4, color: "D5DBDE", space: 4 },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "D5DBDE", space: 4 },
      left: { style: BorderStyle.SINGLE, size: 4, color: "D5DBDE", space: 6 },
      right: { style: BorderStyle.SINGLE, size: 4, color: "D5DBDE", space: 6 },
    },
    children: lines.flatMap((l, i) => i === 0 ? [mono(l)] : [new TextRun({ break: 1 }), mono(l)]),
  });
}
function Tbl(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  const cell = (text, head, w) => new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: INK, color: "auto" } : undefined,
    margins: { top: 50, bottom: 50, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: head, color: head ? "FFFFFF" : "000000",
      font: head ? undefined : "Consolas", size: head ? undefined : 18 })] })],
  });
  return new Table({
    columnWidths: widths, width: { size: total, type: WidthType.DXA },
    rows: rows.map((r, ri) => new TableRow({ children: r.map((c, ci) => cell(c, ri === 0, widths[ci])) })),
  });
}

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, bottom: 1080, left: 1180, right: 1180 } } },
    children: [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: "SubZero — API Reference", bold: true, size: 52, color: NEON })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 260 },
        children: [new TextRun({ text: "Relay protocol · crypto/session API · client seams", size: 22, color: GREY })] }),

      P("SubZero is designed around one rule: the server and network see only ciphertext and routing labels — never plaintext or keys. This reference covers the relay protocol, the wire formats, the cryptographic/session API, and the client integration seams."),

      H1("1. Relay server protocol (WebSocket)"),
      P("The relay is a single WebSocket endpoint plus an HTTP GET /health returning “ok”. All frames are JSON."),
      H2("Client → server"),
      Tbl([1400, 2600, 5360], [
        ["Frame", "Fields", "Meaning"],
        ["reg", "address", "Register this socket under a routing address."],
        ["bundle", "address, bundle", "Publish this address's public prekey bundle."],
        ["getBundle", "address", "Request a peer's published bundle."],
        ["env", "to, kind, payload", "Send an opaque envelope. kind = message | signal."],
      ]),
      H2("Server → client"),
      Tbl([1400, 2600, 5360], [
        ["Frame", "Fields", "Meaning"],
        ["bundle", "address, bundle|null", "Reply to getBundle."],
        ["env", "kind, payload", "Delivered envelope. No sender field (sealed sender)."],
        ["ack", "queued", "Send acknowledged; queued=true = stored for offline peer."],
        ["err", "reason", "Error (bad-json, bad-address, bad-envelope, …)."],
      ]),
      H2("Semantics"),
      Bullet("address is an opaque, client-chosen routing label (8–128 chars), e.g. a hash of the identity key. The server never interprets it."),
      Bullet("payload is an opaque string (a JSON envelope of base64 fields). The server never parses it."),
      Bullet("Store-and-forward: a message to an offline peer is queued (cap 500) and flushed on their next reg. Call signaling is NOT queued when the peer is offline."),
      Bullet("State is in-memory only; nothing is persisted and no payloads are logged. Max frame 256 KiB."),
      H2("Example"),
      Code([
        '→ {"t":"reg","address":"a1b2c3d4e5"}',
        '→ {"t":"bundle","address":"a1b2c3d4e5","bundle":"<b64|b64|b64|b64>"}',
        '→ {"t":"getBundle","address":"f6g7h8i9j0"}',
        '← {"t":"bundle","address":"f6g7h8i9j0","bundle":"<…>"}',
        '→ {"t":"env","to":"f6g7h8i9j0","kind":"message",',
        '     "payload":"{\\"hs\\":\\"…\\",\\"h\\":\\"…\\",\\"c\\":\\"…\\"}"}',
        '← {"t":"ack","queued":false}',
      ]),

      H1("2. Wire formats"),
      H2("Prekey bundle"),
      P("identityKey | identityKeyX | signedPreKey | signedPreKeySignature — each field base64 (X.509 for keys), joined by “|”."),
      Bullet("identityKey — Ed25519 public (signs the signed prekey)."),
      Bullet("identityKeyX — X25519 public (X3DH agreement)."),
      Bullet("signedPreKey — X25519 public; signedPreKeySignature — Ed25519 signature over it."),
      H2("Handshake (first message only)"),
      P("identityKey | identityKeyX | ephemeral — each base64, joined by “|”."),
      H2("Message envelope (the payload of a message env)"),
      Code(['{ "hs": "<handshake, first message only>",',
            '  "h":  "<base64 ratchet header>",',
            '  "c":  "<base64 ciphertext>" }']),

      H1("3. Cryptographic / session API (CryptoEngine)"),
      Tbl([3600, 6760], [
        ["Method", "Purpose"],
        ["myBundleWire(): String", "Serialized public bundle to publish."],
        ["verifyPreKey(bundle): Boolean", "Verify a peer bundle's signed-prekey signature."],
        ["startOutbound(cid, peerWireBundle): Handshake", "Initiator: establish session, return handshake to send."],
        ["acceptInbound(cid, handshake)", "Responder: open session from a received handshake."],
        ["hasSession(cid): Boolean", "Whether a session exists."],
        ["encrypt(cid, text): EncryptedMessage", "Ratchet-encrypt UTF-8 text."],
        ["decrypt(cid, msg): String", "Ratchet-decrypt to text."],
        ["wipeSessions()", "Drop all sessions (secure logout)."],
      ]),
      H2("Primitives"),
      Bullet("X3DH (initiate/respond) → shared root via HKDF-SHA256 over three DH outputs (agreement verified on both sides)."),
      Bullet("Double Ratchet: X25519 DH ratchet + symmetric chain; AEAD is AES-256-GCM with the header as associated data."),
      Bullet("KeyStoreManager: hardware-backed (StrongBox→TEE fallback) AES key wrapping data at rest (the vault)."),
      H2("Session bootstrap flow"),
      Code([
        "Responder: publish myBundleWire()  ─▶ relay directory",
        "Initiator: getBundle(responder)    ◀─ peerWireBundle",
        "Initiator: hs = startOutbound(cid, peerWireBundle)",
        "Initiator: send { hs, h, c }       ─▶ relay ─▶ Responder",
        "Responder: acceptInbound(cid, hs); decrypt(cid, {h,c})",
        "… thereafter both sides just encrypt()/decrypt() …",
      ]),

      H1("4. Client integration seams"),
      H2("Transport"),
      Code(["fun send(envelope: String)",
            "fun onReceive(handler: (envelope: String) -> Unit)"]),
      H2("Directory"),
      Code(["fun publish(bundleWire: String)",
            "fun requestPeerBundle()",
            "fun onPeerBundle(handler: (bundleWire: String) -> Unit)"]),
      P("WebSocketTransport implements both over one relay socket. RelaySettings (set on the in-app ⚙ setup screen) supplies url / selfAddress / peerAddress; a blank url keeps the app fully offline."),
      H2("Calling seam — RtcEngine"),
      P("CallManager drives the call state machine and hands SignalingMessages (Offer/Answer/IceCandidate/Hangup) to a sender that E2E-encrypts them before relaying as signal envelopes. LoopbackRtcEngine ships today; a WebRtcEngine (PeerConnectionFactory + STUN/TURN) plugs in for live media."),

      H1("5. Security properties"),
      Bullet("Confidentiality/integrity: E2E via X3DH + Double Ratchet; forward secrecy + post-compromise security. Server sees ciphertext only."),
      Bullet("Metadata: sealed sender; no address-book upload; no payload logging; ephemeral server state."),
      Bullet("At rest: RAM-only message buffer; vault blobs AES-GCM encrypted under a hardware/Keychain key; no cloud backup."),
      Bullet("Not provided by design: anti-forensic self-wipe, app-hiding from the OS, automatic evidence destruction (see SECURITY.md)."),
    ],
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(process.argv[2] || "SubZero-API.docx", buf);
  console.log("wrote", process.argv[2] || "SubZero-API.docx");
});
