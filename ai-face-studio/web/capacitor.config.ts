import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.splitfireproduction.aifacestudio',
  appName: 'AI Face Studio',
  // `npm run build:capacitor` runs `next build` with output: 'export' (see next.config.js) into
  // this folder — Capacitor bundles it as local assets, so the app works without a live server.
  webDir: 'out',
  backgroundColor: '#0A0A0F',
  server: {
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0A0A0F',
  },
};

export default config;
