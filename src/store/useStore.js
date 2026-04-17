// src/store/useStore.js
// Store de autenticacion y usuarios con Firebase Authentication + Firestore (perfiles)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../services/storage.js';
import { getFirebaseAuth, getSecondaryAuth, getDb, isFirebaseConfigured } from '../config/firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
} from 'firebase/firestore';

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
              // Sin perfil o inactivo: cerrar sesion
              await signOut(auth);
            } catch (error) {
              console.error('Error cargando perfil del usuario:', error);
              try { await signOut(auth); } catch (_) {}
            }
          }
          set({ user: null, isAuthenticated: false, authLoading: false });
        });
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
            'auth/invalid-email': 'Correo electronico invalido',
            'auth/user-disabled': 'Usuario desactivado',
            'auth/user-not-found': 'Usuario no encontrado',
            'auth/wrong-password': 'Contrasena incorrecta',
            'auth/invalid-credential': 'Correo o contrasena incorrectos',
            'auth/too-many-requests': 'Demasiados intentos. Intente mas tarde.',
            'auth/network-request-failed': 'Error de conexion. Verifique su internet.',
          };
          throw new Error(messages[error.code] || 'Error al iniciar sesion');
        }
      },

      /**
       * Cerrar sesion
       */
      logout: async () => {
        try {
          const auth = getFirebaseAuth();
          await signOut(auth);
        } catch (error) {
          console.error('Error cerrando sesion:', error);
        }
        set({ user: null, isAuthenticated: false });
      },

      /**
       * Enviar email de recuperacion de contrasena
       */
      sendPasswordReset: async (email) => {
        try {
          const auth = getFirebaseAuth();
          await sendPasswordResetEmail(auth, email);
          return true;
        } catch (error) {
          const messages = {
            'auth/invalid-email': 'Correo electronico invalido',
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
            'auth/weak-password': 'La contrasena debe tener al menos 6 caracteres',
            'auth/invalid-email': 'Correo electronico invalido',
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
       * Eliminar usuario: borra el perfil de Firestore.
       * El usuario de Firebase Auth seguira existiendo pero no tendra perfil.
       */
      deleteUser: async (id) => {
        try {
          const db = getDb();
          await deleteDoc(doc(db, 'users', id));
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