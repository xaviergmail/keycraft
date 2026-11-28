import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { pwa } from './tools/pwa.mjs';

export default defineConfig({
  base: './',
  plugins: [svelte(), pwa()],
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
