/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#dce8ff',
          200: '#bcd5ff',
          300: '#8ab9ff',
          400: '#5592ff',
          500: '#2d6fff',
          600: '#1a52f5',
          700: '#143de0',
          800: '#1633b5',
          900: '#182f8e',
          950: '#111c57',
        },
        dark: {
          900: '#0a0b14',
          800: '#10121f',
          700: '#161929',
          600: '#1e2235',
          500: '#252840',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-gradient': 'linear-gradient(135deg, #0a0b14 0%, #1a1f3a 50%, #0d1526 100%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}
