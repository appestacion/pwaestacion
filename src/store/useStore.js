// src/store/useStore.js
// Store de autenticacion y usuarios con Firebase Authentication + Firestore (perfiles)
//
// SEGURIDAD v4:
//   - H5: createUser delega a Netlify Function (server-side).
//   - H6: user e isAuthenticated NO se persisten en localStorage.
//   - Session persistence: browserSessionPersistence — la sesion vive
//     en sessionStorage. Comportamiento:
//       * F5 / recargar            → sesion persiste
//       * Cambiar de pestaña       → sesion persiste
//       * Cerrar pestaña/ventana   → sesion se DESTRUYE (pide login)
//       * Cerrar PWA instalada     → sesion se DESTRUYE (pide login)
//   - FIX anti-spinner-infinito:
//       * TODOS los paths del callback onAuthStateChanged setean
//         authLoading: false.
//       * Timeout de seguridad de 6s.
//       * Timeout de lectura de perfil de 5s.
//   - FIX v4 — "Target ID already exists":
//       * Cache del perfil en localStorage (mf_user_profile).
//       * En F5, se restaura instantaneamente desde cache.
//       * Refresco de perfil en background (no bloquea UI).
//       * Retry automatico (1 retry, 500ms) si Firestore lanza
//         "Target ID already exists" (bug de StrictMode + Firestore v12).
//       * Si firebaseUser existe pero Firestore falla, NO se cierra
//         sesion — se usa cache como fallback.

import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import { getFirebaseAuth, getDb, isFirebaseConfigured } from '../config/firebase.js';
import { useConfigStore } from './useConfigStore.js';
import { useCierreStore } from './useCierreStore.js';
import { useProductStore } from './useProductStore.js';
import { useInventoryStore } from './useInventoryStore.js';
import { useGandolaStore } from './useGandolaStore.js';

// Bandera para evitar registrar el listener multiples veces
let authListenerSetup = false;

// ═══════════════════════════════════════════════════════════
// CACHE DE PERFIL EN LOCALSTORAGE
// Acelera el F5 y sobrevive a errores transitorios de Firestore.
// ═══════════════════════════════════════════════════════════
const PROFILE_CACHE_KEY = 'mf_user_profile';

function getCachedProfile(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.uid === uid && parsed?.profile) return parsed.profile;
    return null;
  } catch (e) {
    return null;
  }
}

function setCachedProfile(uid, profile) {
  try {
    localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ uid, profile }));
  } catch (e) {}
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch (e) {}
}

/**
 * Lee el perfil de usuario desde Firestore.
 * Si Firestore lanza "Target ID already exists" (bug de StrictMode +
 * Firestore v12 en dev), reintenta una vez despues de 500ms.
 * Si la lectura tarda mas de 5s, lanza TIMEOUT_PROFILE_FETCH.
 */
async function readProfileWithRetry(uid) {
  const db = getDb();

  try {
    await enableNetwork(db);
  } catch (_) {}

  const doRead = () =>
    Promise.race([
      getDoc(doc(db, 'users', uid)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_PROFILE_FETCH')), 5000)
      ),
    ]);

  try {
    const snap = await doRead();
    return snap.exists() ? snap.data() : null;
  } catch (error) {
    // Bug conocido de Firestore + StrictMode: "Target ID already exists"
    // Reintenta una vez despues de 500ms (en prod esto no ocurre).
    if (error.message?.includes('Target ID already exists')) {
      console.warn('[Auth] Target ID already exists. Reintentando en 500ms...');
      await new Promise((r) => setTimeout(r, 500));
      const snap = await doRead();
      return snap.exists() ? snap.data() : null;
    }
    throw error;
  }
}

const useStore = create(
  (set, get) => ({
    // --- Estado de autenticacion ---
    user: null,
    isAuthenticated: false,
    authLoading: true,

    /**
     * Inicializar el listener de Firebase Auth (onAuthStateChanged).
     * Debe llamarse UNA vez al arrancar la app.
     *
     * Comportamiento de sesion:
     *   - browserSessionPersistence: la sesion vive en sessionStorage.
     *     Sobrevive F5 y cambio de pestaña. Se destruye al cerrar la
     *     pestaña/ventana o la PWA instalada.
     *
     * Anti-spinner-infinito:
     *   - Timeout de seguridad de 6s.
     *   - Todos los paths del callback setean authLoading: false.
     *   - Cache del perfil en localStorage para F5 instantaneo.
     *   - Retry automatico en "Target ID already exists".
     *   - Si firebaseUser existe pero Firestore falla, se usa cache.
     */
    initAuth: async () => {
      if (authListenerSetup) return;
      authListenerSetup = true;

      if (!isFirebaseConfigured()) {
        set({ authLoading: false });
        return;
      }

      // Timeout de seguridad: si onAuthStateChanged no resuelve en 6s,
      // forzar authLoading: false para mostrar el login.
      const authSafetyTimeout = setTimeout(() => {
        if (get().authLoading) {
          console.warn('[Auth] Timeout de seguridad: Firebase no respondio en 6s. Mostrando login.');
          set({ user: null, isAuthenticated: false, authLoading: false });
        }
      }, 6000);

      try {
        const auth = getFirebaseAuth();
        await setPersistence(auth, browserSessionPersistence);

        onAuthStateChanged(auth, async (firebaseUser) => {
          // Limpiar timeout de seguridad — el callback ya fue invocado
          clearTimeout(authSafetyTimeout);

          // Si no hay usuario, ir al login
          if (!firebaseUser) {
            clearCachedProfile();
            set({ user: null, isAuthenticated: false, authLoading: false });
            return;
          }

          // ═══════════════════════════════════════════════════
          // HAY sesion de Firebase Auth. Ahora cargar el perfil.
          // ═══════════════════════════════════════════════════

          // 1. Intentar cache primero (instantaneo)
          const cachedProfile = getCachedProfile(firebaseUser.uid);
          if (cachedProfile) {
            // Setear usuario desde cache inmediatamente
            set({
              user: {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                ...cachedProfile,
              },
              isAuthenticated: true,
              authLoading: false,
            });
            // Refrescar perfil en background (no bloquea UI)
            refreshProfileInBackground(firebaseUser, auth, set);
            return;
          }

          // 2. No hay cache — leer de Firestore (con retry)
          try {
            const profile = await readProfileWithRetry(firebaseUser.uid);

            if (profile && profile.active !== false) {
              // Perfil OK — setear y cachear
              setCachedProfile(firebaseUser.uid, profile);
              set({
                user: {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  ...profile,
                },
                isAuthenticated: true,
                authLoading: false,
              });
              return;
            }

            // Perfil inactivo o no existe — cerrar sesion
            console.warn('[Auth] Usuario sin perfil activo. Cerrando sesion.');
            clearCachedProfile();
            try { await signOut(auth); } catch (_) {}
            set({ user: null, isAuthenticated: false, authLoading: false });
          } catch (error) {
            console.error('[Auth] Error leyendo perfil de usuario:', error.message);

            // Ultimo recurso: si Firestore falla y no hay cache,
            // cerrar sesion. Esto solo ocurre en el primer login
            // (no hay cache) Y Firestore no responde.
            clearCachedProfile();
            try { await signOut(auth); } catch (_) {}
            set({ user: null, isAuthenticated: false, authLoading: false });
          }
        });
      } catch (error) {
        clearTimeout(authSafetyTimeout);
        console.error('[Auth] Error inicializando Firebase Auth:', error);
        set({ user: null, isAuthenticated: false, authLoading: false });
      }
    },

    /**
     * Iniciar sesion con email y password via Firebase Auth.
     */
    login: async (email, password) => {
      try {
        const auth = getFirebaseAuth();
        await signInWithEmailAndPassword(auth, email, password);
        return true;
      } catch (error) {
        const messages = {
          'auth/invalid-email': 'Correo electrónico inválido',
          'auth/user-disabled': 'Usuario desactivado',
          'auth/user-not-found': 'Usuario no encontrado',
          'auth/wrong-password': 'contraseña incorrecta',
          'auth/invalid-credential': 'Correo o contraseña incorrectos',
          'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
          'auth/network-request-failed': 'Error de conexión. Verifique su internet.',
        };
        throw new Error(messages[error.code] || 'Error al iniciar sesión');
      }
    },

    /**
     * Cerrar sesion.
     */
    logout: async () => {
      try {
        useConfigStore.getState().cleanup();
        useCierreStore.getState().cleanup();
        useProductStore.getState().cleanup();
        useInventoryStore.getState().cleanup();
        useGandolaStore.getState().cleanup();

        if (isFirebaseConfigured()) {
          try {
            const db = getDb();
            await disableNetwork(db);
          } catch (_) {}
        }

        const auth = getFirebaseAuth();
        await signOut(auth);
      } catch (error) {
        // Error no critico — el estado se limpia de todas formas
      }
      clearCachedProfile();
      set({ user: null, isAuthenticated: false });
    },

    /**
     * Cambiar la contraseña del usuario actual.
     */
    changePassword: async (currentPassword, newPassword) => {
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;

        if (!currentUser) {
          throw new Error('No hay sesión activa');
        }

        const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);

        return true;
      } catch (error) {
        const messages = {
          'auth/wrong-password': 'La contraseña actual es incorrecta',
          'auth/invalid-credential': 'La contraseña actual es incorrecta',
          'auth/weak-password': 'La nueva contraseña debe tener al menos 6 caracteres',
          'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo',
          'auth/network-request-failed': 'Error de conexión. Verifique su internet.',
          'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
        };
        throw new Error(messages[error.code] || 'Error al cambiar la contraseña');
      }
    },

    /**
     * Enviar email de recuperacion de contraseña
     */
    sendPasswordReset: async (email) => {
      try {
        const auth = getFirebaseAuth();
        await sendPasswordResetEmail(auth, email);
        return true;
      } catch (error) {
        const messages = {
          'auth/invalid-email': 'Correo electrónico inválido',
          'auth/user-not-found': 'No hay cuenta asociada a este correo',
        };
        throw new Error(messages[error.code] || 'Error al enviar correo de recuperación');
      }
    },

    // --- Gestion de usuarios (solo para admin) ---

    getAllUsers: async () => {
      if (!isFirebaseConfigured()) return [];
      try {
        const db = getDb();
        const snapshot = await getDocs(collection(db, 'users'));
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (error) {
        return [];
      }
    },

    /**
     * Crear un nuevo usuario via Netlify Function (server-side).
     */
    createUser: async (userData) => {
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No hay sesión activa');
        }

        const token = await currentUser.getIdToken();

        const response = await fetch('/.netlify/functions/createUser', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: userData.name,
            email: userData.email,
            password: userData.password,
            role: userData.role,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al crear usuario');
        }

        return data;
      } catch (error) {
        if (error.message && !error.message.includes('Failed to fetch')) {
          throw error;
        }
        const messages = {
          'auth/network-request-failed': 'Error de conexión. Verifique su internet.',
        };
        throw new Error(messages[error.code] || 'Error de conexión al crear usuario');
      }
    },

    /**
     * Actualizar perfil de usuario en Firestore
     */
    updateUser: async (id, updates) => {
      try {
        const db = getDb();
        const cleanUpdates = {};
        if (updates.name !== undefined) cleanUpdates.name = updates.name;
        if (updates.role !== undefined) cleanUpdates.role = updates.role;
        if (updates.active !== undefined) cleanUpdates.active = updates.active;

        await updateDoc(doc(db, 'users', id), cleanUpdates);

        // Si el usuario actualizo su propio perfil, refrescar cache + state
        if (get().user?.uid === id) {
          const updatedUser = { ...get().user, ...cleanUpdates };
          // Reconstruir profile para cache (sin uid ni email)
          const { uid, email, ...profile } = updatedUser;
          setCachedProfile(uid, profile);
          set({ user: updatedUser });
        }
      } catch (error) {
        throw error;
      }
    },

    /**
     * Eliminar usuario via serverless function.
     */
    deleteUser: async (id) => {
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('No hay sesión activa');
        }

        const token = await currentUser.getIdToken();

        const response = await fetch('/.netlify/functions/deleteUser', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ uid: id }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al eliminar usuario');
        }

        return data;
      } catch (error) {
        throw error;
      }
    },

    // --- Sidebar ---
    sidebarOpen: true,
    toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
    setSidebarOpen: (open) => set({ sidebarOpen: open }),

    isAdmin: () => get().user?.role === 'administrador',
    isSupervisor: () => get().user?.role === 'supervisor',
  })
);

/**
 * Refresca el perfil del usuario en background (no bloquea UI).
 * Se llama despues de restaurar desde cache.
 * - Si el perfil sigue activo, actualiza cache + state.
 * - Si el perfil fue desactivado o eliminado, cierra sesion.
 * - Si Firestore falla, NO hace nada (seguimos con cache).
 */
async function refreshProfileInBackground(firebaseUser, auth, set) {
  try {
    const profile = await readProfileWithRetry(firebaseUser.uid);

    if (!profile || profile.active === false) {
      // Usuario desactivado o perfil eliminado — cerrar sesion
      console.warn('[Auth] Perfil desactivado/eliminado detectado en background. Cerrando sesion.');
      clearCachedProfile();
      try { await signOut(auth); } catch (_) {}
      set({ user: null, isAuthenticated: false });
      return;
    }

    // Perfil OK — actualizar cache + state
    setCachedProfile(firebaseUser.uid, profile);
    set({
      user: {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        ...profile,
      },
    });
  } catch (error) {
    // No bloquear UI — seguimos con cache
    console.warn('[Auth] Refresh background fallo (usando cache):', error.message);
  }
}

export default useStore;