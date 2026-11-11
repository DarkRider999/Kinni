import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { config } from './config';
import './styles/globals.css';

/** Apply the configured accent colour to the --blue token family. */
function applyAccent(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return;
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * 0.25);
  const root = document.documentElement.style;
  root.setProperty('--blue', `#${match[1]}`);
  root.setProperty('--blue-light', `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`);
  root.setProperty('--blue-dim', `rgba(${r}, ${g}, ${b}, 0.15)`);
}

applyAccent(config.accentColor);
document.title = `${config.appName} · ${config.storeName}`;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
