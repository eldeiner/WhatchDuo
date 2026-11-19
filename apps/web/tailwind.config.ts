import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06090e',
          900: '#090e17',
          850: '#0e1522',
          800: '#131e30',
          700: '#1b2a42',
          600: '#253856',
          500: '#344b6f',
        },
        sky: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        marquee: {
          50: '#f0f9ff',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8', // Celeste principal
          500: '#0ea5e9',
          600: '#0284c7',
        },
        rose: {
          400: '#f4718a',
          500: '#e25570',
        },
        mist: {
          100: '#f0f6fc',
          300: '#c5d3e3',
          400: '#94a7be',
          500: '#64748b',
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
          'sans-serif',
        ],
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        marquee: '0 12px 40px -12px rgba(56, 189, 248, 0.45)',
        panel: '0 24px 60px -30px rgba(0, 0, 0, 0.9)',
      },
      keyframes: {
        drift: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '1' },
          '100%': {
            transform: 'translateY(calc(-1 * var(--drift-distance, 140px))) scale(1.45)',
            opacity: '0',
          },
        },
        'fade-up': {
          '0%': { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
      },
      animation: {
        drift: 'drift 3.2s ease-out forwards',
        'fade-up': 'fade-up 240ms ease-out both',
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
