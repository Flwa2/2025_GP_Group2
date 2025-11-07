/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',             // 👈 enable class-based dark mode
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'sans-serif'] },
      colors: {
        cream: '#F4E4C1',
        'purple-gradient-start': '#8B5CF6',
        'purple-gradient-end': '#A855F7',
        'purple-light': '#C4B5FD',
        'purple-medium': '#8B5CF6',
        'orange-bright': '#F97316',
        'pink-bright': '#EC4899',
        'blue-bright': '#3B82F6',
        'yellow-bright': '#EAB308',
        'green-bright': '#10B981',
      },
      backgroundImage: {
        'purple-gradient': 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%)',
      },
    },
  },
  plugins: [],
}
