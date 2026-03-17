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
    proxy: {
      '/bcws-api': {
        target: 'https://wildfiresituation.nrs.gov.bc.ca',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/bcws-api/, ''),
      },
      '/bcws-site': {
        target: 'https://wildfiresituation.nrs.gov.bc.ca',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/bcws-site/, ''),
      },
      '/wfnews-arcgis': {
        target: 'https://wfnews-prd.bcwildfireservices.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/wfnews-arcgis/, ''),
      }
    }
  }
});
