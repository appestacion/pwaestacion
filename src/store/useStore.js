// src/store/useStore.js
// Store de autenticación y usuarios con Firebase Firestore + localStorage (fallback)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEYS } from '../services/demoData.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';

const useStore = create(
  persist(
    (set, get) => ({
      // Auth
      user: null,
      isAuthenticated: false,
      firestoreUsersActive: false,

      login: async (username, password) => {
        // Si Firebase está configurado, consultar Firestore
        if (isFirebaseConfigured()) {
          try {
            const { collection, getDocs, query, where } = await import('firebase/firestore');
            const db = getDb();
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('username', '==', username));
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
              const userDoc = snapshot.docs[0];
              const userData = userDoc.data();

              if (userData.password === password && userData.active !== false) {
                set({ user: userData, isAuthenticated: true, firestoreUsersActive: true });
                localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(userData));
                return true;
              }
            }

            // Si no encontró en Firestore, buscar en localStorage (compatibilidad)
            const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
            if (usersJson) {
              const users = JSON.parse(usersJson);
              const found = users.find(
                (u) => u.username === username && u.password === password && u.active
              );
              if (found) {
                set({ user: found, isAuthenticated: true });
                localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(found));
                return true;
              }
            }
            return false;
          } catch (error) {
            console.error('Error login Firestore:', error);
            // Fallback a localStorage si hay error
          }
        }

        // Fallback: localStorage
        const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        if (!usersJson) return false;
        const users = JSON.parse(usersJson);
        const found = users.find(
          (u) => u.username === username && u.password === password && u.active
        );
        if (found) {
          set({ user: found, isAuthenticated: true });
          localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(found));
          return true;
        }
        return false;
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
        localStorage.removeItem(STORAGE_KEYS.AUTH);
      },

      loadSession: () => {
        const authJson = localStorage.getItem(STORAGE_KEYS.AUTH);
        if (authJson) {
          const user = JSON.parse(authJson);
          set({ user, isAuthenticated: true });
        }
      },

      getAllUsers: async () => {
        // Si Firebase está configurado, consultar Firestore
        if (isFirebaseConfigured()) {
          try {
            const { collection, getDocs } = await import('firebase/firestore');
            const db = getDb();
            const usersRef = collection(db, 'users');
            const snapshot = await getDocs(usersRef);

            const users = [];
            snapshot.forEach((docSnap) => {
              users.push(docSnap.data());
            });

            // Cache en localStorage
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            set({ firestoreUsersActive: true });
            return users;
          } catch (error) {
            console.error('Error getAllUsers Firestore:', error);
          }
        }

        // Fallback: localStorage
        const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        return usersJson ? JSON.parse(usersJson) : [];
      },

      createUser: async (userData) => {
        const newUser = {
          ...userData,
          id: `user-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };

        // Siempre guardar en localStorage (backup local)
        const users = get().getAllUsersSync
          ? await get().getAllUsersSync()
          : [];
        users.push(newUser);
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

        // Si Firebase está configurado, también guardar en Firestore
        if (isFirebaseConfigured()) {
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            const db = getDb();
            const userRef = doc(db, 'users', newUser.id);
            await setDoc(userRef, newUser, { merge: true });
            set({ firestoreUsersActive: true });
          } catch (error) {
            console.error('Error createUser Firestore:', error);
          }
        }

        return newUser;
      },

      updateUser: async (id, updates) => {
        // Actualizar en localStorage (siempre)
        const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        if (usersJson) {
          const users = JSON.parse(usersJson);
          const idx = users.findIndex((u) => u.id === id);
          if (idx >= 0) {
            users[idx] = { ...users[idx], ...updates };
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

            if (get().user?.id === id) {
              set({ user: users[idx] });
              localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(users[idx]));
            }
          }
        }

        // Si Firebase está configurado, actualizar en Firestore
        if (isFirebaseConfigured()) {
          try {
            const { doc, setDoc } = await import('firebase/firestore');
            const db = getDb();
            const userRef = doc(db, 'users', id);
            await setDoc(userRef, updates, { merge: true });
          } catch (error) {
            console.error('Error updateUser Firestore:', error);
          }
        }
      },

      deleteUser: async (id) => {
        // Eliminar de localStorage (siempre)
        const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
        if (usersJson) {
          const users = JSON.parse(usersJson).filter((u) => u.id !== id);
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
        }

        // Si Firebase está configurado, eliminar de Firestore
        if (isFirebaseConfigured()) {
          try {
            const { doc, deleteDoc } = await import('firebase/firestore');
            const db = getDb();
            const userRef = doc(db, 'users', id);
            await deleteDoc(userRef);
          } catch (error) {
            console.error('Error deleteUser Firestore:', error);
          }
        }
      },

      /**
       * Sincronizar usuarios de localStorage a Firestore
       * Útil para la primera vez que se activa Firebase
       */
      syncUsersToFirestore: async () => {
        if (!isFirebaseConfigured()) return false;
        try {
          const { collection, getDocs, doc, setDoc } = await import('firebase/firestore');
          const db = getDb();

          // Leer usuarios de localStorage
          const usersJson = localStorage.getItem(STORAGE_KEYS.USERS);
          if (!usersJson) return false;
          const users = JSON.parse(usersJson);
          if (users.length === 0) return false;

          // Escribir cada usuario a Firestore
          for (const user of users) {
            const userRef = doc(db, 'users', user.id);
            await setDoc(userRef, user, { merge: true });
          }

          set({ firestoreUsersActive: true });
          console.log(`${users.length} usuarios sincronizados a Firestore`);
          return true;
        } catch (error) {
          console.error('Error sincronizando usuarios a Firestore:', error);
          return false;
        }
      },

      // Sidebar
      sidebarOpen: true,

      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },

      setSidebarOpen: (open) => {
        set({ sidebarOpen: open });
      },

      // Role helpers
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
