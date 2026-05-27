/**
 * pwaIdentity.js
 *
 * Identidad PWA exclusiva para E/S Montaña Fresca.
 * Todos los valores son constantes fijas.
 * Se ejecuta una sola vez al cargar la app.
 */

const STATION_NAME = 'E/S Montaña Fresca';
const STATION_SHORT_NAME = 'Montaña Fresca';
const STATION_RIF = 'J-30894985-2';
const STATION_ADDRESS = 'AV. CASANOVA GODOY ZONA INDUSTRIAL, Aragua - Venezuela';
const STATION_PHONE = '0424 3036024';
const DEFAULT_LOGO = '/LogoMF.jpg';
const COLOR_PRIMARY = '#CE1126';

let _initialized = false;
let _manifestBlobUrl = null;

/**
 * Inicializa la identidad PWA con los valores fijos de E/S Montaña Fresca.
 * Solo se ejecuta una vez (idempotente).
 */
export function updatePWAIdentity() {
  if (_initialized) return;
  _initialized = true;

  // 1. Actualizar el título de la pestaña del navegador
  document.title = STATION_NAME;

  // 2. Actualizar el favicon
  updateFavicon(DEFAULT_LOGO);

  // 3. Actualizar apple-touch-icon
  updateAppleTouchIcon(DEFAULT_LOGO);

  // 4. Crear manifest dinámico con la identidad fija
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      console.warn('[PWA Identity] No se encontró <link rel="manifest">');
      return;
    }

    const origin = window.location.origin;

    // FIX: Usar URLs absolutas (origin + path) para los íconos.
    // Cuando el manifest se crea como Blob URL, las rutas relativas
    // como "/LogoMF.jpg" no resuelven correctamente desde blob: origin.
    // Chrome muestra "Manifest: property 'src' ignored, URL is invalid".
    const dynamicManifest = {
      name: STATION_NAME,
      short_name: STATION_SHORT_NAME,
      description: `E/S Montaña Fresca — ${STATION_RIF} — Sistema de Cierre de Turno`,
      start_url: `${origin}/`,
      display: 'standalone',
      background_color: '#F5F5F5',
      theme_color: COLOR_PRIMARY,
      orientation: 'any',
      icons: [
        { src: `${origin}/LogoMF.jpg`, sizes: '192x192', type: 'image/jpeg' },
        { src: `${origin}/LogoMF.jpg`, sizes: '512x512', type: 'image/jpeg' },
        { src: `${origin}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
        { src: `${origin}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
        { src: `${origin}/icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };

    const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/json' });

    if (_manifestBlobUrl) {
      URL.revokeObjectURL(_manifestBlobUrl);
    }

    _manifestBlobUrl = URL.createObjectURL(manifestBlob);
    manifestLink.href = _manifestBlobUrl;

    console.log(`[PWA Identity] Inicializada: "${STATION_NAME}" (short: "${STATION_SHORT_NAME}")`);
  } catch (error) {
    console.error('[PWA Identity] Error actualizando manifest:', error);
  }
}

/**
 * Actualiza el favicon del navegador.
 * Usa el logo de E/S Montaña Fresca.
 */
function updateFavicon(logoUrl) {
  try {
    let faviconLink = document.querySelector('link[rel="icon"][type="image/x-icon"]') ||
                      document.querySelector('link[rel="icon"]') ||
                      document.querySelector('link[rel="shortcut icon"]');

    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }

    if (logoUrl) {
      faviconLink.type = 'image/jpeg';
      faviconLink.href = logoUrl;
    } else {
      // Generar favicon con la "M" de Montaña
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      ctx.fillStyle = COLOR_PRIMARY;
      ctx.fillRect(0, 0, 64, 64);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 40px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('M', 32, 34);

      faviconLink.type = 'image/png';
      faviconLink.href = canvas.toDataURL('image/png');
    }
  } catch (error) {
    console.error('[PWA Identity] Error actualizando favicon:', error);
  }
}

/**
 * Actualiza el apple-touch-icon (icono en iOS/Safari).
 */
function updateAppleTouchIcon(logoUrl) {
  try {
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');

    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.rel = 'apple-touch-icon';
      document.head.appendChild(appleIcon);
    }

    if (logoUrl) {
      appleIcon.href = logoUrl;
    }
  } catch (error) {
    console.error('[PWA Identity] Error actualizando apple-touch-icon:', error);
  }
}