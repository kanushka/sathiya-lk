import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://sathiya.lk',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
