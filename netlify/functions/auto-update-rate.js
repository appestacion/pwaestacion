// netlify/functions/auto-update-rate.js
// Actualización automática de tasa de cambio USD/VES (CRON)
// SEGURIDAD: Requiere header secreto (X-Cron-Secret) para invocaciones automáticas
//           o autenticación Firebase para invocaciones manuales
//
// LÓGICA DE ROTACIÓN:
//   1. API devuelve nueva tasa (ej: 55.50)
//   2. tasa2 actual → pasa a tasa1
//   3. nueva tasa de la API → se guarda como tasa2
//   4. Ciclo constante cada 3 minutos en horario hábil

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

// Horarios de operación (hora Venezuela)
const WAKE_UP_HOUR = 14;
const WAKE_UP_MINUTE = 58;
const START_HOUR = 15;
const END_HOUR = 22;
const UPDATE_INTERVAL = 3;

/**
 * Verificar si la petición viene del CRON (cron-job.org)
 * o de un usuario autenticado con Firebase
 */
function verifyCronOrAuth(event) {
  const cronHeader = event.headers?.['x-cron-secret'] || event.headers?.['X-Cron-Secret'];
  if (CRON_SECRET && cronHeader === CRON_SECRET) {
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
  const isWeekday = currentDay >= 1 && currentDay <= 5;

  // ----------------------------------------------------------------
  // 14:58 LUNES A VIERNES: DESPERTAR API (PING)
  // ----------------------------------------------------------------
  if (isWeekday && currentHour === WAKE_UP_HOUR && currentMinute === WAKE_UP_MINUTE) {
    console.log(`${currentHour}:${currentMinute} - Enviando ping para despertar Render...`);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      await fetch(API_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
    } catch (e) {
      // Esperado: timeout. La API está despertando.
    }
    console.log('Ping enviado. API despertando...');
    return {
      statusCode: 200,
      headers: securityHeaders,
      body: JSON.stringify({
        action: 'wake-up',
        time: `${currentHour}:${currentMinute}`,
        message: 'API despertando para el horario de actualización',
      }),
    };
  }

  // ----------------------------------------------------------------
  // 15:00 - 22:00 LUNES A VIERNES: ACTUALIZAR TASA CADA 3 MIN
  // ----------------------------------------------------------------
  const isInUpdateWindow = isWeekday && currentHour >= START_HOUR && currentHour <= END_HOUR;
  const shouldUpdateNow = currentMinute % UPDATE_INTERVAL === 0;

  if (isInUpdateWindow && shouldUpdateNow) {
    console.log(`${currentHour}:${currentMinute} - Verificando tasa del dolar...`);

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

      // 2. Leer tasa2 actual de Firestore
      const docSnap = await db.collection('settings').doc('app_config').get();
      const currentConfig = docSnap.exists ? docSnap.data() : {};
      const currentTasa2 = currentConfig.tasa2 || 0;
      const currentTasa1 = currentConfig.tasa1 || 0;

      // 3. Verificar si la tasa cambió
      const newFormatted = parseFloat(newRate).toFixed(2);
      const currentTasa2Formatted = parseFloat(currentTasa2).toFixed(2);

      if (currentTasa2Formatted === newFormatted) {
        console.log(`Tasa sin cambios: ${newRate} Bs/$ (no se escribe en Firebase)`);
        return {
          statusCode: 200,
          headers: securityHeaders,
          body: JSON.stringify({
            success: true,
            updated: false,
            tasa1: parseFloat(currentTasa1).toFixed(2),
            tasa2: parseFloat(newRate),
            previousTasa2: parseFloat(currentTasa2),
            fechaValor,
            time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
            message: `Tasa sin cambios: ${newRate} Bs/$`,
          }),
        };
      }

      // 4. ROTACIÓN: tasa2 actual → tasa1, nueva tasa → tasa2
      const previousTasa2 = currentTasa2;

      await db.collection('settings').doc('app_config').set({
        tasa1: Number(currentTasa2),
        tasa2: Number(newRate),
        previousTasa2: Number(previousTasa2),
        fechaValor,
        lastRateUpdate: admin.firestore.FieldValue.serverTimestamp(),
        rateSource: 'api-bcv-1vq1.onrender.com',
      }, { merge: true });

      console.log(`Tasa ROTADA: tasa1=${currentTasa2} (era tasa2), tasa2=${newRate} (nueva de API)`);

      return {
        statusCode: 200,
        headers: securityHeaders,
        body: JSON.stringify({
          success: true,
          updated: true,
          tasa1: parseFloat(currentTasa2),
          tasa2: parseFloat(newRate),
          previousTasa2: parseFloat(previousTasa2),
          fechaValor,
          time: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
          message: `Tasa actualizada: tasa1=${currentTasa2}, tasa2=${newRate}`,
        }),
      };
    } catch (error) {
      console.error('Error actualizando tasa:', error.message);
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
  if (!isWeekday) {
    nextAction = 'Esperando día hábil (Lunes a Viernes)';
  } else if (currentHour < WAKE_UP_HOUR) {
    nextAction = `Esperando ${WAKE_UP_HOUR}:${String(WAKE_UP_MINUTE).padStart(2, '0')} para despertar API`;
  } else if (currentHour < START_HOUR) {
    nextAction = `Esperando ${START_HOUR}:00 para comenzar actualizaciones`;
  } else if (currentHour > END_HOUR) {
    nextAction = 'Esperando próximo día hábil';
  } else {
    nextAction = `Próxima actualización en minuto ${Math.ceil(currentMinute / UPDATE_INTERVAL) * UPDATE_INTERVAL}`;
  }

  console.log(`Fuera de horario. ${nextAction}`);

  return {
    statusCode: 200,
    headers: securityHeaders,
    body: JSON.stringify({
      action: 'idle',
      weekday: isWeekday ? 'Sí' : 'No',
      currentTime: `${currentHour}:${String(currentMinute).padStart(2, '0')}`,
      updateWindow: `${START_HOUR}:00 - ${END_HOUR}:00`,
      nextAction,
    }),
  };
};