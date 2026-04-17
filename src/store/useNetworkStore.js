// src/store/useNetworkStore.js
// Detecta el estado de conexion a internet

import { create } from 'zustand';

const useNetworkStore = create((set) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,

  init: () => {
    if (typeof window === 'undefined') return;

    const update = () => set({ isOnline: navigator.onLine });
    window.addEventListener('online', update);
    window.addEventListener('offline', update);

    // Set inicial
    set({ isOnline: navigator.onLine });
  },
}));

export { useNetworkStore };