// netlify/functions/deleteUser.js
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
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();

    const { uid } = JSON.parse(event.body);

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
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Solo administradores pueden eliminar usuarios' }) };
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().email === 'admin@pdv-smf.com') {
      return { statusCode: 403, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No se puede eliminar el administrador principal' }) };
    }

    // Borrado seguro: eliminar Auth primero (impide inicio de sesión),
    // luego Firestore. Si Auth falla, no tocamos Firestore.
    // Si Firestore falla después, el usuario queda sin Auth (estado seguro).
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError) {
      console.error('Error eliminando usuario de Auth:', authError.message);
      const code = authError.code || '';
      if (code === 'auth/user-not-found') {
        return { statusCode: 404, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Usuario no encontrado en Firebase Auth' }) };
      }
      return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: 'No se pudo eliminar el usuario de Firebase Auth' }) };
    }

    // Auth eliminado correctamente, ahora eliminar perfil de Firestore
    try {
      await adminDb.collection('users').doc(uid).delete();
    } catch (firestoreError) {
      // Auth ya fue eliminado — el usuario no puede iniciar sesión.
      // Registrar el error pero no fallar, ya que lo importante (Auth) está hecho.
      console.error('Error eliminando perfil de Firestore (Auth ya eliminado):', firestoreError.message);
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ message: 'Usuario eliminado' }) };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: error.message || 'Error interno del servidor' }) };
  }
};