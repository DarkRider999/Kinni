# SubZero Security Model

## Threat model

SubZero protects the **confidentiality and integrity of message content** against:

- A malicious or compromised server (zero-knowledge: server sees only ciphertext
  and routing metadata it needs to deliver).
- Passive network observers (all transport is TLS 1.3 + application-layer E2E).
- An attacker who later obtains a captured ciphertext (forward secrecy + post-
  compromise security via the Double Ratchet).
- A casual shoulder-surfer or someone who briefly picks up an unlocked phone
  (biometric lock + SafeZone quick-hide + screenshot protection).

SubZero explicitly does **not** claim to defeat a forensic examination of a
seized, unlocked device, and does not implement anti-forensic evidence
destruction. Users who need that level of protection against device seizure
should understand that no consumer messenger can honestly promise it.

## Cryptographic design

### Identity & session establishment (X3DH)
- Long-term identity key: **Ed25519** (signing) + **X25519** (agreement).
- Signed prekey + one-time prekeys published to the server.
- New sessions are established with an **X3DH** handshake, producing a shared
  root key without either party being online simultaneously.

### Message encryption (Double Ratchet)
- **Root chain** advanced by a Diffie–Hellman ratchet (X25519) on each round
  trip → post-compromise security.
- **Sending/receiving chains** advanced by a symmetric-key ratchet (HKDF-
  SHA256) per message → forward secrecy.
- Message keys derived per message; each is used once and discarded.
- AEAD: **AES-256-GCM** (or ChaCha20-Poly1305 where hardware AES is absent).

### Key storage
- **Android:** private keys generated in and never leaving the **Android
  Keystore** (StrongBox where available). Symmetric session state is encrypted
  at rest with a Keystore-held key and held in memory while unlocked.
- **iOS:** identity keys in the **Secure Enclave** (P-256 via `SecKeyCreate…`
  with `.privateKeyUsage`); ChaCha/AES via CryptoKit.

### Data at rest
- Message plaintext lives in a **RAM-only ring buffer** (`RamMessageBuffer`).
- On logout / app background beyond a timeout / user-initiated secure wipe, the
  buffer and derived keys are zeroed. No plaintext is written to disk.
- Optional encrypted local persistence is opt-in and uses a Keystore/Enclave
  key gated behind biometrics.

## Metadata minimization
- No address book upload; contacts are added by out-of-band key exchange.
- Sealed-sender style envelope: the server learns the recipient but not the
  authenticated sender identity for delivered messages.
- No analytics, no crash-reporter that ships message content, no cloud backup of
  keys or messages.

## Device-integrity awareness (not evasion)
`RootAwareness` / `JailbreakAwareness` perform best-effort detection of a
rooted/jailbroken environment and surface a **warning to the user** so they can
make an informed choice. They do **not** wipe data or hide the app.

## Responsible-use note
Strong encryption protects journalists, activists, abuse survivors, and ordinary
people's private lives. SubZero is built for those uses. It is not built to
obstruct lawful investigation, and its feature set reflects that boundary.
