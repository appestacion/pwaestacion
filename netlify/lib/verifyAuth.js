// netlify/lib/verifyAuth.js
// Helpers de autenticación y seguridad para Netlify Functions.
// Usa cors.js compartido para manejo dinámico de orígenes.

import { getCorsHeaders, handlePreflight, sanitizeError, corsHeaders } from './cors.js';

/**
 * Headers de seguridad CORS (LEGACY — usa getCorsHeaders(event) en su lugar).
 * Se mantiene para compatibilidad con auto-update-rate.js.
 */
export function getSecurityHeaders() {
  return corsHeaders;
}

/**
 * Manejar petición CORS preflight
 */
export function handleCorsPreflight(event, headers) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: getCorsHeaders(event),
      body: '',
    };
  }
  return null;
}

/**
 * Verificar autenticación Firebase desde el header Authorization.
 * Retorna { authenticated, uid, role, email } o { authenticated: false, error }.
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

// Re-exportar lo que necesitan las otras funciones
export { getCorsHeaders, handlePreflight, sanitizeError, corsHeaders } from './cors.js';