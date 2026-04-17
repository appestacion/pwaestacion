// src/store/useConfigStore.js
// Configuracion con Firebase Firestore (tiempo real) + localStorage (fallback offline)

import { create } from 'zustand';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { STORAGE_KEYS } from '../services/storage.js';

const defaultConfig = {
  tasa1: 50.00,
  tasa2: 0,
  stationName: 'Mi Estacion de Servicio',
  stationRif: 'J-00000000-0',
  stationAddress: 'Venezuela',
  stationPhone: '',
  stationLogo: '',
  stationColorPrimary: '#CE1126',
  stationColorSecondary: '#003399',
  stationColorAccent: '#FFD100',
  tanksCount: 3,
  islandsCount: 3,
  pumpsPerIsland: 2,
  maxCortes: 12,
  previousTasa2: null,
  fechaValor: null,
  lastRateUpdate: null,
  rateSource: null,
};

let unsubscribeSnapshot = null;

const useConfigStore = create((set, get) => ({
  config: defaultConfig,
  firestoreActive: false,
  loading: true,

  loadConfig: () => {
    const localData = localStorage.getItem(STORAGE_KEYS.CONFIG);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        set({ config: { ...defaultConfig, ...parsed } });
      } catch (e) {
        console.error('Error parseando config localStorage:', e);
      }
    }

    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const configRef = doc(db, 'settings', 'app_config');

        unsubscribeSnapshot = onSnapshot(
          configRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const firestoreData = docSnap.data();
              const newConfig = {
                ...get().config,
                tasa1: firestoreData.tasa1 ?? get().config.tasa1,
                tasa2: firestoreData.tasa2 ?? get().config.tasa2,
                previousTasa2: firestoreData.previousTasa2 ?? null,
                fechaValor: firestoreData.fechaValor ?? null,
                lastRateUpdate: firestoreData.lastRateUpdate ?? null,
                rateSource: firestoreData.rateSource ?? null,
              };
              set({ config: newConfig, firestoreActive: true, loading: false });
              localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(newConfig));
            } else {
              setDoc(configRef, {
                tasa1: get().config.tasa1,
                tasa2: get().config.tasa2,
                stationName: get().config.stationName,
                stationRif: get().config.stationRif,
                stationAddress: get().config.stationAddress,
                stationPhone: get().config.stationPhone,
                stationColorPrimary: get().config.stationColorPrimary,
                stationColorSecondary: get().config.stationColorSecondary,
                stationColorAccent: get().config.stationColorAccent,
                tanksCount: get().config.tanksCount,
                islandsCount: get().config.islandsCount,
                pumpsPerIsland: get().config.pumpsPerIsland,
                maxCortes: get().config.maxCortes,
                createdAt: serverTimestamp(),
              }, { merge: true });
              set({ firestoreActive: true, loading: false });
            }
          },
          (error) => {
            console.error('Error Firestore onSnapshot:', error);
            set({ firestoreActive: false, loading: false });
          }
        );
      } catch (error) {
        console.error('Error inicializando Firestore:', error);
        set({ firestoreActive: false, loading: false });
      }
    } else {
      set({ firestoreActive: false, loading: false });
    }
  },

  updateConfig: (updates) => {
    const newConfig = { ...get().config, ...updates };
    set({ config: newConfig });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(newConfig));

    if (get().firestoreActive && isFirebaseConfigured()) {
      try {
        const db = getDb();
        const configRef = doc(db, 'settings', 'app_config');
        setDoc(configRef, updates, { merge: true }).catch((err) => {
          console.error('Error escribiendo Firestore:', err);
        });
      } catch (e) {
        console.error('Error sincronizando a Firestore:', e);
      }
    }
  },

  resetConfig: () => {
    set({ config: defaultConfig });
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(defaultConfig));

    if (get().firestoreActive && isFirebaseConfigured()) {
      try {
        const db = getDb();
        const configRef = doc(db, 'settings', 'app_config');
        setDoc(configRef, {
          tasa1: defaultConfig.tasa1,
          tasa2: defaultConfig.tasa2,
          stationName: defaultConfig.stationName,
          stationRif: defaultConfig.stationRif,
          stationAddress: defaultConfig.stationAddress,
          stationPhone: defaultConfig.stationPhone,
          stationColorPrimary: defaultConfig.stationColorPrimary,
          stationColorSecondary: defaultConfig.stationColorSecondary,
          stationColorAccent: defaultConfig.stationColorAccent,
          tanksCount: defaultConfig.tanksCount,
          islandsCount: defaultConfig.islandsCount,
          pumpsPerIsland: defaultConfig.pumpsPerIsland,
          maxCortes: defaultConfig.maxCortes,
        }, { merge: true }).catch((err) => {
          console.error('Error reset Firestore:', err);
        });
      } catch (e) {
        console.error('Error reset Firebase:', e);
      }
    }
  },

  cleanup: () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }
  },
}));

export { useConfigStore, defaultConfig };