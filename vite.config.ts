import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Two pages: the proposal (/) and the prototype catalogue (/catalogue/).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        proposal: resolve(__dirname, 'index.html'),
        catalogue: resolve(__dirname, 'catalogue/index.html'),
      },
    },
  },
});
