/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{tsx,ts,jsx,js,html}'],
  theme: {
    extend: {
      colors: {
        agent: {
          primary: '#6366f1',
          surface: 'rgba(15, 15, 25, 0.85)',
          glass: 'rgba(255, 255, 255, 0.08)',
        },
      },
      backdropBlur: {
        agent: '20px',
      },
    },
  },
  plugins: [],
};
