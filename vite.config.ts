import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Three pages: the proposal (/), the prototype catalogue (/catalogue/) and the library (/library/).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        proposal: resolve(__dirname, 'index.html'),
        catalogue: resolve(__dirname, 'catalogue/index.html'),
        library: resolve(__dirname, 'library/index.html'),
      },
    },
  },
});
