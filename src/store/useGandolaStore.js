import { create } from 'zustand';
import { generateId, getVenezuelaDateString } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import {
  getCurrentReception, getReceptionsHistory, initReception,
  updateCurrentReception, closeReception, cancelReception
} from '../services/firestore.js';
import { auth } from '../config/firebase.js';

function createEmptyTankReception(tankId) {
  return {
    tankId,
    cmBefore: 0,
    litersBefore: 0,
    cmAfter: 0,
    litersAfter: 0,
    cmDifference: 0,
    litersDifference: 0,
  };
}

function createEmptyGandolaReceptionLocal() {
  return {
    id: generateId(),
    date: getVenezuelaDateString(),
    supervisorName: '',
    gandolaPlate: '',
    gandolaDriver: '',
    productType: '',
    tankReadings: [1, 2, 3].map(createEmptyTankReception),
    observations: '',
    status: 'en_proceso',
    createdAt: new Date().toISOString(),
  };
}

const useGandolaStore = create((set, get) => ({
  currentReception: null,
  currentReceptionId: null,
  receptionsHistory: [],
  _saving: false,

  initNewReception: async () => {
    try {
      const uid = auth.currentUser?.uid;
      const result = await initReception(uid);
      if (result.success) {
        const reception = createEmptyGandolaReceptionLocal();
        reception.id = result.id;
        set({ currentReception: reception, currentReceptionId: result.id });
      }
    } catch (err) {
      console.error('Error init reception:', err.message);
    }
  },

  loadCurrentReception: async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { set({ currentReception: null }); return; }
      const reception = await getCurrentReception(uid);
      if (reception) {
        // Firestore returns native arrays, no JSON.parse needed
        const parsed = {
          ...reception,
          tankReadings: reception.tankReadings || [],
        };
        set({ currentReception: parsed, currentReceptionId: reception.id });
      } else {
        set({ currentReception: null, currentReceptionId: null });
      }
    } catch (err) {
      console.error('Error loading current reception:', err.message);
      set({ currentReception: null, currentReceptionId: null });
    }
  },

  _persist: async () => {
    const { currentReception, currentReceptionId, _saving } = get();
    if (!currentReception || !currentReceptionId || _saving) return;
    set({ _saving: true });
    try {
      await updateCurrentReception(currentReceptionId, {
        supervisorName: currentReception.supervisorName,
        gandolaPlate: currentReception.gandolaPlate,
        gandolaDriver: currentReception.gandolaDriver,
        productType: currentReception.productType,
        tankReadings: currentReception.tankReadings,
        observations: currentReception.observations,
      });
    } catch (err) {
      console.error('Error persisting reception:', err.message);
    }
    set({ _saving: false });
  },

  saveCurrentReception: () => {
    get()._persist();
  },

  updateReceptionField: (field, value) => {
    const { currentReception } = get();
    if (!currentReception) return;
    const updated = { ...currentReception, [field]: value };
    set({ currentReception: updated });
    get()._persist();
  },

  updateTankReception: (index, field, value) => {
    const { currentReception } = get();
    if (!currentReception) return;
    const updated = { ...currentReception };
    updated.tankReadings = [...updated.tankReadings];

    const numValue = (field === 'cmBefore' || field === 'cmAfter') ? (parseFloat(value) || 0) : value;
    updated.tankReadings[index] = { ...updated.tankReadings[index], [field]: numValue };

    if (field === 'cmBefore') {
      updated.tankReadings[index].litersBefore = cmToLiters(numValue);
    }
    if (field === 'cmAfter') {
      updated.tankReadings[index].litersAfter = cmToLiters(numValue);
    }

    const tank = updated.tankReadings[index];
    tank.cmDifference = tank.cmAfter - tank.cmBefore;
    tank.litersDifference = tank.litersAfter - tank.litersBefore;

    set({ currentReception: updated });
    get()._persist();
  },

  closeReception: async () => {
    const { currentReception, currentReceptionId, receptionsHistory } = get();
    if (!currentReception || !currentReceptionId) return;
    try {
      await updateCurrentReception(currentReceptionId, {
        supervisorName: currentReception.supervisorName,
        gandolaPlate: currentReception.gandolaPlate,
        gandolaDriver: currentReception.gandolaDriver,
        productType: currentReception.productType,
        tankReadings: currentReception.tankReadings,
        observations: currentReception.observations,
      });
      await closeReception(currentReceptionId);
      const closed = { ...currentReception, status: 'completada', closedAt: new Date().toISOString() };
      const newHistory = [closed, ...receptionsHistory].slice(0, 100);
      set({ currentReception: null, currentReceptionId: null, receptionsHistory: newHistory });
    } catch (err) {
      console.error('Error closing reception:', err.message);
    }
  },

  loadReceptionsHistory: async () => {
    try {
      const history = await getReceptionsHistory();
      set({ receptionsHistory: history });
    } catch (err) {
      console.error('Error loading reception history:', err.message);
    }
  },

  cancelReception: async () => {
    const { currentReceptionId } = get();
    if (!currentReceptionId) return;
    try {
      await cancelReception(currentReceptionId);
      set({ currentReception: null, currentReceptionId: null });
    } catch (err) {
      console.error('Error canceling reception:', err.message);
    }
  },
}));

export { useGandolaStore };
