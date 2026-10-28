/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#14532D',
        navActive: '#0F4D2E',
        tint: '#EAF4EC',
        page: '#F7FAF7',
        border: '#E1EBE3',
        success: '#16A34A',
        attention: '#D97706',
        significant: '#DC2626',
      },
      borderRadius: {
        card: '16px',
        control: '10px',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans Sinhala', 'sans-serif'],
        sinhala: ['Noto Sans Sinhala', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
