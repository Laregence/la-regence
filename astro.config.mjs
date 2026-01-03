// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://laregencemdm.fr/', // ton domaine
  vite: {
    plugins: [tailwind()],
  },
});
