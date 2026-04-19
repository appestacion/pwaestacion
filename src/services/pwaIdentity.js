/**
 * pwaIdentity.js
 * 
 * Actualiza dinamicamente el nombre de la PWA (manifest + titulo)
 * con el nombre de la estacion configurada por el usuario.
 * 
 * Se ejecuta despues de que loadConfig() carga el stationName
 * desde localStorage/Firestore.
 */

let _lastStationName = null;
let _manifestBlobUrl = null;

/**
 * Actualiza el manifest PWA y el titulo del documento
 * con el nombre de la estacion proporcionado.
 * 
 * @param {string} stationName - Nombre de la estacion (ej: "Estacion San Martin")
 * @param {string} [colorPrimary] - Color primario opcional para el theme_color del manifest
 */
export function updatePWAIdentity(stationName, colorPrimary) {
  if (!stationName || stationName === _lastStationName) return;
  _lastStationName = stationName;

  // 1. Actualizar el titulo de la pestana del navegador
  document.title = stationName;

  // 2. Crear un manifest dinamico con el nombre de la estacion
  try {
    // Obtener el manifest actual desde el link existente
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) {
      console.warn('[PWA Identity] No se encontro <link rel="manifest">');
      return;
    }

    // Construir el nuevo manifest con el nombre de la estacion
    const dynamicManifest = {
      name: stationName,
      short_name: stationName.length > 12 ? stationName.substring(0, 12) : stationName,
      description: `Sistema de Cierre - ${stationName}`,
      start_url: '/',
      display: 'standalone',
      background_color: '#F5F5F5',
      theme_color: colorPrimary || '#CE1126',
      orientation: 'any',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    };

    // Crear Blob URL con el manifest actualizado
    const manifestBlob = new Blob([JSON.stringify(dynamicManifest)], { type: 'application/json' });

    // Liberar el Blob URL anterior si existe para evitar fuga de memoria
    if (_manifestBlobUrl) {
      URL.revokeObjectURL(_manifestBlobUrl);
    }

    _manifestBlobUrl = URL.createObjectURL(manifestBlob);
    manifestLink.href = _manifestBlobUrl;

    console.log(`[PWA Identity] Manifest actualizado: "${stationName}"`);
  } catch (error) {
    console.error('[PWA Identity] Error actualizando manifest:', error);
  }
}