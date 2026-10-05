import type { Config } from 'tailwindcss';

/**
 * Design tokens for an official state-government administrative console:
 * deep navy chrome, saffron as the single action accent, and a severity
 * ramp that is used identically by the map, the charts, the badges and
 * the tables so a colour always means the same thing.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#040910',
          900: '#071429',
          850: '#0a1c38',
          800: '#0e2547',
          700: '#143059',
          600: '#1c3f70',
        },
        saffron: {
          800: '#8a4808',
          700: '#b25d0d',
          600: '#e07b12',
          500: '#ff9933',
          400: '#ffab55',
          300: '#ffc182',
        },
        severity: {
          high: '#ef4444',
          medium: '#f97316',
          low: '#22c55e',
          unknown: '#64748b',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans Devanagari',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        panel: '0 10px 40px -18px rgba(0,0,0,0.9)',
        focus: '0 0 0 2px rgba(255,153,51,0.6)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        ping2: {
          '0%': { transform: 'scale(0.7)', opacity: '0.85' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        kenburns: {
          '0%': { transform: 'scale(1)' },
          '100%': { transform: 'scale(1.09)' },
        },
        heroFadeIn: {
          '0%': { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 340ms cubic-bezier(0.22,1,0.36,1) both',
        shimmer: 'shimmer 1.6s infinite',
        ping2: 'ping2 1.9s ease-out infinite',
        kenburns: 'kenburns 7s ease-out forwards',
        heroFadeIn: 'heroFadeIn 700ms cubic-bezier(0.22,1,0.36,1) both',
      },
    },
  },
  plugins: [],
};

export default config;
