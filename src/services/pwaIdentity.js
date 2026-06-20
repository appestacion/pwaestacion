/**
 * pwaIdentity.js
 *
 * Identidad PWA exclusiva para E/S Montaña Fresca.
 *
 * ARQUITECTURA (nueva):
 *   Toda la identidad PWA vive en archivos estáticos servidos por Netlify/Vite:
 *     - public/manifest.json  (manifest completo, cacheable por el SW)
 *     - index.html            (meta tags, theme-color, apple-touch-icon, title)
 *
 *   Este módulo YA NO crea Blob URLs ni reescribe el <link rel="manifest">.
 *   Solo expone updatePWAIdentity() como función idempotente para preservar
 *   la API del import existente en App.jsx (backward compatible).
 *
 * RAZONES PARA ELIMINAR EL BLOB URL:
 *   1. Chrome trata algunos manifests Blob URL como no confiables para
 *      instalación PWA (especialmente en Android).
 *   2. Cada Blob URL es única -> no se cachea bien en el SW -> rompe offline.
 *   3. El manifest estático en /manifest.json es el patrón estándar PWA,
 *      soportado por todas las herramientas de validación (Lighthouse incluido).
 *   4. Permite que vite-plugin-pwa lo incluya en el precache automáticamente
 *      (ya está en includeAssets del vite.config.js).
 */

const STATION_NAME = 'E/S Montaña Fresca';

let _initialized = false;

/**
 * Inicializa la identidad PWA.
 * Idempotente. No destructiva.
 *
 * Toda la configuración real vive en:
 *   - public/manifest.json
 *   - index.html (meta tags + title)
 *
 * Esta función solo:
 *   1. Verifica que el <link rel="manifest"> esté correctamente cargado.
 *   2. Restaura el href estático si por algún motivo fue alterado.
 *   3. Asegura que document.title sea el correcto (defensivo).
 *   4. Loguea el estado para diagnóstico.
 */
export function updatePWAIdentity() {
  if (_initialized) return;
  _initialized = true;

  try {
    // 1. Verificar que el <link rel="manifest"> existe y apunta al estático.
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      console.warn('[PWA Identity] No se encontró <link rel="manifest"> en index.html');
      return;
    }

    // 2. Si el href fue alterado (p.ej. por código legacy), restaurarlo.
    const expectedHref = '/manifest.json';
    const currentPath = manifestLink.getAttribute('href');
    if (currentPath !== expectedHref) {
      manifestLink.setAttribute('href', expectedHref);
      console.log('[PWA Identity] manifest href restaurado a /manifest.json');
    }

    // 3. Title defensivo (por si algo lo sobreescribió en runtime).
    if (document.title !== STATION_NAME) {
      document.title = STATION_NAME;
    }

    console.log(`[PWA Identity] Inicializada (manifest estático): "${STATION_NAME}"`);
  } catch (error) {
    console.error('[PWA Identity] Error:', error);
  }
}