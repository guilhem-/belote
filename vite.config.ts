import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

// Sur GitHub Pages, le site est servi sous /belote/. En dev local, base reste '/'.
// Override possible via env BASE_PATH (utile pour tester d'autres déploiements).
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/belote/' : '/');

export default defineConfig({
  base,
  plugins: [svelte()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@ai': fileURLToPath(new URL('./src/ai', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
      '@persistence': fileURLToPath(new URL('./src/persistence', import.meta.url)),
      '@i18n': fileURLToPath(new URL('./src/i18n', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  worker: {
    format: 'es',
  },
});
