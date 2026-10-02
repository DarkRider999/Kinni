import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mixforge.studio',
  appName: 'MixForge Studio',
  webDir: 'dist',
  // https (not the default capacitor:// scheme) gives the WebView a secure context, which the
  // Web Audio API's AudioWorklet path and the PWA service worker (src/main.tsx) both expect.
  server: {
    androidScheme: 'https',
  },
}

export default config

