// netlify/functions/uploadImage.js
// Proxy para subir imágenes a imgbb sin exponer la API key al cliente.
// Recibe un JSON { image: "data:image/..." } y retorna la URL de imgbb.

const IMGBB_API = 'https://api.imgbb.com/1/upload';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const apiKey = process.env.VITE_IMGBB_API_KEY;

    if (!apiKey) {
      console.error('VITE_IMGBB_API_KEY no está configurada en Netlify');
      return { statusCode: 500, body: JSON.stringify({ error: 'API key de imgbb no configurada' }) };
    }

    // Parsear body como JSON
    let base64Image = '';
    const contentType = event.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const parsed = JSON.parse(event.body);
      base64Image = parsed.image || '';
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: 'Se espera Content-Type: application/json' }) };
    }

    if (!base64Image) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No se recibió ninguna imagen' }) };
    }

    // Limpiar el data:image/xxx;base64, prefix
    const cleanBase64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');

    // Enviar a imgbb como x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', cleanBase64);
    formData.append('name', `station_${Date.now()}`);

    const response = await fetch(IMGBB_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = await response.json();

    if (!response.ok || !data.data) {
      console.error('Error de imgbb:', data);
      return {
        statusCode: response.status || 500,
        body: JSON.stringify({ error: data.error?.message || 'Error al subir imagen a imgbb' }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: data.data.url,
        thumb: data.data.thumb?.url || null,
        deleteUrl: data.data.delete_url || null,
        medium: data.data.medium?.url || null,
        displayUrl: data.data.display_url || null,
      }),
    };
  } catch (error) {
    console.error('Error en uploadImage:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Error interno del servidor' }) };
  }
};