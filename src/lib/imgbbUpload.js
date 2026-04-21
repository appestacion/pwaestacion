// src/lib/imgbbUpload.js
// Utilidad para subir imágenes a imgbb a través del proxy de Netlify Function.
// La API key nunca se expone al navegador.

/**
 * Sube una imagen (File object) a imgbb vía Netlify Function proxy.
 * Retorna: { url, thumb, deleteUrl, medium, displayUrl }
 */
export async function uploadImageToImgbb(file) {
  if (!file) throw new Error('No se proporcionó ningún archivo');

  if (!file.type.startsWith('image/')) {
    throw new Error('Solo se permiten archivos de imagen');
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error('La imagen no debe superar 5MB');
  }

  const base64 = await fileToBase64(file);

  const response = await fetch('/.netlify/functions/uploadImage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64 }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Error al subir la imagen');
  }

  return result;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(file);
  });
}

/**
 * Sube una imagen desde una URL existente (útil para re-subir).
 */
export async function uploadUrlToImgbb(imageUrl) {
  if (!imageUrl) throw new Error('No se proporcionó URL');

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('No se pudo descargar la imagen');

  const blob = await response.blob();
  const file = new File([blob], 'image.jpg', { type: blob.type || 'image/jpeg' });

  return uploadImageToImgbb(file);
}