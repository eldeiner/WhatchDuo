import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080b',
          900: '#0c0c11',
          850: '#111117',
          800: '#16161e',
          700: '#20202b',
          600: '#2c2c3a',
          500: '#3d3d4e',
        },
        marquee: {
          50: '#fff8e6',
          200: '#ffe6a3',
          300: '#ffd775',
          400: '#f7c14b',
          500: '#eaa72c',
          600: '#c9861a',
        },
        rose: {
          400: '#f4718a',
          500: '#e25570',
        },
        mist: {
          100: '#f5f3ee',
          300: '#c9c6bd',
          400: '#a8a49a',
          500: '#7d7a72',
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
        marquee: '0 12px 40px -12px rgba(234, 167, 44, 0.45)',
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
