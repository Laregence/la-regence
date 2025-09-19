// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://dreamy-scone-d1ec11.netlify.app', // ton domaine plus tard
  vite: {
    plugins: [tailwind()],
  },
});
