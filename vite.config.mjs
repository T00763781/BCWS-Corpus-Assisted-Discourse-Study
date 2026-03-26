import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'spa',
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    rollupOptions: {
      input: {
        app: 'index.html',
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
