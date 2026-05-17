// src/config/firebase.js
// Configuracion del cliente Firebase con Authentication.
//
// SEGURIDAD v2: NO hay credenciales hardcodeadas.
// Las credenciales se cargan EXCLUSIVAMENTE desde variables de entorno (VITE_).
// Si las variables no están configuradas, la app no inicializa Firebase.
//
// Para configurar, crea un archivo .env.local en la raiz del proyecto:
//   VITE_FIREBASE_API_KEY=tu_api_key
//   VITE_FIREBASE_AUTH_DOMAIN=tu_proyecto.firebaseapp.com
//   VITE_FIREBASE_PROJECT_ID=tu_proyecto_id
//   VITE_FIREBASE_STORAGE_BUCKET=tu_proyecto.appspot.com
//   VITE_FIREBASE_MESSAGING_SENDER_ID=tu_sender_id
//   VITE_FIREBASE_APP_ID=tu_app_id
//
// Obtén estos valores en: Firebase Console > Project Settings > Your apps > Firebase SDK snippet

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app = null;
let db = null;
let auth = null;
let secondaryApp = null;
let secondaryAuth = null;

export function getFirebaseApp() {
  if (!app) {
    // Validar que al menos projectId y apiKey estén configurados
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error(
        '[Firebase] Credenciales no configuradas. ' +
        'Crea un archivo .env.local con VITE_FIREBASE_API_KEY y VITE_FIREBASE_PROJECT_ID. ' +
        'Verifica el README para instrucciones.'
      );
      return null;
    }
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb() {
  if (!db) {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return null;
    db = getFirestore(firebaseApp);
  }
  return db;
}

export function getFirebaseAuth() {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (!firebaseApp) return null;
    auth = getAuth(firebaseApp);
  }
  return auth;
}

/**
 * Auth secundario para crear usuarios sin cerrar la sesión del admin actual.
 * Usa una instancia de Firebase App separada.
 */
export function getSecondaryAuth() {
  if (!secondaryAuth) {
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) return null;
    secondaryApp = initializeApp(firebaseConfig, 'secondary-admin-auth');
    secondaryAuth = getAuth(secondaryApp);
  }
  return secondaryAuth;
}

/**
 * Verifica si Firebase está correctamente configurado (todas las vars de entorno presentes).
 */
export function isFirebaseConfigured() {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.authDomain
  );
}