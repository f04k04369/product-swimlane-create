import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563eb',
          foreground: '#ffffff',
        },
        muted: '#f3f4f6',
        border: '#e5e7eb',
        canvas: '#ffffff',
      },
      boxShadow: {
        card: '0 4px 18px rgba(15, 23, 42, 0.1)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
