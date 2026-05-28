// netlify/functions/uploadImage.js
// Proxy para subir imágenes a imgbb sin exponer la API key al cliente.
// Recibe un JSON { image: "data:image/..." } y retorna la URL de imgbb.
//
// SEGURIDAD v3:
//   - Requiere autenticación Firebase con rol 'administrador' o 'supervisor'
//   - Valida Content-Type y tamaño del payload
//   - CORS dinámico según origen de la petición
//   - FIX M11: Variable de entorno renombrada de VITE_IMGBB_API_KEY a IMGBB_API_KEY

import { getCorsHeaders, handlePreflight, errorResponse, MAX_IMAGE_PAYLOAD_SIZE } from '../lib/cors.js';

const IMGBB_API = 'https://api.imgbb.com/1/upload';

let adminAuth = null;

async function getAdminAuth() {
  if (adminAuth) return adminAuth;
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Firebase no configurado');
    const admin = (await import('firebase-admin')).default;
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    adminAuth = admin.auth();
    return adminAuth;
  } catch (error) {
    console.error('Error inicializando Firebase Admin:', error.message);
    return null;
  }
}

export const handler = async (event) => {
  // ── CORS Preflight ──
  const preflight = handlePreflight(event, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Metodo no permitido', event);
  }

  try {
    // ── Verificar autenticación Firebase ──
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Token de autenticacion requerido', event);
    }

    const token = authHeader.split('Bearer ')[1];
    const admin = await getAdminAuth();
    if (!admin) {
      return errorResponse(500, 'Error interno del servidor', event);
    }

    let decoded;
    try {
      decoded = await admin.verifyIdToken(token);
    } catch (authError) {
      console.error('Auth verification failed:', authError.message);
      if (authError.code === 'auth/id-token-expired') {
        return errorResponse(401, 'Token expirado. Inicia sesion de nuevo', event);
      }
      return errorResponse(401, 'Token invalido', event);
    }

    // FIX H7: Verificar rol — solo administrador y supervisor pueden subir imágenes
    const userRole = decoded.role || decoded.customClaims?.role;
    if (!userRole || (userRole !== 'administrador' && userRole !== 'supervisor')) {
      return errorResponse(403, 'Sin permisos suficientes para subir imagenes', event);
    }

    // ── Validar API key de imgbb ──
    // FIX M11: Usar IMGBB_API_KEY (sin prefijo VITE_) para que no se exponga al cliente
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
      console.error('IMGBB_API_KEY no configurada en Netlify');
      return errorResponse(500, 'Servicio de imagenes no configurado', event);
    }

    // ── Validar Content-Type ──
    const contentType = event.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
      return errorResponse(400, 'Se espera Content-Type: application/json', event);
    }

    // ── Validar tamaño del payload (anti-abuso) ──
    if (event.body && event.body.length > MAX_IMAGE_PAYLOAD_SIZE) {
      return errorResponse(413, 'La imagen excede el tamano maximo permitido (5 MB)', event);
    }

    // ── Parsear body ──
    let base64Image = '';
    try {
      const parsed = JSON.parse(event.body);
      base64Image = parsed.image || '';
    } catch {
      return errorResponse(400, 'Body JSON invalido', event);
    }

    if (!base64Image) {
      return errorResponse(400, 'No se recibio ninguna imagen', event);
    }

    // ── Validar que sea una imagen base64 (no datos arbitrarios) ──
    const imageTypeMatch = base64Image.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i);
    if (!imageTypeMatch) {
      return errorResponse(400, 'Formato de imagen no soportado. Use PNG, JPEG, GIF o WebP', event);
    }

    // Limpiar el data:image/xxx;base64, prefix
    const cleanBase64 = base64Image.replace(/^data:image\/[^;]+;base64,/, '');

    // ── Enviar a imgbb ──
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
      return errorResponse(
        response.status || 502,
        data.error?.message || 'Error al subir imagen al servicio externo',
        event
      );
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        url: data.data.url,
        thumb: data.data.thumb?.url || null,
        deleteUrl: data.data.delete_url || null,
        medium: data.data.medium?.url || null,
        displayUrl: data.data.display_url || null,
      }),
    };
  } catch (error) {
    console.error('Error en uploadImage:', error.message);
    return errorResponse(500, 'Error interno del servidor', event);
  }
};