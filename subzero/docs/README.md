# SubZero — Private Messenger

SubZero is a privacy-first, end-to-end encrypted messenger for Android and iOS.
It borrows its cryptographic design from the Signal protocol (X3DH + Double
Ratchet) and adds a set of on-device privacy conveniences: a quick-hide
"SafeZone" screen with mini-games and decoy utility apps, biometric app lock,
disappearing messages, screenshot protection, and user-controlled identity
(app name + icon) switching.

## Scope & principles

SubZero is built to be a **legitimate, store-publishable privacy app**. Its
security model is *zero-knowledge*: the server never sees plaintext, keys never
leave the device's secure hardware, and message content lives in an in-memory
buffer that is cleared on logout. That is a strong, honest privacy posture and
it is what "military-grade privacy" actually means in practice.

What SubZero deliberately does **not** do, and why:

| Not included | Reason |
|---|---|
| Self-wiping when a debugger/forensic tool is detected | Purpose-built anti-forensic evidence destruction is designed to defeat lawful device examination. SubZero instead *informs* the user of a compromised (rooted/jailbroken) device. |
| Hiding the app from the OS installed-apps list | Both app stores reject apps that hide their own presence, and the feature's only purpose is evading inspection. SubZero's identity switching is visible in system Settings. |
| Automatic "panic" evidence destruction | SubZero gives the *user* a secure-logout / local-wipe control they trigger themselves. It does not destroy data to frustrate an investigation. |

Everything else in the original spec — encryption, disappearing messages, the
SafeZone quick-hide UX, mini-games, decoy screens, biometric lock, icon/name
switching, and the dark neon UI — is implemented here.

## Layout

```
subzero/
├── docs/            Architecture & security documentation
├── android/         Kotlin + Jetpack Compose app (MVVM)
├── ios/             Swift + SwiftUI app
└── server/          Zero-knowledge relay + signaling server (Node.js)
```

## Feature status

| Feature | Android | iOS |
|---|---|---|
| Double Ratchet crypto core | ✅ implemented | ✅ implemented |
| Hardware-backed key storage | ✅ Keystore | ✅ Secure Enclave |
| RAM-only message buffer | ✅ | ✅ |
| E2E text chat UI | ✅ | ✅ |
| Disappearing messages | ✅ | ✅ |
| Screenshot protection | ✅ FLAG_SECURE | ✅ (see notes) |
| Biometric app lock | ✅ | ✅ |
| SafeZone quick-hide | ✅ | ✅ |
| Mini-games (all 10: 2048, Snake, Sudoku, Tic-Tac-Toe, Memory, Sliding Tiles, Quick Math, Pattern Match, Word Shuffle, Bubble Pop) | ✅ all playable | ⚙️ Tic-Tac-Toe |
| Decoy calculator / notes / weather | ✅ all three | ✅ all three |
| Identity (name + icon) switching | ✅ launcher aliases | ⚙️ alternate icons |
| Rooted/jailbroken device awareness | ✅ | ✅ |
| Encrypted media vault (hidden from Gallery/Photos, encrypted at rest) | ✅ | ✅ |
| Voice/video call UI + state machine + encrypted signaling model | ✅ | ✅ |
| Live call media (WebRTC engine + signaling server) | ⚙️ engine seam | ⚙️ engine seam |
| Relay/signaling server (zero-knowledge, store-and-forward) | ✅ built + tested (`server/`) | — |
| Client ↔ relay transport | ✅ WebSocketTransport | ⚙️ TODO |
| Over-the-wire X3DH session handshake | ⚙️ final wiring step | ⚙️ final wiring step |

✅ = working implementation · ⚙️ = scaffold/interface with TODOs

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and [`SECURITY.md`](SECURITY.md).
