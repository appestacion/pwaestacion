// src/store/useConfigStore.js
// Configuracion con Firebase Firestore (tiempo real) + localStorage persistente.
// Fallback offline: la config se lee de localStorage al instante
// y se sincroniza con Firestore cuando hay conexion.
//
// E/S Montaña Fresca — Identidad exclusiva.
// Los campos de identidad (nombre, RIF, dirección, teléfono, logo, colores)
// son CONSTANTES y no se sincronizan con Firestore.
// Solo los campos operativos (tasas, dimensiones) son dinámicos.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';

const PERSIST_KEY = 'mf-montanafresca-config';

// ═══════════════════════════════════════════════════════════════
// IDENTIDAD FIJA — No es editable ni sincronizable con Firestore
// ═══════════════════════════════════════════════════════════════
export const STATION_IDENTITY = {
  stationName: 'E/S Montaña Fresca',
  stationRif: 'J-30894985-2',
  stationAddress: 'AV. CASANOVA GODOY ZONA INDUSTRIAL, Aragua - Venezuela',
  stationPhone: '0424 3036024',
  stationLogo: '/LogoMF.jpg',
  stationColorPrimary: '#CE1126',
  stationColorSecondary: '#003399',
  stationColorAccent: '#FFD100',
};

// ═══════════════════════════════════════════════════════════════
// CONFIG OPERATIVA — Dinámica (tasas, dimensiones, etc.)
// ═══════════════════════════════════════════════════════════════
const defaultConfig = {
  tasa1: 50.00,
  tasa2: 0,
  precioLitroUSD: 0.50,
  tanksCount: 3,
  islandsCount: 3,
  pumpsPerIsland: 2,
  maxCortes: 12,
  porcentajeRecaudacion: 10,
  previousTasa2: null,
  fechaValor: null,
  lastRateUpdate: null,
  rateSource: null,
};

// Lee la config cacheada en localStorage de forma sincronica (antes del primer render)
function getPersistedConfig() {
  try {
    const stored = localStorage.getItem(PERSIST_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.config) {
        return parsed.state.config;
      }
    }
  } catch (e) {
    console.error('[ConfigStore] Error leyendo localStorage:', e);
  }
  return null;
}

const _cachedConfig = getPersistedConfig();

let unsubscribeSnapshot = null;
let loadingTimeoutId = null;

const useConfigStore = create(
  persist(
    (set, get) => ({
      config: _cachedConfig || defaultConfig,
      firestoreActive: false,
      loading: !_cachedConfig,

      loadConfig: () => {
        if (unsubscribeSnapshot) return;

        // Timeout de seguridad: si Firestore no responde en 8 segundos,
        // pasar loading a false para que la app renderice con la config por defecto
        if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        loadingTimeoutId = setTimeout(() => {
          if (get().loading) {
            console.warn('[ConfigStore] Timeout de seguridad: Firestore no respondio a tiempo. Usando config local.');
            set({ loading: false });
          }
        }, 8000);

        if (isFirebaseConfigured()) {
          try {
            const db = getDb();
            const configRef = doc(db, 'settings', 'app_config');

            unsubscribeSnapshot = onSnapshot(
              configRef,
              (docSnap) => {
                if (loadingTimeoutId) {
                  clearTimeout(loadingTimeoutId);
                  loadingTimeoutId = null;
                }

                if (docSnap.exists()) {
                  const firestoreData = docSnap.data();
                  const newConfig = {
                    ...get().config,
                    tasa1: firestoreData.tasa1 ?? get().config.tasa1,
                    tasa2: firestoreData.tasa2 ?? get().config.tasa2,
                    tanksCount: firestoreData.tanksCount ?? get().config.tanksCount,
                    islandsCount: firestoreData.islandsCount ?? get().config.islandsCount,
                    pumpsPerIsland: firestoreData.pumpsPerIsland ?? get().config.pumpsPerIsland,
                    maxCortes: firestoreData.maxCortes ?? get().config.maxCortes,
                    precioLitroUSD: firestoreData.precioLitroUSD ?? 0.50,
                    porcentajeRecaudacion: firestoreData.porcentajeRecaudacion ?? get().config.porcentajeRecaudacion,
                    previousTasa2: firestoreData.previousTasa2 ?? null,
                    fechaValor: firestoreData.fechaValor ?? null,
                    lastRateUpdate: firestoreData.lastRateUpdate ?? null,
                    rateSource: firestoreData.rateSource ?? null,
                  };
                  set({ config: newConfig, firestoreActive: true, loading: false });
                } else {
                  // Crear documento por defecto en Firestore (solo campos operativos)
                  setDoc(configRef, {
                    tasa1: get().config.tasa1,
                    tasa2: get().config.tasa2,
                    precioLitroUSD: get().config.precioLitroUSD,
                    tanksCount: get().config.tanksCount,
                    islandsCount: get().config.islandsCount,
                    pumpsPerIsland: get().config.pumpsPerIsland,
                    maxCortes: get().config.maxCortes,
                    porcentajeRecaudacion: get().config.porcentajeRecaudacion,
                    createdAt: serverTimestamp(),
                  }, { merge: true });
                  set({ firestoreActive: true, loading: false });
                }
              },
              (error) => {
                if (loadingTimeoutId) {
                  clearTimeout(loadingTimeoutId);
                  loadingTimeoutId = null;
                }
                if (error.message?.includes('Target ID already exists')) {
                  console.warn('[ConfigStore] Listener ya activo (HMR/StrictMode), se reutiliza.');
                  if (loadingTimeoutId) {
                    clearTimeout(loadingTimeoutId);
                    loadingTimeoutId = null;
                  }
                  return;
                }

                if (loadingTimeoutId) {
                  clearTimeout(loadingTimeoutId);
                  loadingTimeoutId = null;
                }
                if (error.code === 'permission-denied') {
                  unsubscribeSnapshot = null;
                  console.warn('[ConfigStore] Firestore requiere auth. Se reintentara despues del login.');
                  // FIX CRÍTICO: Poner loading: false para que el spinner se quite.
                  // Sin esto, la app queda en spinner infinito porque el usuario
                  // no está autenticado y Firestore rechaza la lectura.
                  set({ loading: false });
                  return;
                }

                console.error('[ConfigStore] Error Firestore onSnapshot:', error);
                unsubscribeSnapshot = null;
                set({ firestoreActive: false, loading: false });
              }
            );
          } catch (error) {
            console.error('[ConfigStore] Error inicializando Firestore:', error);
            if (loadingTimeoutId) {
              clearTimeout(loadingTimeoutId);
              loadingTimeoutId = null;
            }
            unsubscribeSnapshot = null;
            set({ firestoreActive: false, loading: false });
          }
        } else {
          if (loadingTimeoutId) {
            clearTimeout(loadingTimeoutId);
            loadingTimeoutId = null;
          }
          set({ firestoreActive: false, loading: false });
        }
      },

      updateConfig: (updates) => {
        // Filtrar cualquier intento de actualizar campos de identidad
        const identityFields = ['stationName', 'stationRif', 'stationAddress', 'stationPhone', 'stationLogo', 'stationColorPrimary', 'stationColorSecondary', 'stationColorAccent'];
        const filteredUpdates = { ...updates };
        for (const field of identityFields) {
          delete filteredUpdates[field];
        }

        const newConfig = { ...get().config, ...filteredUpdates };
        set({ config: newConfig });

        if (isFirebaseConfigured()) {
          try {
            const db = getDb();
            const configRef = doc(db, 'settings', 'app_config');
            setDoc(configRef, filteredUpdates, { merge: true }).catch((err) => {
              console.error('[ConfigStore] Error escribiendo Firestore:', err);
            });
          } catch (e) {
            console.error('[ConfigStore] Error sincronizando a Firestore:', e);
          }
        }
      },

      resetConfig: () => {
        set({ config: defaultConfig });

        if (isFirebaseConfigured()) {
          try {
            const db = getDb();
            const configRef = doc(db, 'settings', 'app_config');
            setDoc(configRef, {
              tasa1: defaultConfig.tasa1,
              tasa2: defaultConfig.tasa2,
              precioLitroUSD: defaultConfig.precioLitroUSD,
              tanksCount: defaultConfig.tanksCount,
              islandsCount: defaultConfig.islandsCount,
              pumpsPerIsland: defaultConfig.pumpsPerIsland,
              maxCortes: defaultConfig.maxCortes,
              porcentajeRecaudacion: defaultConfig.porcentajeRecaudacion,
            }, { merge: true }).catch((err) => {
              console.error('[ConfigStore] Error reset Firestore:', err);
            });
          } catch (e) {
            console.error('[ConfigStore] Error reset Firebase:', e);
          }
        }
      },

      cleanup: () => {
        if (unsubscribeSnapshot) {
          unsubscribeSnapshot();
          unsubscribeSnapshot = null;
        }
      },
    }),
    {
      name: PERSIST_KEY,
      partialize: (state) => ({
        config: state.config,
      }),
    }
  )
);

export { useConfigStore, defaultConfig };