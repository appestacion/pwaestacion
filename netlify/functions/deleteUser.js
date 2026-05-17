// netlify/functions/deleteUser.js
// Elimina un usuario de Firebase Auth y su perfil de Firestore.
// Requiere autenticación de administrador.
// Protege al administrador principal de ser eliminado.
//
// SEGURIDAD v2:
//   - CORS dinámico (origen solicitado)
//   - Errores sanitizados (no expone detalles internos)
//   - Protección contra auto-eliminación

import admin from 'firebase-admin';
import { getCorsHeaders, handlePreflight, errorResponse } from '../lib/cors.js';

let initialized = false;

function getApp() {
  if (!initialized) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada en Netlify.');
    }
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    initialized = true;
  }
  return admin;
}

export const handler = async (event) => {
  // ── CORS Preflight ──
  const preflight = handlePreflight(event, 'DELETE, OPTIONS');
  if (preflight) return preflight;

  if (event.httpMethod !== 'DELETE') {
    return errorResponse(405, 'Metodo no permitido', event);
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();

    // ── Parsear y validar input ──
    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return errorResponse(400, 'Body JSON invalido', event);
    }

    const { uid } = body;

    if (!uid || typeof uid !== 'string') {
      return errorResponse(400, 'UID es requerido', event);
    }

    // ── Verificar autenticación del administrador ──
    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return errorResponse(401, 'Token requerido', event);
    }

    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return errorResponse(403, 'Solo administradores pueden eliminar usuarios', event);
    }

    // ── Protección: no permitirse auto-eliminación ──
    if (uid === decoded.uid) {
      return errorResponse(400, 'No puedes eliminar tu propia cuenta', event);
    }

    // ── Proteger al administrador principal ──
    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().email === 'admin@pdv-smf.com') {
      return errorResponse(403, 'No se puede eliminar el administrador principal', event);
    }

    // ── Borrado seguro: Auth primero (impide login), luego Firestore ──
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError) {
      console.error('Error eliminando usuario de Auth:', authError.message);
      const code = authError.code || '';
      if (code === 'auth/user-not-found') {
        return errorResponse(404, 'Usuario no encontrado en Firebase Auth', event);
      }
      return errorResponse(500, 'No se pudo eliminar el usuario de Firebase Auth', event);
    }

    // Auth eliminado — ahora eliminar perfil de Firestore
    try {
      await adminDb.collection('users').doc(uid).delete();
    } catch (firestoreError) {
      // Auth ya fue eliminado — el usuario no puede iniciar sesión.
      // Registrar pero no fallar, ya que lo importante está hecho.
      console.error('Error eliminando perfil de Firestore (Auth ya eliminado):', firestoreError.message);
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ message: 'Usuario eliminado correctamente' }),
    };
  } catch (error) {
    console.error('Error deleting user:', error.message);
    // Error genérico (no exponer detalles)
    return errorResponse(500, 'Error interno del servidor', event);
  }
};