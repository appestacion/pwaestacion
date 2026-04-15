import { create } from 'zustand';
import { getStationConfig, updateStationConfig, resetStationConfig } from '../services/firestore.js';

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
};

const useConfigStore = create((set, get) => ({
  config: defaultConfig,

  loadConfig: async () => {
    try {
      const config = await getStationConfig();
      if (config) {
        set({ config: { ...defaultConfig, ...config } });
      }
    } catch (err) {
      console.error('Error loading config:', err.message);
    }
  },

  updateConfig: async (updates) => {
    try {
      await updateStationConfig(updates);
      set({ config: { ...get().config, ...updates } });
    } catch (err) {
      console.error('Error updating config:', err.message);
      throw err;
    }
  },

  resetConfig: async () => {
    try {
      await resetStationConfig();
      set({ config: defaultConfig });
    } catch (err) {
      console.error('Error resetting config:', err.message);
    }
  },
}));

export { useConfigStore, defaultConfig };
