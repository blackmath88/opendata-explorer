import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Proposal, evidence workbench, and the experimental network navigator.
export default defineConfig({
  // GitHub project Pages uses a repository subpath; Cloudflare keeps the root.
  base: process.env.BASE_PATH || '/',
  build: {
    rollupOptions: {
      input: {
        proposal: resolve(__dirname, 'index.html'),
        catalogue: resolve(__dirname, 'catalogue/index.html'),
        explore: resolve(__dirname, 'explore/index.html'),
      },
    },
  },
});
