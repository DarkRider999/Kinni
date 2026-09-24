# DJ Nexus Deck Lab for Android (preview)

An installable preview of the DJ Nexus engine on Android: the Deck Lab console ([`../engine/web`](../engine/web)) in a WebView, with the engine compiled to WebAssembly and running on the WebView's audio thread. USB MIDI controllers work through `android.media.midi`, and a Pioneer DDJ-FLX4 is recognised automatically.

This is not the DJ Nexus Pro app. The Flutter app with the native engine (Oboe, `libdjnexus.so`) comes later.

## Get the APK

Every push that changes this folder or `engine/web` builds the APK on GitHub Actions ([workflow](../../.github/workflows/dj-nexus-apk.yml)) and attaches it to the **deck-lab-apk** release. On the phone:

1. Open the repository's Releases page, then **DJ Nexus Deck Lab (Android preview)**, and download `DJNexus-DeckLab.apk`.
2. Open it and allow installs from your browser or file manager when Android asks.
3. Updates install over the old version, because every build is signed with the same preview key.

## Build locally

Needs JDK 17 and the Android SDK (platform 35):

```bash
gradle -p dj-nexus-pro/android-app assembleDebug
# -> dj-nexus-pro/android-app/build/outputs/apk/debug/djnexus-decklab-debug.apk
```

## How it works

| File | Role |
|---|---|
| `MainActivity.java` | WebView serving the bundled page over `https://appassets.androidplatform.net` (a secure context for AudioWorklet), file picker for loading tracks, screen kept on, no reload on rotation |
| `MidiBridge.java` | `android.media.midi` ↔ the page: device list, open, bytes in, LED bytes out, hot-plug |
| `assets/midi-shim.js` | `navigator.requestMIDIAccess` for the page, backed by the bridge (the WebView has no Web MIDI) |
| `build.gradle.kts` | Copies the page, `djnexus.wasm` and the JS runtime from `engine/web` into the APK at build time |

`decklab-preview.keystore` is a preview-only signing key (password `android`); a store release needs its own key.
