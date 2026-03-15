/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#eef1fe',
          100: '#d6dcfd',
          200: '#b3bdfb',
          300: '#8494f8',
          400: '#6575f4',
          500: '#4F6CF7',
          600: '#3a55e8',
          700: '#2f44cc',
          800: '#2737a5',
          900: '#253282',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Sora"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
