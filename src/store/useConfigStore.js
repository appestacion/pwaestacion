// src/store/useConfigStore.js
// Configuracion con Firebase Firestore (tiempo real) + localStorage persistente.
// Ahora con fallback offline: la config se lee de localStorage al instante
// y se sincroniza con Firestore cuando hay conexion.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';

const PERSIST_KEY = 'cierre-smf-config';

const defaultConfig = {
  tasa1: 50.00,
  tasa2: 0,
  precioLitroUSD: 0.50,
  stationName: 'Mi Estación de Servicio',
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
// FIX: Timeout de seguridad para garantizar que loading pase a false
let loadingTimeoutId = null;

const useConfigStore = create(
  persist(
    (set, get) => ({
      config: _cachedConfig || defaultConfig,
      firestoreActive: false,
      // loading = true solo si NO hay datos cacheados (primera vez sin internet)
      // Si hay cache, loading = false y la UI renderiza inmediatamente sin flash
      loading: !_cachedConfig,

      loadConfig: () => {
        // Evitar suscribirse multiples veces
        if (unsubscribeSnapshot) return;

        // FIX: Timeout de seguridad - si Firestore no responde en 8 segundos,
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
                // Limpiar timeout cuando Firestore responde
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
                    stationName: firestoreData.stationName ?? get().config.stationName,
                    stationRif: firestoreData.stationRif ?? get().config.stationRif,
                    stationAddress: firestoreData.stationAddress ?? get().config.stationAddress,
                    stationPhone: firestoreData.stationPhone ?? get().config.stationPhone,
                    stationLogo: firestoreData.stationLogo ?? get().config.stationLogo,
                    stationColorPrimary: firestoreData.stationColorPrimary ?? get().config.stationColorPrimary,
                    stationColorSecondary: firestoreData.stationColorSecondary ?? get().config.stationColorSecondary,
                    stationColorAccent: firestoreData.stationColorAccent ?? get().config.stationColorAccent,
                    tanksCount: firestoreData.tanksCount ?? get().config.tanksCount,
                    islandsCount: firestoreData.islandsCount ?? get().config.islandsCount,
                    pumpsPerIsland: firestoreData.pumpsPerIsland ?? get().config.pumpsPerIsland,
                    maxCortes: firestoreData.maxCortes ?? get().config.maxCortes,
                    precioLitroUSD: firestoreData.precioLitroUSD ?? 0.50,
                    previousTasa2: firestoreData.previousTasa2 ?? null,
                    fechaValor: firestoreData.fechaValor ?? null,
                    lastRateUpdate: firestoreData.lastRateUpdate ?? null,
                    rateSource: firestoreData.rateSource ?? null,
                  };
                  set({ config: newConfig, firestoreActive: true, loading: false });
                } else {
                  // Crear documento por defecto en Firestore si no existe
                  setDoc(configRef, {
                    tasa1: get().config.tasa1,
                    tasa2: get().config.tasa2,
                    precioLitroUSD: get().config.precioLitroUSD,
                    stationName: get().config.stationName,
                    stationRif: get().config.stationRif,
                    stationAddress: get().config.stationAddress,
                    stationPhone: get().config.stationPhone,
                    stationLogo: get().config.stationLogo,
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
                // FIX: React 18 StrictMode dispara onAuthStateChanged 2 veces.
                // Firestore lanza "Target ID already exists" en la 2da llamada.
                // No es un error real — ignorar y NO cerrar sesión.
                if (error.message?.includes('Target ID already exists')) {
                  console.warn('[ConfigStore] Listener ya activo (HMR/StrictMode), se reutiliza.');
                  // Limpiar timeout cuando Firestore responde (aunque sea con este "error")
                  if (loadingTimeoutId) {
                    clearTimeout(loadingTimeoutId);
                    loadingTimeoutId = null;
                  }
                  return;
                }

                // Limpiar timeout cuando hay error
                if (loadingTimeoutId) {
                  clearTimeout(loadingTimeoutId);
                  loadingTimeoutId = null;
                }
                // FIX: Si falla por permisos (sin auth), limpiar la suscripcion
                // para que loadConfig() pueda reintentar despues del login
                // Esto es COMPORTAMIENTO ESPERADO en cada carga antes del login
                if (error.code === 'permission-denied') {
                  unsubscribeSnapshot = null;
                  console.warn('[ConfigStore] Firestore requiere auth. Se reintentara despues del login.');
                  return;
                }

                // Solo loguear como ERROR los errores que NO son esperados
                console.error('[ConfigStore] Error Firestore onSnapshot:', error);
                unsubscribeSnapshot = null;
                // Sin Firestore pero con cache local: seguir funcionando
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
        const newConfig = { ...get().config, ...updates };
        set({ config: newConfig });

        if (isFirebaseConfigured()) {
          try {
            const db = getDb();
            const configRef = doc(db, 'settings', 'app_config');
            setDoc(configRef, updates, { merge: true }).catch((err) => {
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
              stationName: defaultConfig.stationName,
              stationRif: defaultConfig.stationRif,
              stationAddress: defaultConfig.stationAddress,
              stationPhone: defaultConfig.stationPhone,
              stationLogo: '',
              stationColorPrimary: defaultConfig.stationColorPrimary,
              stationColorSecondary: defaultConfig.stationColorSecondary,
              stationColorAccent: defaultConfig.stationColorAccent,
              tanksCount: defaultConfig.tanksCount,
              islandsCount: defaultConfig.islandsCount,
              pumpsPerIsland: defaultConfig.pumpsPerIsland,
              maxCortes: defaultConfig.maxCortes,
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