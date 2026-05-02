/**
 * pwaIdentity.js
 *
 * Actualiza dinamicamente la identidad de la PWA:
 * - Nombre de la app (manifest + titulo)
 * - Iconos (si hay logo subido a imgbb)
 * - Favicon del navegador
 * - Splash screen (via manifest)
 *
 * Se ejecuta despues de que loadConfig() carga la config desde Firestore.
 */

let _lastStationName = null;
let _manifestBlobUrl = null;

/**
 * Actualiza el manifest PWA, el titulo del documento y el favicon
 * con el nombre, color y logo de la estacion.
 *
 * @param {string} stationName - Nombre de la estacion
 * @param {string} [colorPrimary] - Color primario para theme_color
 * @param {string} [logoUrl] - URL del logo (imgbb) para usar como icono
 */
export function updatePWAIdentity(stationName, colorPrimary, logoUrl) {
  if (!stationName || stationName === _lastStationName) return;
  _lastStationName = stationName;

  // 1. Actualizar el titulo de la pestana del navegador
  document.title = stationName;

  // 2. Actualizar el favicon con el logo si existe
  updateFavicon(logoUrl, colorPrimary);

  // 3. Actualizar apple-touch-icon
  updateAppleTouchIcon(logoUrl);

  // 4. Crear un manifest dinamico con el nombre y logo de la estacion
  try {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      console.warn('[PWA Identity] No se encontro <link rel="manifest">');
      return;
    }

    // Usar el nombre completo — los móviles modernos muestran hasta ~30 caracteres
    const shortName = stationName.trim();

    // Iconos: si hay logo de imgbb, usarlo; si no, usar los iconos por defecto
    const icons = logoUrl
      ? [
          { src: logoUrl, sizes: '192x192', type: 'image/png' },
          { src: logoUrl, sizes: '512x512', type: 'image/png' },
          { src: logoUrl, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ]
      : [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ];

    // start_url debe ser absoluta porque el manifest se sirve como blob URL,
    // y los navegadores no pueden resolver URLs relativas desde un blob.
    const origin = window.location.origin;

    const dynamicManifest = {
      name: stationName,
      short_name: shortName,
      description: `Sistema de Cierre - ${stationName}`,
      start_url: `${origin}/`,
      scope: `${origin}/`,
      display: 'standalone',
      background_color: '#F5F5F5',
      theme_color: colorPrimary || '#CE1126',
      orientation: 'any',
      icons,
    };

    const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/json' });

    if (_manifestBlobUrl) {
      URL.revokeObjectURL(_manifestBlobUrl);
    }

    _manifestBlobUrl = URL.createObjectURL(manifestBlob);
    manifestLink.href = _manifestBlobUrl;

    console.log(`[PWA Identity] Manifest actualizado: "${stationName}"${logoUrl ? ' (con logo imgbb)' : ''}`);
  } catch (error) {
    console.error('[PWA Identity] Error actualizando manifest:', error);
  }
}

/**
 * Actualiza el favicon del navegador.
 * Si hay logo de imgbb, lo usa. Si no, genera un favicon con la inicial
 * del nombre de la estacion y el color primario.
 */
function updateFavicon(logoUrl, colorPrimary) {
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
      // Usar el logo de imgbb como favicon
      faviconLink.type = 'image/png';
      faviconLink.href = logoUrl;
    } else {
      // Generar favicon con la inicial del nombre
      const stationName = _lastStationName || 'C';
      const initial = stationName.charAt(0).toUpperCase();
      const color = colorPrimary || '#CE1126';
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      // Fondo circular con el color primario
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 64, 64);

      // Letra blanca centrada
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 40px Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(initial, 32, 34);

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