/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Global accent palette (brand red)
        red: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#e72129',
          600: '#c61d24',
          700: '#a8181f',
          800: '#8b141a',
          900: '#741116',
          950: '#3f070b',
        },
        orange: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#e72129',
          600: '#c61d24',
          700: '#a8181f',
          800: '#8b141a',
          900: '#741116',
          950: '#3f070b',
        },
        primary: {
          50: '#fff1f2',
          100: '#ffe4e6',
          200: '#fecdd3',
          300: '#fda4af',
          400: '#fb7185',
          500: '#e72129',
          600: '#c61d24',
          700: '#a8181f',
          800: '#8b141a',
          900: '#741116',
          950: '#3f070b',
        },
        // Named colors for clarity
        'spanish-red': '#e72129',
        'guardsman-red': '#c61d24',
        'lokswami-red': '#e72129',
        'lokswami-black': '#0b0b0f',
        'lokswami-surface': '#18181b',
        'lokswami-border': '#2f2f35',
        'lokswami-white': '#f4f4f5',
        'lokswami-text-secondary': '#a1a1aa',
        'lokswami-text-muted': '#71717a',
        'raisin-black': '#242024',
        'gainsboro': '#DDDDDD',
        'white-gray': '#F3F4F5',
        sidebar: {
          bg: '#111827',
          text: '#D1D5DB',
          active: '#1F2937',
        },
        background: {
          light: '#F3F4F5',
          dark: '#242024',
        },
        success: {
          500: '#10B981',
        },
        danger: {
          500: '#e72129',
        },
        warning: {
          500: '#F59E0B',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-news-ui)',
          'Noto Sans Devanagari',
          'Noto Sans',
          'Mangal',
          'Kohinoor Devanagari',
          'system-ui',
          'sans-serif',
        ],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'marquee': 'marquee 25s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
};
