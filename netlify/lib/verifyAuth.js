// netlify/lib/verifyAuth.js
// Helpers de autenticación y seguridad para Netlify Functions

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8888',
  'https://appestacion.netlify.app',
].filter(Boolean);

/**
 * Headers de seguridad CORS
 */
export function getSecurityHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS[0] : '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

/**
 * Manejar petición CORS preflight
 */
export function handleCorsPreflight(event, headers) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }
  return null;
}

/**
 * Verificar autenticación Firebase desde el header Authorization
 */
export async function verifyAuth(event, { allowedRoles = [] } = {}) {
  try {
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return { authenticated: false, error: 'Token no proporcionado' };
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      return { authenticated: false, error: 'Token vacío' };
    }

    const admin = await import('firebase-admin');
    const decoded = await admin.auth().verifyIdToken(token);

    if (allowedRoles.length > 0) {
      const userRole = decoded.role || decoded.customClaims?.role;
      if (!allowedRoles.includes(userRole)) {
        return { authenticated: false, error: 'Sin permisos suficientes' };
      }
    }

    return {
      authenticated: true,
      uid: decoded.uid,
      role: decoded.role || decoded.customClaims?.role || 'user',
      email: decoded.email,
    };
  } catch (error) {
    console.error('Error verifying auth:', error.message);
    if (error.code === 'auth/id-token-expired') {
      return { authenticated: false, error: 'Token expirado' };
    }
    return { authenticated: false, error: 'Token inválido' };
  }
}