/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        civil: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc5fb',
          400: '#36a6f6',
          500: '#0c87eb',
          600: '#026bc9',
          700: '#0355a2',
          800: '#074885',
          900: '#0c3d6e',
          950: '#082749',
        },
        blueprint: {
          bg: '#0a192f',
          surface: '#112240',
          grid: '#233554',
          accent: '#64ffda',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
      }
    },
  },
  plugins: [],
}
