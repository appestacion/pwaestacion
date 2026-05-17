// netlify/functions/updateUser.js
// Actualiza datos de un usuario existente (nombre, rol, estado, contraseña).
// Requiere autenticación de administrador (token Bearer).
//
// SEGURIDAD v2:
//   - CORS dinámico (origen solicitado)
//   - Validación de roles contra lista blanca
//   - Errores sanitizados (no expone detalles internos)
//   - Protección contra auto-descenso de rol

import admin from 'firebase-admin';
import { getCorsHeaders, handlePreflight, isValidRole, errorResponse } from '../lib/cors.js';

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
  const preflight = handlePreflight(event, 'PUT, OPTIONS');
  if (preflight) return preflight;

  if (event.httpMethod !== 'PUT') {
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

    const { uid, name, role, active, password } = body;

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
      return errorResponse(403, 'Solo administradores pueden actualizar usuarios', event);
    }

    // ── Validar rol contra lista blanca (si se está actualizando el rol) ──
    if (role !== undefined && !isValidRole(role)) {
      return errorResponse(400, 'Rol invalido. Roles permitidos: administrador, supervisor, operador', event);
    }

    // ── Protección: evitar que un admin se quite permisos a sí mismo ──
    if (uid === decoded.uid && role !== undefined && role !== 'administrador') {
      return errorResponse(400, 'No puedes cambiar tu propio rol', event);
    }
    if (uid === decoded.uid && active === false) {
      return errorResponse(400, 'No puedes desactivarte a ti mismo', event);
    }

    // ── Validar contraseña si se proporciona ──
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        return errorResponse(400, 'La contrasena debe tener al menos 6 caracteres', event);
      }
      if (password.length > 128) {
        return errorResponse(400, 'La contrasena es demasiado larga', event);
      }
    }

    // ── Actualizar perfil en Firestore ──
    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined) updateData.name = String(name).trim();
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = Boolean(active);

    await adminDb.collection('users').doc(uid).update(updateData);

    // ── Actualizar contraseña en Firebase Auth (si se proporcionó) ──
    if (password && password.length >= 6) {
      await adminAuth.updateUser(uid, { password });
    }

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify({ message: 'Usuario actualizado correctamente' }),
    };
  } catch (error) {
    console.error('Error updating user:', error.message);

    // Mapear errores conocidos de Firebase Auth
    const firebaseErrorMap = {
      'auth/user-not-found': { status: 404, message: 'Usuario no encontrado' },
      'auth/invalid-password': { status: 400, message: 'Contrasena invalida' },
      'auth/weak-password': { status: 400, message: 'La contrasena es demasiado debil' },
    };

    const mapped = firebaseErrorMap[error.code];
    if (mapped) {
      return errorResponse(mapped.status, mapped.message, event);
    }

    // Error genérico (no exponer detalles)
    return errorResponse(500, 'Error interno del servidor', event);
  }
};