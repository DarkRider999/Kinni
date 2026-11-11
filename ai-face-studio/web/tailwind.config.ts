import type { Config } from 'tailwindcss';

export default {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Work Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#0A0A0F',
          900: '#120F1A',
          800: '#171423',
          700: '#201C30',
        },
        line: 'rgba(255,255,255,0.08)',
        accent: {
          purple: '#8B5CF6',
          purpleSoft: '#C4B5FD',
          blue: '#3B82F6',
          cyan: '#22D3EE',
          cyanSoft: '#67E8F9',
          teal: '#2DD4BF',
          amber: '#FBBF24',
          green: '#34D399',
          red: '#F87171',
        },
      },
      boxShadow: {
        glow: '0 8px 30px rgba(139, 92, 246, 0.35)',
        glowCyan: '0 8px 30px rgba(34, 211, 238, 0.3)',
      },
      borderRadius: {
        xl2: '18px',
      },
    },
  },
  plugins: [],
} satisfies Config;
