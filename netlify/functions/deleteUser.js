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

export const handler = async (event) => {
  if (event.httpMethod !== 'DELETE') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();

    const { uid } = JSON.parse(event.body);

    if (!uid) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'UID es requerido' }) };
    }

    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Token requerido' }) };
    }

    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Solo administradores pueden eliminar usuarios' }) };
    }

    const userDoc = await adminDb.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data().email === 'admin@pdv-smf.com') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'No se puede eliminar el administrador principal' }) };
    }

    await adminDb.collection('users').doc(uid).delete();
    await adminAuth.deleteUser(uid);

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: 'Usuario eliminado' }) };
  } catch (error) {
    console.error('Error deleting user:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message || 'Error interno del servidor' }) };
  }
};