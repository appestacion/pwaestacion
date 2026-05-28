// src/store/useStore.js
// Store de autenticacion y usuarios con Firebase Authentication + Firestore (perfiles)
//
// SEGURIDAD v2:
//   - H5: createUser ahora delega a Netlify Function (server-side) en vez de
//         crear usuarios directamente desde el cliente con Firebase Auth.
//   - H6: Se deja de persistir 'user' e 'isAuthenticated' en localStorage.
//         El rol se lee SIEMPRE desde Firestore (onAuthStateChanged) para
//         evitar escalada de privilegios vía DevTools.

import { create } from 'zustand';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
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

const useStore = create(
  (set, get) => ({
    // --- Estado de autenticacion ---
    user: null,
    isAuthenticated: false,
    authLoading: true,

    /**
     * Inicializar el listener de Firebase Auth (onAuthStateChanged).
     * Debe llamarse UNA vez al arrancar la app.
     */
    initAuth: () => {
      if (authListenerSetup) return;
      authListenerSetup = true;

      if (!isFirebaseConfigured()) {
        set({ authLoading: false });
        return;
      }

      const auth = getFirebaseAuth();

      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          try {
            const db = getDb();

            // Asegurar que Firestore este online antes de leer el perfil.
            try {
              await enableNetwork(db);
            } catch (_) {}

            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));

            if (userDoc.exists()) {
              const profile = userDoc.data();
              if (profile.active !== false) {
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
            }
            // Sin perfil o inactivo: cerrar sesión
            await signOut(auth);
          } catch (error) {
            if (error.message?.includes('Target ID already exists')) return;
            console.error('Error cargando perfil del usuario:', error);
            try { await signOut(auth); } catch (_) {}
          }
        }
        set({ user: null, isAuthenticated: false, authLoading: false });
      });
    },

    /**
     * Iniciar sesión con email y password via Firebase Auth.
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
     * Cerrar sesión.
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
        console.error('Error cerrando sesión:', error);
      }
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
        console.error('Error cargando usuarios:', error);
        return [];
      }
    },

    /**
     * Crear un nuevo usuario via Netlify Function (server-side).
     * FIX H5: Ya NO usa Firebase Auth directamente desde el cliente.
     * La función del servidor valida que el llamante sea administrador
     * y que el rol asignado sea válido (lista blanca).
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
        // Si el error ya tiene un mensaje amigable (de la función), usarlo
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

        if (get().user?.uid === id) {
          set({ user: { ...get().user, ...cleanUpdates } });
        }
      } catch (error) {
        console.error('Error actualizando usuario:', error);
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
        console.error('Error eliminando usuario:', error);
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

export default useStore;