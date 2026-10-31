/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        slate: {
          750: '#283548',
          850: '#151e2e',
        },
        brand: {
          dark: '#0b0f19',
          surface: '#111827',
          card: '#1e293b',
          cardHover: '#243248',
          border: '#334155',
          borderLight: '#475569',
          emerald: '#10b981',
          emeraldHover: '#059669',
          amber: '#f59e0b',
          amberHover: '#d97706',
          cyan: '#06b6d4',
          cyanHover: '#0891b2',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '"Noto Sans JP"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
