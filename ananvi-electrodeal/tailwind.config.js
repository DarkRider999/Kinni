/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#02050d',
          900: '#040d1a',
          800: '#071428',
          700: '#0a1f3d',
          600: '#0d2a52',
        },
        electric: {
          blue: '#0066ff',
          cyan: '#00d4ff',
          glow: '#00aaff',
        },
        silver: {
          100: '#f0f4f8',
          200: '#e2e8f0',
          400: '#94a3b8',
          600: '#475569',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      backgroundImage: {
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
        'electric-gradient': 'linear-gradient(135deg, #0066ff 0%, #00d4ff 100%)',
        'navy-gradient': 'linear-gradient(180deg, #02050d 0%, #071428 50%, #02050d 100%)',
        'card-glow': 'radial-gradient(ellipse at center, rgba(0,102,255,0.15) 0%, transparent 70%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0,102,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)',
        'electric': '0 0 20px rgba(0,102,255,0.4), 0 0 40px rgba(0,212,255,0.2)',
        'neon': '0 0 10px rgba(0,212,255,0.6), 0 0 30px rgba(0,212,255,0.3)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'scan': 'scan 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
      },
    },
  },
  plugins: [],
};
