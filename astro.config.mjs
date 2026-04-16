// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import astroI18next from 'astro-i18next';

import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  integrations: [react(), astroI18next()],

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: vercel()
});