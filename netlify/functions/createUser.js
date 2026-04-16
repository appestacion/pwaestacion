// netlify/functions/createUser.js
import admin from 'firebase-admin';

let initialized = false;

function getApp() {
  if (!initialized) {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT no configurada. Agregala en .env y en Netlify > Environment variables.');
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();

    const { name, email, password, role } = JSON.parse(event.body);

    if (!name || !email || !password || !role) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Todos los campos son requeridos' }) };
    }

    if (password.length < 6) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'La contrasena debe tener al menos 6 caracteres' }) };
    }

    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Token requerido' }) };
    }

    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Solo administradores pueden crear usuarios' }) };
    }

    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: name,
      disabled: false
    });

    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email: email.toLowerCase().trim(),
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userRecord.uid, name, email: userRecord.email, role, active: true })
    };
  } catch (error) {
    console.error('Error creating user:', error);
    let statusCode = 500;
    let errorMessage = error.message || 'Error interno del servidor';
    if (error.code === 'auth/email-already-exists') { statusCode = 409; errorMessage = 'El correo electronico ya esta registrado'; }
    else if (error.code === 'auth/invalid-email') { statusCode = 400; errorMessage = 'Correo electronico invalido'; }
    else if (error.code === 'auth/weak-password') { statusCode = 400; errorMessage = 'La contrasena es demasiado debil'; }
    return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: errorMessage }) };
  }
};