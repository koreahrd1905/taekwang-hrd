/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          brown: {
            light: '#463f37',
            DEFAULT: '#36302a',
            dark: '#2c2722',
          },
          gold: {
            DEFAULT: '#C5A059',
            dark: '#A68345',
          }
        }
      },
      fontFamily: {
        serif: ['"Playfair Display"', '"Noto Serif KR"', 'serif'],
        sans: ['"Inter"', '"Noto Sans KR"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
