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
      '/arcgis/evacuation': {
        target:
          'https://wfnews-prd.bcwildfireservices.com/services6/ubm4tcTYICKBpist/ArcGIS/rest/services/Evacuation_Orders_and_Alerts',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/arcgis\/evacuation/, ''),
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
