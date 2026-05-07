// netlify/functions/auto-update-rate.js
// Actualización automática de tasa de cambio USD/VES (CRON)
// SEGURIDAD: Requiere header secreto (X-Cron-Secret) O query param (?secret=xxx)
//           o autenticación Firebase para invocaciones manuales
//
// LÓGICA DE ROTACIÓN:
//   1. API devuelve nueva tasa (ej: 55.50)
//   2. tasa2 actual → pasa a tasa1
//   3. nueva tasa de la API → se guarda como tasa2
//   4. Ciclo constante cada 3 minutos en horario 15:00 - 22:00 (TODOS LOS DÍAS)
//
// ROTACIÓN CON GUARDIA:
//   - Siempre rota: tasa2 → tasa1, API → tasa2
//   - GUARDIA: Si tasa2 ≤ 0, mantiene tasa1 actual (no propaga basura)
//   - Si ambas quedan iguales → el sistema usa una sola tasa (correcto)
//   - Si quedan diferentes → el 1TS usa ambas tasas (correcto)
//   - Solo escribe en Firebase si los valores finales cambiaron
//   - No depende de fechaValor ni de días hábiles

import admin from 'firebase-admin';
import { verifyAuth, getSecurityHeaders, handleCorsPreflight } from '../lib/verifyAuth.js';

const API_URL = process.env.BCV_API_URL || 'https://api-bcv-1vq1.onrender.com/tasas';
const CRON_SECRET = process.env.CRON_SECRET;

let db = null;

function initializeFirebase() {
  if (db) return true;
  try {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta FIREBASE_SERVICE_ACCOUNT');
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    db = admin.firestore();
    return true;
  } catch (error) {
    console.error('Error Firebase:', error.message);
    return false;
  }
}

const securityHeaders = getSecurityHeaders();

// Horarios de operación (hora Venezuela) — TODOS LOS DÍAS
const WAKE_UP_HOUR = 14;
const WAKE_UP_MINUTE = 58;
const START_HOUR = 15;
const END_HOUR = 22;
const UPDATE_INTERVAL = 3;

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * Verificar si la petición viene del CRON (cron-job.org)
 * Acepta: header X-Cron-Secret O query param ?secret=xxx
 */
function verifyCronOrAuth(event) {
  // Opción 1: Header X-Cron-Secret
  const cronHeader = event.headers?.['x-cron-secret'] || event.headers?.['X-Cron-Secret'];
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
    return { authenticated: true, isCron: true, uid: 'system', role: 'system' };
  }

  // Opción 2: Query parameter ?secret= (compatible con cron-job.org)
  const querySecret = event.queryStringParameters?.secret || event.queryStringParameters?.Secret;
  if (CRON_SECRET && querySecret === CRON_SECRET) {
    return { authenticated: true, isCron: true, uid: 'system', role: 'system' };
  }

  return null;
}

export const handler = async (event, context) => {
  // Handle CORS preflight
  const corsResponse = handleCorsPreflight(event, securityHeaders);
  if (corsResponse) return corsResponse;

  // VERIFICAR AUTENTICACIÓN
  const cronResult = verifyCronOrAuth(event);
  let authResult = null;

  if (cronResult) {
    authResult = cronResult;
  } else {
    authResult = await verifyAuth(event, { allowedRoles: ['admin'] });
    if (!authResult.authenticated) {
      return {
        statusCode: authResult.error === 'Sin permisos suficientes' ? 403 : 401,
        headers: securityHeaders,
        body: JSON.stringify({ error: authResult.error }),
      };
    }
  }

  if (!initializeFirebase()) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error Firebase' }),
      headers: securityHeaders,
    };
  }

  const now = new Date();
  const vesTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Caracas' }));
  const currentHour = vesTime.getHours();
  const currentMinute = vesTime.getMinutes();
  const currentDay = vesTime.getDay();
  const dayName = DAY_NAMES[currentDay] || 'Desconocido';

  // ----------------------------------------------------------------
  // 14:58 TODOS LOS DÍAS: DESPERTAR API (PING)
  // ----------------------------------------------------------------
  if (currentHour === WAKE_UP_HOUR && currentMinute === WAKE_UP_MINUTE) {
    console.log(`${currentHour}:${currentMinute} (${dayName}) - Enviando ping para despertar Render...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      // Esperado: timeout. La API está despertando.
    }
    console.log(`Ping enviado (${dayName}). API despertando...`);
    return {
      statusCode: 200,
      headers: securityHeaders,
      body: JSON.stringify({
        action: 'wake-up',
        day: dayName,
        time: `${currentHour}:${currentMinute}`,
        message: 'API despertando para el horario de actualización',
      }),
    };
  }

  // ----------------------------------------------------------------
  // 15:00 - 22:00 TODOS LOS DÍAS: ACTUALIZAR TASA CADA 3 MIN
  // ----------------------------------------------------------------
  const isInUpdateWindow = currentHour >= START_HOUR && currentHour <= END_HOUR;
  const shouldUpdateNow = currentMinute % UPDATE_INTERVAL === 0;

  if (isInUpdateWindow && shouldUpdateNow) {
    console.log(`${currentHour}:${currentMinute} (${dayName}) - Verificando tasa del dolar...`);

    try {
      // 1. Consultar API
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      const response = await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const data = await response.json();

      const usdRate = data?.tasas?.find(t => t.codigo === 'USD');
      const newRate = usdRate?.tasa;
      const fechaValor = data?.fecha_valor;

      if (!newRate || isNaN(parseFloat(newRate))) {
        throw new Error('Valor dolar inválido recibido');
      }

      // 2. Leer tasas actuales de Firestore
      const docSnap = await db.collection('settings').doc('app_config').get();
      const currentConfig = docSnap.exists ? docSnap.data() : {};
      const currentTasa1 = currentConfig.tasa1 || 0;
      const currentTasa2 = currentConfig.tasa2 || 0;

      // 3. ROTACIÓN CON GUARDIA: tasa2 → tasa1, API → tasa2
      //    Nunca propagamos un tasa2=0 o inválida a tasa1.
      const newTasa2 = Number(parseFloat(newRate).toFixed(2));
      const previousTasa2 = Number(currentTasa2);
      let newTasa1 = Number(currentTasa2);

      // GUARDIA: Si tasa2 es 0 o inválida, mantener tasa1 actual.
      // Esto previene que una rotación con tasa2 vacía destruya tasa1.
      if (newTasa1 <= 0 || isNaN(newTasa1)) {
        newTasa1 = Number(currentTasa1);
      }

      // 4. Solo escribir en Firebase si los valores finales cambiaron
      const tasa1Changed = newTasa1 !== currentTasa1;
      const tasa2Changed = newTasa2 !== currentTasa2;

      if (!tasa1Changed && !tasa2Changed) {
        console.log(`Tasa sin cambios: tasa1=${newTasa1} tasa2=${newTasa2} (no se escribe en Firebase)`);
        return {
          statusCode: 200,
          headers: securityHeaders,
          body: JSON.stringify({
            success: true,
            updated: false,
            tasa1: newTasa1.toFixed(2),
            tasa2: newTasa2.toFixed(2),
            previousTasa2: previousTasa2.toFixed(2),
            fechaValor,
            day: dayName,
            time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
            message: `Tasa sin cambios: tasa1=${newTasa1} tasa2=${newTasa2}`,
          }),
        };
      }

      // 5. Escribir en Firestore — rotación con cambio real
      await db.collection('settings').doc('app_config').set({
        tasa1: newTasa1,
        tasa2: newTasa2,
        previousTasa2,
        fechaValor,
        lastRateUpdate: admin.firestore.FieldValue.serverTimestamp(),
        rateSource: 'api-bcv-1vq1.onrender.com',
      }, { merge: true });

      const changes = [];
      if (tasa1Changed) changes.push(`tasa1: ${currentTasa1} → ${newTasa1}`);
      if (tasa2Changed) changes.push(`tasa2: ${currentTasa2} → ${newTasa2}`);

      console.log(`Tasa ROTADA (${dayName}): ${changes.join(', ')}`);

      return {
        statusCode: 200,
        headers: securityHeaders,
        body: JSON.stringify({
          success: true,
          updated: true,
          tasa1: newTasa1.toFixed(2),
          tasa2: newTasa2.toFixed(2),
          previousTasa2: previousTasa2.toFixed(2),
          fechaValor,
          day: dayName,
          time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
          changes,
          message: `Tasa rotada: tasa1=${newTasa1}, tasa2=${newTasa2}`,
        }),
      };
    } catch (error) {
      console.error(`Error actualizando tasa (${dayName}):`, error.message);
      return {
        statusCode: 500,
        headers: securityHeaders,
        body: JSON.stringify({ error: 'Error interno del servidor' }),
      };
    }
  }

  // ----------------------------------------------------------------
  // FUERA DE HORARIO: INFORMAR ESTADO
  // ----------------------------------------------------------------
  let nextAction;
  if (currentHour < WAKE_UP_HOUR) {
    nextAction = `Esperando ${WAKE_UP_HOUR}:${String(WAKE_UP_MINUTE).padStart(2, '0')} para despertar API`;
  } else if (currentHour < START_HOUR) {
    nextAction = `Esperando ${START_HOUR}:00 para comenzar actualizaciones`;
  } else if (currentHour > END_HOUR) {
    nextAction = `Esperando ${START_HOUR}:00 del día siguiente`;
  } else {
    nextAction = `Próxima actualización en minuto ${Math.ceil(currentMinute / UPDATE_INTERVAL) * UPDATE_INTERVAL}`;
  }

  console.log(`Fuera de horario (${dayName}). ${nextAction}`);

  return {
    statusCode: 200,
    headers: securityHeaders,
    body: JSON.stringify({
      action: 'idle',
      day: dayName,
      currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
      updateWindow: `${START_HOUR}:00 - ${END_HOUR}:00 (todos los días)`,
      nextAction,
    }),
  };
};