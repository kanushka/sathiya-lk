// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: 'color-mix(in srgb, var(--brand) calc(<alpha-value> * 100%), transparent)',
        'brand-2': 'color-mix(in srgb, var(--brand-2) calc(<alpha-value> * 100%), transparent)',
        'on-brand': 'color-mix(in srgb, var(--on-brand) calc(<alpha-value> * 100%), transparent)',
        danger: {
          DEFAULT: 'color-mix(in srgb, var(--danger) calc(<alpha-value> * 100%), transparent)',
          soft: '#FBEFEF',
          line: '#E8C3C3',
        },
        success: { DEFAULT: '#1F6B34', soft: '#E4F2E7', line: '#CFE6D4' },
        warning: { DEFAULT: '#7A5410', soft: '#FBF1DC', line: '#F0DDB0' },
        surface: { DEFAULT: '#FAFAFB', 2: '#F4F5F7', 3: '#F1F2F5' },
        teal: '#0E6B6A',
        navy: '#14213D',
        saffron: '#F2A541',
        ground: '#FBFAF7',
        canvas: '#F3F2EE',
        ink: { DEFAULT: '#14213D', soft: '#3B4560', muted: '#5A6378' },
        line: { DEFAULT: '#E4E6EC', soft: '#ECEDF1', strong: '#CDD1DA', hover: '#9AA1B2' },
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Sinhala"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
