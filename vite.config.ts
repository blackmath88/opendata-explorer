import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Pages: the proposal in two versions (/ and /v2/), the prototype catalogue (/catalogue/) and the library (/library/).
export default defineConfig({
  // GitHub project Pages uses a repository subpath; Cloudflare keeps the root.
  base: process.env.BASE_PATH || '/',
  build: {
    rollupOptions: {
      input: {
        proposal: resolve(__dirname, 'index.html'),
        proposalV2: resolve(__dirname, 'v2/index.html'),
        catalogue: resolve(__dirname, 'catalogue/index.html'),
        library: resolve(__dirname, 'library/index.html'),
      },
    },
  },
});
