/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    // Disable preflight to preserve existing custom admin portal styling & button colors
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        ivory: {
          DEFAULT: '#FBF6F0',
          dark: '#F5EFEB',
          accent: '#EDE4DC',
        },
        vermilion: {
          DEFAULT: '#E65338',
          hover: '#D24227',
          subtle: 'rgba(230, 83, 56, 0.08)',
          border: 'rgba(230, 83, 56, 0.25)',
        },
        charcoal: {
          DEFAULT: '#252622',
          light: '#333530',
          dark: '#191A16',
          muted: '#454740',
        },
        muted: {
          DEFAULT: '#77766F',
          light: '#9B9A93',
          border: '#EAE2D9',
        },
        success: {
          DEFAULT: '#20845A',
          bg: 'rgba(32, 132, 90, 0.1)',
          border: 'rgba(32, 132, 90, 0.25)',
        },
        warning: {
          DEFAULT: '#C78627',
          bg: 'rgba(199, 134, 39, 0.1)',
          border: 'rgba(199, 134, 39, 0.25)',
        },
        loom: {
          teal: '#79B4B7',
          cream: '#F8F0DF',
          dark: '#18191B',
          gray: '#9D9D9D',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(37, 38, 34, 0.05), 0 1px 2px rgba(37, 38, 34, 0.04)',
        'card-hover': '0 12px 28px rgba(37, 38, 34, 0.08), 0 4px 8px rgba(37, 38, 34, 0.04)',
        'vermilion': '0 4px 14px rgba(230, 83, 56, 0.3)',
      },
    },
  },
  plugins: [],
};

