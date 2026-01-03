// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://laregencemdm.fr', // ⚠️ sans slash final (meilleure pratique)
  integrations: [sitemap()],
  vite: {
    plugins: [tailwind()],
  },
});
