import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * XAMOTO — Application web (PWA).
 *
 * En développement, l'interface est servie par Vite et les appels `/api` sont
 * relayés vers le serveur Fastify (port 3000). En production, le serveur XAMOTO
 * sert directement `app/web/dist` : un seul service, un seul port.
 *
 * `allowedHosts: true` est nécessaire pour l'accès via un domaine de préversion :
 * le navigateur appelle les API en URL RELATIVE (`/api/...`), jamais une adresse
 * locale, et c'est Vite qui relaie vers le backend.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.XAMOTO_API_URL ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2022',
  },
});
