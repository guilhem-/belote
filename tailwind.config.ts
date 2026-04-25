import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{svelte,ts}'],
  theme: {
    extend: {
      colors: {
        felt: '#0b6b3a',
        'felt-dark': '#08502b',
        'team-ns': '#3b82f6',
        'team-ew': '#ef4444',
      },
      fontFamily: {
        card: ['"Times New Roman"', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
