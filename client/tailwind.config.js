/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f0f7ff', 100: '#e0effe', 200: '#bae0fd', 300: '#7cc8fb', 400: '#36adf6', 500: '#0c93e7', 600: '#0074c5', 700: '#015c9f', 800: '#064e83', 900: '#0b416d' },
      }
    }
  },
  plugins: [],
};
