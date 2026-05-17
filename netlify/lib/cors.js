// netlify/lib/cors.js
// Librería compartida de CORS y seguridad para TODAS las Netlify Functions.
// Unifica el manejo de orígenes permitidos, preflight y sanitización de errores.
//
// USO en cada function:
//   import { corsHeaders, getCorsHeaders, handlePreflight, sanitizeError, ALLOWED_ORIGINS } from '../lib/cors.js';

// ── Orígenes permitidos (agrega tu dominio de producción aquí) ──
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8888',
  'https://appestacion.netlify.app',
].filter(Boolean);

// ── Roles válidos para asignar a usuarios (evita roles arbitrarios) ──
const VALID_ROLES = ['administrador', 'supervisor', 'operador'];

// ── Tamaño máximo del payload de imagen (5 MB en base64 ≈ 6.7M chars) ──
const MAX_IMAGE_PAYLOAD_SIZE = 7 * 1024 * 1024;

/**
 * Obtiene los headers CORS dinámicamente según el Origin de la petición.
 * Si el Origin no está en la lista blanca, NO envía ACAO (el navegador bloquea).
 * Esto reemplaza el bug anterior que solo retornaba ALLOWED_ORIGINS[0].
 */
function getCorsHeaders(event) {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';

  // Verificar si el origen está permitido
  const isAllowed = ALLOWED_ORIGINS.some(
    (allowed) => allowed.toLowerCase() === requestOrigin.toLowerCase()
  );

  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  if (isAllowed) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }
  // Si no está permitido, NO enviamos ACAO → el navegador bloquea la respuesta.

  return headers;
}

/**
 * Headers CORS estáticos con el primer origen (para respuestas de error
 * donde no tenemos el event completo).
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS[0] || '',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

/**
 * Maneja petición OPTIONS (preflight CORS).
 * Retorna la respuesta preflight si corresponde, o null si no es OPTIONS.
 */
function handlePreflight(event, methods = 'GET, POST, PUT, DELETE, OPTIONS') {
  if (event.httpMethod === 'OPTIONS') {
    const headers = getCorsHeaders(event);
    headers['Access-Control-Allow-Methods'] = methods;
    return { statusCode: 204, headers, body: '' };
  }
  return null;
}

/**
 * Valida que un rol sea uno de los permitidos.
 * Retorna true si es válido, false si no.
 */
function isValidRole(role) {
  return VALID_ROLES.includes(role);
}

/**
 * Sanitiza mensajes de error para respuestas HTTP.
 * Oculta detalles internos (stack traces, Firebase error codes) en producción.
 * En desarrollo (localhost), permite ver el error real para debugging.
 */
function sanitizeError(error, isDev = false) {
  // En desarrollo, mostrar el error real
  if (isDev) {
    return error?.message || 'Error interno del servidor';
  }
  // En producción, nunca exponer detalles internos
  return 'Error interno del servidor';
}

/**
 * Construye la respuesta de error estándar.
 */
function errorResponse(statusCode, message, event) {
  return {
    statusCode,
    headers: getCorsHeaders(event),
    body: JSON.stringify({ error: message }),
  };
}

export {
  ALLOWED_ORIGINS,
  VALID_ROLES,
  MAX_IMAGE_PAYLOAD_SIZE,
  corsHeaders,
  getCorsHeaders,
  handlePreflight,
  isValidRole,
  sanitizeError,
  errorResponse,
};