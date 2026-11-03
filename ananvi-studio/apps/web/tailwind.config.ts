import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#f5c518', hover: '#ffd740', dark: '#d4a800' },
        surface: { base: '#0a0a0a', card: '#111111', input: '#1a1a1a', hover: '#222222', border: '#2a2a2a' },
        muted: { DEFAULT: '#666666', light: '#aaaaaa' },
        success: '#22c55e',
        danger: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};

export default config;
