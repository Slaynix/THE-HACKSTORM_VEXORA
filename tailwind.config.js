/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './client/**/*.html',
    './client/js/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:   '#16a34a',
          secondary: '#d97706',
          danger:    '#dc2626',
          surface:   '#f0fdf4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bounce-in': 'bounce-in 0.5s ease-out forwards',
      },
      keyframes: {
        'bounce-in': {
          '0%':   { transform: 'scale(0)', opacity: '0' },
          '50%':  { transform: 'scale(1.15)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
