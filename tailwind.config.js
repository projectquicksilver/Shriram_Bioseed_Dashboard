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
          green: '#1A7A3C',
          green2: '#22A050',
          green3: '#2DC76D',
          orange: '#E8620A',
          orange2: '#F97316',
          orange3: '#FEA64A',
          text: '#0D1F15',
          text2: '#4B6356',
          text3: '#8FAD9A',
          bg: '#F0F4F1'
        }
      },
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace']
      }
    },
  },
  plugins: [],
}
