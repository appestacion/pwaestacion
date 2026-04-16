// src/config/firebase.js
// Configuración del cliente Firebase
// Reemplaza estos valores con los de tu proyecto Firebase
// Consígalos en: Firebase Console → Project Settings → Your apps → Firebase SDK snippet

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCcG7sOP4IvPUSje2cUX3BsSPbnTknqADw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'pwaestacion.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'pwaestacion',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'pwaestacion.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '690033481152',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:690033481152:web:b6eb153299604b1ffda425',
};

let app = null;
let db = null;
let auth = null;

export function getFirebaseApp() {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb() {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseAuth() {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

// Verificar si Firebase está configurado correctamente
export function isFirebaseConfigured() {
  const config = firebaseConfig;
  return (
    config.apiKey && config.apiKey !== 'TU_API_KEY' &&
    config.projectId && config.projectId !== 'TU_PROJECT_ID'
  );
}

// Export para compatibilidad con firestore.js y otros servicios
export { db, auth };