// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://dreamy-scone-d1ec11.netlify.app', // ton URL (à changer plus tard si domaine)
  vite: {
    plugins: [tailwind()], // ✅ Tailwind v4 via Vite
  },
});
