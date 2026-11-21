import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'color-mix(in srgb, var(--brand) calc(<alpha-value> * 100%), transparent)',
        'brand-2': 'color-mix(in srgb, var(--brand-2) calc(<alpha-value> * 100%), transparent)',
        'on-brand': 'color-mix(in srgb, var(--on-brand) calc(<alpha-value> * 100%), transparent)',
        teal: '#0E6B6A',
        navy: '#14213D',
        saffron: '#F2A541',
        ground: '#FBFAF7',
        ink: { DEFAULT: '#14213D', soft: '#3B4560', muted: '#5A6378' },
        line: { DEFAULT: '#E4E6EC', soft: '#ECEDF1', strong: '#CDD1DA' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Sinhala"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
