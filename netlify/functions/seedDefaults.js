// netlify/functions/seedDefaults.js
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const app = getApp();
    const adminAuth = app.auth();
    const adminDb = app.firestore();
    const results = { users: [], config: false, products: 0 };

    const callerToken = (event.headers.authorization || event.headers.Authorization || '').replace('Bearer ', '');
    if (!callerToken) {
      return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Token requerido' }) };
    }
    const decoded = await adminAuth.verifyIdToken(callerToken);
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get();
    if (!callerDoc.exists || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Solo administradores' }) };
    }

    const PRODUCTS_LIST = [
      { name: 'FLEX METANOL', category: 'aditivo', priceUSD: 2.50 },
      { name: 'POWER BOOSTER', category: 'aditivo', priceUSD: 3.00 },
      { name: 'STP OCTANAJE PEQUENO NARANJA', category: 'aditivo', priceUSD: 3.50 },
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

    // Seed admin
    try {
      const adminUser = await adminAuth.getUserByEmail('admin@pdv-smf.com');
      if (!adminUser) throw new Error('not found');
      results.users.push('Admin ya existe');
    } catch {
      const adminRecord = await adminAuth.createUser({ email: 'admin@pdv-smf.com', password: 'admin123', displayName: 'Administrador' });
      await adminDb.collection('users').doc(adminRecord.uid).set({ name: 'Administrador', email: 'admin@pdv-smf.com', role: 'administrador', active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      results.users.push('Admin creado (admin@pdv-smf.com / admin123)');
    }

    // Seed supervisor
    try {
      const supUser = await adminAuth.getUserByEmail('supervisor@pdv-smf.com');
      if (!supUser) throw new Error('not found');
      results.users.push('Supervisor ya existe');
    } catch {
      const supRecord = await adminAuth.createUser({ email: 'supervisor@pdv-smf.com', password: 'super123', displayName: 'Supervisor Turno' });
      await adminDb.collection('users').doc(supRecord.uid).set({ name: 'Supervisor Turno', email: 'supervisor@pdv-smf.com', role: 'supervisor', active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      results.users.push('Supervisor creado (supervisor@pdv-smf.com / super123)');
    }

    // Seed config
    const configDoc = await adminDb.collection('settings').doc('station').get();
    if (!configDoc.exists) {
      await adminDb.collection('settings').doc('station').set({ tasa1: 50.00, tasa2: 0, stationName: 'Mi Estacion de Servicio', stationRif: 'J-00000000-0', stationAddress: 'Venezuela', stationPhone: '', stationLogo: '', tanksCount: 3, islandsCount: 3, pumpsPerIsland: 2, maxCortes: 12 });
      results.config = true;
      results.users.push('Configuracion creada');
    } else {
      results.users.push('Configuracion ya existe');
    }

    // Seed products
    const productsSnapshot = await adminDb.collection('products').get();
    if (productsSnapshot.empty) {
      const batch = adminDb.batch();
      for (const product of PRODUCTS_LIST) {
        batch.set(adminDb.collection('products').doc(), { ...product, active: true, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      results.products = PRODUCTS_LIST.length;
      results.users.push(PRODUCTS_LIST.length + ' productos creados');
    } else {
      results.users.push(productsSnapshot.size + ' productos ya existen');
    }

    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(results) };
  } catch (error) {
    console.error('Seed error:', error);
    return { statusCode: 500, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: error.message || 'Error interno del servidor' }) };
  }
};