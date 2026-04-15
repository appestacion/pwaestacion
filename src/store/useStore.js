import { create } from 'zustand';
import { subscribeToAuthChanges, loginUser, logoutUser } from '../services/auth';
import { getUsers, updateUser as updateUserFS } from '../services/firestore';
import { auth } from '../config/firebase';

const useStore = create((set, get) => ({
  // Auth
  user: null,
  loading: true,
  initialized: false,

  // Login
  login: async (email, password) => {
    try {
      const result = await loginUser(email, password);
      if (result.success) {
        set({ user: result.user, isAuthenticated: true });
        return true;
      } else {
        console.error('Login failed:', result.error);
        return false;
      }
    } catch (err) {
      console.error('Login failed:', err.message);
      return false;
    }
  },

  // Logout
  logout: async () => {
    await logoutUser();
    set({ user: null, isAuthenticated: false });
  },

  // Inicializar autenticación (patrón ondelivery)
  initAuth: () => {
    if (get().initialized) return;
    set({ initialized: true });

    const unsubscribe = subscribeToAuthChanges((user) => {
      if (user) {
        console.log('Auth state changed - user:', user.email);
        set({ user, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
      set({ loading: false });
    });
  },

  loadSession: async () => {
    // Ya manejado por initAuth + onAuthStateChanged
    if (!get().initialized) {
      get().initAuth();
    }
  },

  // User management (admin) - usa Netlify Functions para Auth + Firestore
  getAllUsers: async () => {
    try {
      return await getUsers();
    } catch (err) {
      console.error('Error loading users:', err.message);
      return [];
    }
  },

  createUser: async (userData) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/.netlify/functions/createUser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(userData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Error creating user:', err.message);
      throw err;
    }
  },

  updateUser: async (id, updates) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/.netlify/functions/updateUser', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: id, ...updates }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Error updating user:', err.message);
      throw err;
    }
  },

  deleteUser: async (id) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/.netlify/functions/deleteUser', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ uid: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('Error deleting user:', err.message);
      throw err;
    }
  },

  // Seed defaults
  seedDefaults: async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/.netlify/functions/seedDefaults', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
      });
      return await response.json();
    } catch (err) {
      console.error('Error seeding defaults:', err.message);
      throw err;
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
}));

export default useStore;
