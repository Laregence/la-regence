// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://laregencemdm.fr', // ⚠️ sans slash final (meilleure pratique)
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin/') && !page.includes('/bon-cadeau/merci'),
    }),
  ],
  vite: {
    plugins: [tailwind()],
  },
});
