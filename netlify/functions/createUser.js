// netlify/functions/createUser.js
// Crea un nuevo usuario en Firebase Auth + Firestore.
// Requiere autenticación de administrador (token Bearer).
//
// SEGURIDAD v2:
//   - CORS dinámico (origen solicitado)
//   - Validación de roles contra lista blanca
//   - Errores sanitizados (no expone detalles internos)
//   - Validación de email y contraseña

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
  const preflight = handlePreflight(event, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
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

    const { name, email, password, role } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return errorResponse(400, 'Nombre es requerido (minimo 2 caracteres)', event);
    }

    if (!email || typeof email !== 'string') {
      return errorResponse(400, 'Correo electronico es requerido', event);
    }

    // Validación básica de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse(400, 'Correo electronico invalido', event);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return errorResponse(400, 'La contrasena debe tener al menos 6 caracteres', event);
    }

    if (password.length > 128) {
      return errorResponse(400, 'La contrasena es demasiado larga', event);
    }

    // ── Validar rol contra lista blanca ──
    if (!role || !isValidRole(role)) {
      return errorResponse(400, 'Rol invalido. Roles permitidos: administrador, supervisor, operador', event);
    }

    // ── Verificar autenticación del administrador ──
    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return errorResponse(401, 'Token requerido', event);
    }

    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return errorResponse(403, 'Solo administradores pueden crear usuarios', event);
    }

    // ── Crear usuario en Firebase Auth ──
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: name.trim(),
      disabled: false,
    });

    // ── Crear perfil en Firestore ──
    await adminDb.collection('users').doc(userRecord.uid).set({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      statusCode: 201,
      headers: getCorsHeaders(event),
      body: JSON.stringify({
        id: userRecord.uid,
        name: name.trim(),
        email: userRecord.email,
        role,
        active: true,
      }),
    };
  } catch (error) {
    console.error('Error creating user:', error.message);

    // Mapear errores conocidos de Firebase Auth
    const firebaseErrorMap = {
      'auth/email-already-exists': { status: 409, message: 'El correo electronico ya esta registrado' },
      'auth/invalid-email': { status: 400, message: 'Correo electronico invalido' },
      'auth/weak-password': { status: 400, message: 'La contrasena es demasiado debil' },
      'auth/invalid-password': { status: 400, message: 'Contrasena invalida' },
    };

    const mapped = firebaseErrorMap[error.code];
    if (mapped) {
      return errorResponse(mapped.status, mapped.message, event);
    }

    // Error genérico (no exponer detalles)
    return errorResponse(500, 'Error interno del servidor', event);
  }
};