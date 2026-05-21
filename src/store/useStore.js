// src/store/useStore.js
// Store de autenticacion y usuarios con Firebase Authentication + Firestore (perfiles)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getFirebaseAuth, getSecondaryAuth, getDb, isFirebaseConfigured } from '../config/firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  disableNetwork,
  enableNetwork,
} from 'firebase/firestore';
import { useConfigStore } from './useConfigStore.js';
import { useCierreStore } from './useCierreStore.js';
import { useProductStore } from './useProductStore.js';
import { useInventoryStore } from './useInventoryStore.js';
import { useGandolaStore } from './useGandolaStore.js';

// Bandera para evitar registrar el listener multiples veces
let authListenerSetup = false;

const useStore = create(
  persist(
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
              // Esto es necesario despues de un logout (que llama disableNetwork).
              // Ignora el error "Target ID already exists" si ya estaba habilitado.
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
              // React 18 StrictMode dispara onAuthStateChanged 2 veces.
              // Firestore lanza "Target ID already exists" en la 2da llamada.
              // No es un error real — ignorar y NO cerrar sesión.
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
            'auth/invalid-email': 'Correo electrónico invalido',
            'auth/user-disabled': 'Usuario desactivado',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'contraseña incorrecta',
            'auth/invalid-credential': 'Correo o contraseña incorrectos',
            'auth/too-many-requests': 'Demasiados intentos. Intente mas tarde.',
            'auth/network-request-failed': 'Error de conexion. Verifique su internet.',
          };
          throw new Error(messages[error.code] || 'Error al iniciar sesión');
        }
      },

      /**
       * Cerrar sesión.
       * 1. Limpia todos los listeners de Firestore
       * 2. Deshabilita la red de Firestore (bloquea reconexiones sin auth)
       * 3. Ejecuta signOut de Firebase Auth
       * NOTA: enableNetwork() se rehabilita automaticamente en initAuth()
       * (onAuthStateChanged) cuando el usuario vuelva a iniciar sesion.
       */
      logout: async () => {
        try {
          // Paso 1: Limpiar todos los listeners de Firestore
          useConfigStore.getState().cleanup();
          useCierreStore.getState().cleanup();
          useProductStore.getState().cleanup();
          useInventoryStore.getState().cleanup();
          useGandolaStore.getState().cleanup();

          // Paso 2: Deshabilitar red de Firestore
          if (isFirebaseConfigured()) {
            try {
              const db = getDb();
              await disableNetwork(db);
            } catch (_) {}
          }

          // Paso 3: Cerrar sesión en Firebase Auth
          const auth = getFirebaseAuth();
          await signOut(auth);
        } catch (error) {
          console.error('Error cerrando sesión:', error);
        }
        set({ user: null, isAuthenticated: false });
      },

      /**
       * Cambiar la contraseña del usuario actual.
       * Requiere la contraseña actual para re-autenticar (politica de Firebase).
       *
       * @param {string} currentPassword - Contraseña actual del usuario
       * @param {string} newPassword - Nueva contraseña (minimo 6 caracteres)
       * @returns {Promise<boolean>} true si se cambio correctamente
       * @throws {Error} Si la contraseña actual es incorrecta o la nueva es debil
       */
      changePassword: async (currentPassword, newPassword) => {
        try {
          const auth = getFirebaseAuth();
          const currentUser = auth.currentUser;

          if (!currentUser) {
            throw new Error('No hay sesión activa');
          }

          // Re-autenticar con la contraseña actual antes de cambiarla
          const credential = EmailAuthProvider.credential(currentUser.email, currentPassword);
          await reauthenticateWithCredential(currentUser, credential);

          // Cambiar la contraseña
          await updatePassword(currentUser, newPassword);

          return true;
        } catch (error) {
          const messages = {
            'auth/wrong-password': 'La contraseña actual es incorrecta',
            'auth/invalid-credential': 'La contraseña actual es incorrecta',
            'auth/weak-password': 'La nueva contraseña debe tener al menos 6 caracteres',
            'auth/requires-recent-login': 'Por seguridad, vuelve a iniciar sesión e intenta de nuevo',
            'auth/network-request-failed': 'Error de conexion. Verifique su internet.',
            'auth/too-many-requests': 'Demasiados intentos. Intente mas tarde.',
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
            'auth/invalid-email': 'Correo electrónico invalido',
            'auth/user-not-found': 'No hay cuenta asociada a este correo',
          };
          throw new Error(messages[error.code] || 'Error al enviar correo de recuperacion');
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
       * Crear un nuevo usuario:
       * 1. Crea el usuario en Firebase Auth (via auth secundario)
       * 2. Crea el perfil en Firestore
       */
      createUser: async (userData) => {
        try {
          const secondaryAuth = getSecondaryAuth();
          const userCredential = await createUserWithEmailAndPassword(
            secondaryAuth,
            userData.email,
            userData.password,
          );

          const db = getDb();
          const profile = {
            name: userData.name,
            email: userData.email,
            role: userData.role,
            active: true,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'users', userCredential.user.uid), profile);
          await signOut(secondaryAuth);

          return { id: userCredential.user.uid, ...profile };
        } catch (error) {
          const messages = {
            'auth/email-already-in-use': 'Este correo ya esta registrado',
            'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
            'auth/invalid-email': 'Correo  invalido',
            'auth/network-request-failed': 'Error de conexion. Verifique su internet.',
          };
          throw new Error(messages[error.code] || 'Error al crear usuario');
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
    }),
    {
      name: 'cierre-smf-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useStore;