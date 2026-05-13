import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  site: 'https://lucasvhooi.nl',
  publicDir: 'public',
  build: { format: 'file' },
});
