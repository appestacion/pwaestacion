// netlify/functions/updateUser.js
// Actualiza datos de un usuario existente (nombre, rol, estado, contraseña).
// Requiere autenticación de administrador (token Bearer).
import admin from 'firebase-admin';

let initialized = false;

function getApp() {
  if (!initialized) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada en Netlify.');
    }
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
      });
    }
    initialized = true;
  }
  return admin;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'PUT') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();

    const { uid, name, role, active, password } = JSON.parse(event.body);

    if (!uid) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'UID es requerido' }) };
    }

    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return { statusCode: 401, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Token requerido' }) };
    }

    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Solo administradores pueden actualizar usuarios' }) };
    }

    const updateData = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (active !== undefined) updateData.active = active;

    await adminDb.collection('users').doc(uid).update(updateData);

    if (password && password.length >= 6) {
      await adminAuth.updateUser(uid, { password });
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Usuario actualizado' }) };
  } catch (error) {
    console.error('Error updating user:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Error interno del servidor' }) };
  }
};