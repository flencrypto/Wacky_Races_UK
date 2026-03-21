/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'neon-green': '#39FF14',
        'neon-red': '#FF073A',
        'racing-black': '#0a0a0a',
        'racing-dark': '#111111',
        'racing-gray': '#1a1a1a',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px #39FF14, 0 0 10px #39FF14' },
          '50%': { boxShadow: '0 0 20px #39FF14, 0 0 40px #39FF14' },
        },
      },
    },
  },
  plugins: [],
};
