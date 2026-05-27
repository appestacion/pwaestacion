// netlify/functions/seedDefaults.js
// Siembra datos iniciales en Firestore: configuración y productos.
// Solo se ejecuta si los datos no existen (idempotente).
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
    const results = { config: false, products: 0, messages: [] };

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

    const PRODUCTS_LIST = [
      { name: 'FLEX METANOL', category: 'aditivo', priceUSD: 2.50 },
      { name: 'POWER BOOSTER', category: 'aditivo', priceUSD: 3.00 },
      { name: 'STP OCTANAJE PEQUEÑO NARANJA', category: 'aditivo', priceUSD: 3.50 },
      { name: 'STP NEGRO', category: 'aditivo', priceUSD: 4.00 },
      { name: 'STP GRIS', category: 'aditivo', priceUSD: 3.50 },
      { name: 'STP BLANCO', category: 'aditivo', priceUSD: 3.00 },
      { name: 'STP DIRECCION', category: 'aditivo', priceUSD: 4.50 },
      { name: 'ACEITE DE MOTOR KYOTO FULL SINT.', category: 'aceite', priceUSD: 18.00 },
      { name: 'ACEITE OLISTONE 20W-50 MINERAL', category: 'aceite', priceUSD: 12.00 },
      { name: 'ACEITE SKY EVOLUB SEMISINTETICO 15W-40', category: 'aceite', priceUSD: 14.00 },
      { name: 'ACEITE SKY DEXRON III', category: 'aceite', priceUSD: 10.00 },
      { name: 'PDV MULTIGRADO EXTRA 20W50', category: 'aceite', priceUSD: 11.00 },
      { name: 'PDV SUPRA PREMIUM 14W40', category: 'aceite', priceUSD: 13.00 },
      { name: 'PDV MOTO PREMIUM 4T 20W50', category: 'aceite', priceUSD: 8.00 },
      { name: 'ACEITE VALVOLINE 20W-50 MINERAL', category: 'aceite', priceUSD: 15.00 },
      { name: 'ACEITE VALVOLINE 15W-40 MINERAL', category: 'aceite', priceUSD: 14.00 },
      { name: 'ACEITE VALVOLINE 20W-50 SEMISINTETICO', category: 'aceite', priceUSD: 18.00 },
      { name: 'ACEITE VALVOLINE 15W-40 SEMISINTETICO', category: 'aceite', priceUSD: 17.00 },
      { name: 'ACEITE FC 20W-50 MINERAL', category: 'aceite', priceUSD: 10.00 },
      { name: 'ACEITE FC 15W-40 MINERAL', category: 'aceite', priceUSD: 9.00 },
      { name: 'ACEITE FC TRANSM. DEXRON III', category: 'aceite', priceUSD: 8.00 },
      { name: 'ACEITE FC 15W-40 SEMISINTETICO', category: 'aceite', priceUSD: 11.00 },
      { name: 'REFIGERANTE DR. CARE', category: 'refrigerante', priceUSD: 5.00 },
      { name: 'ACEITE INCA 15W-40 MINERAL', category: 'aceite', priceUSD: 9.00 },
      { name: 'ACEITE INCA 15W-40 SEMISINTETICO', category: 'aceite', priceUSD: 11.00 },
      { name: 'ACEITE INCA 20W-50 MINERAL', category: 'aceite', priceUSD: 10.00 },
      { name: 'ACEITE INCA DEXRON III', category: 'aceite', priceUSD: 8.00 },
      { name: 'ROSHFRANS 15W-40 SEMISINTETICO', category: 'aceite', priceUSD: 12.00 },
      { name: 'LIGA DE FRENO PEQUEÑA', category: 'freno', priceUSD: 3.00 },
      { name: 'LIGA DE FRENO GRANDE', category: 'freno', priceUSD: 5.00 },
      { name: 'EXTINTOR PELOTA', category: 'extintor', priceUSD: 15.00 },
    ];

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

    // ── Seed products ──
    const productsSnapshot = await adminDb.collection('products').get();
    if (productsSnapshot.empty) {
      const batch = adminDb.batch();
      for (const product of PRODUCTS_LIST) {
        batch.set(adminDb.collection('products').doc(), {
          ...product,
          active: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
      results.products = PRODUCTS_LIST.length;
      results.messages.push(PRODUCTS_LIST.length + ' productos creados');
    } else {
      results.messages.push(productsSnapshot.size + ' productos ya existen');
    }

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