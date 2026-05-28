// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png', 'logo.svg', 'PDVSA.png', 'manifest.json'],
      // FIX: Eliminado el manifest duplicado de aqui.
      // Ahora solo se usa public/manifest.json como estatico,
      // y pwaIdentity.js lo sobreescribe dinamicamente desde Firestore.
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        navigateFallback: '/index.html',
        // FIX: Activar inmediatamente el nuevo Service Worker sin esperar a que se cierren todas las pestañas.
        // Sin esto, el SW viejo sigue sirviendo index.html con hashes de JS antiguos,
        // lo que produce el error MIME type "text/html" cuando el navegador pide un JS que ya no existe.
        skipWaiting: true,
        // FIX: El nuevo SW toma control de todos los clientes inmediatamente.
        // Sin esto, las pestañas abiertas siguen usando el SW viejo hasta recargar.
        clientsClaim: true,
        // FIX: Eliminar caches de versiones anteriores del Service Worker.
        // Sin esto, los precache viejos acumulan y pueden causar conflictos.
        cleanupOutdatedCaches: true,
        // FIX: Limitar el numero de caches para evitar llenar el almacenamiento del navegador
        // y que el navegador evicte caches de forma impredecible (lo que causa el MIME error).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB max por archivo
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
          }
        ]
      },
    }),
  ],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    host: true,
    // FIX M4: CSP para el dev server directo (npm run dev sin Netlify Dev).
    // Permite blob: para el manifest dinámico y los recursos de Firebase/Fonts.
    headers: {
      'Content-Security-Policy': "default-src 'self'; manifest-src blob: 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data: https:; connect-src 'self' https://firestore.googleapis.com https://firebaseinstallations.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://apis.google.com https://firebasestorage.googleapis.com; worker-src 'self' blob:; frame-ancestors 'none'",
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});