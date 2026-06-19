// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// FIX M7: Vite plugin que fuerza Content-Type: application/javascript
// para archivos .wasm.js. Algunos servidores/proxies sirven estos archivos
// con MIME type incorrecto (application/octet-stream o application/wasm),
// lo que causa que importScripts() falle en el Worker de Tesseract.
function fixWasmJsMimeType() {
  return {
    name: 'fix-wasm-js-mime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname.endsWith('.wasm.js')) {
          const originalSetHeader = res.setHeader.bind(res);
          res.setHeader = function (name, value) {
            if (
              typeof name === 'string' &&
              name.toLowerCase() === 'content-type'
            ) {
              value = 'application/javascript; charset=utf-8';
            }
            return originalSetHeader(name, value);
          };
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    fixWasmJsMimeType(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'logo.svg', 'PDVSA.png', 'manifest.json'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // FIX M7: Excluir archivos WASM grandes de Tesseract del precache.
        // ★ FIX BUILD NETLIFY: workbox-build v7 NO acepta 'exclude' en GenerateSWOptions.
        //   La propiedad válida es 'globIgnores' (acepta los mismos patrones glob que
        //   usa fast-glob, no RegExp). Con 'exclude' workbox lanza el error:
        //   "[GenerateSW] 'exclude' property is not expected to be here".
        //   Esto rompía el deploy en Netlify aunque localmente el build pasara
        //   (local tenía workbox-build 7.4.0 cacheado; Netlify instaló 7.4.1
        //   que valida el schema con ajv de forma más estricta).
        globIgnores: [
          'tesseract/tesseract-core-*.wasm',
          'tesseract/tesseract-core-*.wasm.js',
          '**/tesseract/tesseract-core-*.wasm',
          '**/tesseract/tesseract-core-*.wasm.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } }
          },
          {
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'firestore-cache', networkTimeoutSeconds: 10, expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } }
          },
          {
            urlPattern: /^https:\/\/tessdata\.projectnaptha\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'tesseract-lang-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } }
          }
        ]
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    host: true,
    // CSP con blob: en script-src (FIX M7)
    headers: {
      'Content-Security-Policy': "default-src 'self'; manifest-src blob: 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://firebasestorage.googleapis.com https://tessdata.projectnaptha.com; worker-src 'self' blob:; frame-ancestors 'none'",
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});