// netlify/functions/seedDefaults.js
// Siembra datos iniciales en Firestore: configuración.
// Solo se ejecuta si los datos no existen (idempotente).
// Los productos los gestiona el admin desde la app.
//
// IDENTIDAD HARDCODEADA para E/S Montaña Fresca.
// NOTA: Ya NO se crean usuarios aquí. Los usuarios se gestionan
//       directamente desde Firebase Console por el administrador.
//
// SEGURIDAD v2:
//   - CORS dinámico
//   - Errores sanitizados (no expone detalles internos)

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
  const preflight = handlePreflight(event, 'POST, OPTIONS');
  if (preflight) return preflight;

  if (event.httpMethod !== 'POST') {
    return errorResponse(405, 'Metodo no permitido', event);
  }

  try {
    const admin = getApp();
    const adminAuth = admin.auth();
    const adminDb = admin.firestore();
    const results = { config: false, messages: [] };

    // ── Verificar autenticación de administrador ──
    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return errorResponse(401, 'Token requerido', event);
    }
    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return errorResponse(403, 'Solo administradores', event);
    }

    // ── Seed config — HARDCODEADO para E/S Montaña Fresca ──
    // Solo campos operativos (tasas, dimensiones de estación).
    // Los campos de identidad (nombre, RIF, dirección, teléfono) ya están
    // hardcodeados en el frontend como constantes.
    const configDoc = await adminDb.collection('settings').doc('app_config').get();
    if (!configDoc.exists) {
      await adminDb.collection('settings').doc('app_config').set({
        tasa1: 50.00,
        tasa2: 0,
        tanksCount: 3,
        islandsCount: 3,
        pumpsPerIsland: 2,
        maxCortes: 12,
      });
      results.config = true;
      results.messages.push('Configuracion operativa creada');
    } else {
      results.messages.push('Configuracion ya existe');
    }

    results.messages.push('Productos gestionados por el admin desde la app');

    return {
      statusCode: 200,
      headers: getCorsHeaders(event),
      body: JSON.stringify(results),
    };
  } catch (error) {
    console.error('Seed error:', error.message);
    return errorResponse(500, 'Error interno del servidor', event);
  }
};