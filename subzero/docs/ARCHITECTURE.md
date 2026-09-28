# SubZero Architecture

## Pattern
Both apps follow **MVVM** with a unidirectional data flow.

```
UI (Compose / SwiftUI)
   │  events ▲ state
   ▼        │
ViewModel  ── observes ──►  Repositories
                              │
        ┌─────────────────────┼───────────────────────┐
        ▼                     ▼                         ▼
  CryptoEngine        RamMessageBuffer            IdentityManager
 (Double Ratchet)    (in-memory chats)          (name/icon switch)
        │                                              │
   KeyStore /                                    Launcher aliases /
  Secure Enclave                                 alternate icons
```

## Android modules (`com.subzero.messenger`)

| Package | Responsibility |
|---|---|
| `crypto` | `CryptoEngine`, `DoubleRatchet`, `X3DH`, `KeyStoreManager`, AEAD helpers |
| `data` | `RamMessageBuffer`, `Message`, `Contact`, `ChatRepository` |
| `identity` | `IdentityManager`, launcher-alias switching, `AppIdentity` |
| `security` | `AppLock` (biometric), `ScreenSecurity` (FLAG_SECURE), `RootAwareness` |
| `ui.chat` | Chat list + conversation screens, `ChatViewModel` |
| `ui.safezone` | `SafeZoneController`, `SafeZoneHost`, return-gesture detector |
| `ui.safezone.games` | `Game` interface + implementations (2048, Snake, TicTacToe, Memory) |
| `ui.decoy` | Decoy `CalculatorScreen` (fully functional) and others |
| `ui.settings` | Identity manager, SafeZone config, lock/timeout settings |

### SafeZone flow
1. User taps the SafeZone button in the chat input row.
2. `SafeZoneController.activate()` clears the visible chat state, hides the
   keyboard, and clears the input field.
3. A screen is chosen from the enabled pool with **no-repeat-twice** logic
   (`SafeZonePicker`). Pool: mini-games + decoy utilities.
4. The chosen screen renders full-bleed. The real chat is not in the back stack.
5. **Return gesture** (double-tap top-right, two-finger swipe down, or a
   hidden long-press target) calls `SafeZoneController.exit()`, which re-
   authenticates (biometric if configured) and restores chat state from the
   RAM buffer.
6. If SafeZone stays open past `autoLockTimeout`, `AppLock` engages and the
   session must be re-unlocked.

## iOS modules (`SubZero/`)
Mirror of the Android layout: `Crypto/`, `Identity/`, `Features/Chat`,
`Features/SafeZone`, `Features/Decoy`. Uses CryptoKit + Secure Enclave and
`UIApplication.setAlternateIconName` for identity switching.

## What is scaffolded vs complete
The cryptographic core, RAM buffer, SafeZone controller, several mini-games, the
decoy calculator, identity switching, biometric lock, and screenshot protection
are implemented. Encrypted voice/video is provided as a WebRTC interface
(`CallService`) with a documented integration point rather than a full signaling
stack. See per-file `TODO(subzero)` markers.
