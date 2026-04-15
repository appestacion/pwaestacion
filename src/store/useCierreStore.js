import { create } from 'zustand';
import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';
import { generateId, getVenezuelaDateString } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import { calcLitersSold, calcPVTotalUSD, pvUSDToBs } from '../lib/calculations.js';
import {
  getCurrentShift, getShiftsHistory, initShift, updateCurrentShift, closeShift as closeShiftFS
} from '../services/firestore.js';
import { auth } from '../config/firebase.js';

function createEmptyIsland(islandId) {
  return {
    islandId,
    operatorName: '',
    cortesBs: new Array(12).fill(0),
    cortesUSD: new Array(12).fill(0),
    bsAdicionales: 0,
    usdAdicionales: 0,
    pvMonto1: 0,
    pvMonto2: 0,
    pvMonto3: 0,
    pvTotalUSD: 0,
    pvTotalBs: 0,
    pv2Monto1: 0,
    pv2Monto2: 0,
    pv2Monto3: 0,
    pv2TotalUSD: 0,
    pv2TotalBs: 0,
    ueUSD: 0,
    valesMonto: 0,
    valesDescripcion: '',
    transferenciaMonto: 0,
    transferenciaDescripcion: '',
    productsSold: [],
  };
}

function createEmptyPumpReading(islandId, pumpNumber) {
  return { islandId, pumpNumber, initialReading: 0, finalReading: 0, litersSold: 0 };
}

function createEmptyTankReading(tankId) {
  return { tankId, cm: 0, liters: 0 };
}

function createEmptyShiftLocal(operatorShiftType, supervisorShiftType, tasa1, tasa2) {
  const pumpReadings = [];
  for (const islandId of [1, 2, 3]) {
    for (const pumpNumber of [1, 2]) {
      pumpReadings.push(createEmptyPumpReading(islandId, pumpNumber));
    }
  }
  const tankReadings = [1, 2, 3].map(createEmptyTankReading);
  const islands = [1, 2, 3].map(createEmptyIsland);

  return {
    id: generateId(),
    date: getVenezuelaDateString(),
    operatorShiftType,
    supervisorShiftType,
    tasa1,
    tasa2,
    pumpReadings,
    tankReadings,
    gandolaLiters: 0,
    islands,
    status: 'en_progreso',
    createdAt: new Date().toISOString(),
  };
}

const useCierreStore = create((set, get) => ({
  currentShift: null,
  currentShiftId: null,
  shiftsHistory: [],
  _saving: false,

  initNewShift: async (supervisorShiftType, tasa1, tasa2) => {
    try {
      const operatorShiftType = supervisorShiftType === 'AM' ? 'NOCTURNO' : 'DIURNO';
      const uid = auth.currentUser?.uid;
      const result = await initShift({
        operatorShiftType,
        supervisorShiftType,
        tasa1: parseFloat(tasa1) || 0,
        tasa2: parseFloat(tasa2) || 0,
        pumpReadings: [],
        tankReadings: [],
        islands: [],
        gandolaLiters: 0,
      }, uid);

      if (result.success) {
        const shift = createEmptyShiftLocal(operatorShiftType, supervisorShiftType, tasa1, tasa2);
        shift.id = result.id;
        set({ currentShift: shift, currentShiftId: result.id });
      }
    } catch (err) {
      console.error('Error init shift:', err.message);
    }
  },

  loadCurrentShift: async () => {
    try {
      const uid = auth.currentUser?.uid;
      if (!uid) { set({ currentShift: null }); return; }
      const shift = await getCurrentShift(uid);
      if (shift) {
        // Firestore returns native arrays/objects, no JSON.parse needed
        const parsed = {
          ...shift,
          tasa1: parseFloat(shift.tasa1) || 0,
          tasa2: parseFloat(shift.tasa2) || 0,
          gandolaLiters: parseFloat(shift.gandolaLiters) || 0,
          pumpReadings: shift.pumpReadings || [],
          tankReadings: shift.tankReadings || [],
          islands: shift.islands || [],
        };
        set({ currentShift: parsed, currentShiftId: shift.id });
      } else {
        set({ currentShift: null, currentShiftId: null });
      }
    } catch (err) {
      console.error('Error loading current shift:', err.message);
      set({ currentShift: null, currentShiftId: null });
    }
  },

  _persist: async () => {
    const { currentShift, currentShiftId, _saving } = get();
    if (!currentShift || !currentShiftId || _saving) return;
    set({ _saving: true });
    try {
      await updateCurrentShift(currentShiftId, {
        pumpReadings: currentShift.pumpReadings,
        tankReadings: currentShift.tankReadings,
        islands: currentShift.islands,
        tasa1: currentShift.tasa1,
        tasa2: currentShift.tasa2,
        gandolaLiters: currentShift.gandolaLiters,
      });
    } catch (err) {
      console.error('Error persisting shift:', err.message);
    }
    set({ _saving: false });
  },

  saveCurrentShift: () => {
    get()._persist();
  },

  updatePumpReading: (index, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.pumpReadings = [...updated.pumpReadings];
    const reading = { ...updated.pumpReadings[index], [field]: value };
    reading.litersSold = calcLitersSold(reading);
    updated.pumpReadings[index] = reading;
    set({ currentShift: updated });
    get()._persist();
  },

  updateTankReading: (index, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.tankReadings = [...updated.tankReadings];
    const tank = { ...updated.tankReadings[index], [field]: value };
    const cmValue = parseFloat(tank.cm) || 0;
    tank.cm = cmValue;
    tank.liters = cmToLiters(cmValue);
    updated.tankReadings[index] = tank;
    set({ currentShift: updated });
    get()._persist();
  },

  updateIslandField: (islandId, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) =>
      isl.islandId === islandId ? { ...isl, [field]: value } : isl
    );
    set({ currentShift: updated });
    get()._persist();
  },

  updateCorteBs: (islandId, index, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const newCortes = [...isl.cortesBs];
      newCortes[index] = value;
      return { ...isl, cortesBs: newCortes };
    });
    set({ currentShift: updated });
    get()._persist();
  },

  updateCorteUSD: (islandId, index, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const newCortes = [...isl.cortesUSD];
      newCortes[index] = value;
      return { ...isl, cortesUSD: newCortes };
    });
    set({ currentShift: updated });
    get()._persist();
  },

  recalcIslandPV: (islandId) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const pvTotalUSD = calcPVTotalUSD(isl.pvMonto1, isl.pvMonto2, isl.pvMonto3);
      const pvTotalBs = pvUSDToBs(pvTotalUSD, updated.tasa1);
      const pv2TotalUSD = calcPVTotalUSD(isl.pv2Monto1, isl.pv2Monto2, isl.pv2Monto3);
      const pv2TotalBs = updated.tasa2 > 0 ? pvUSDToBs(pv2TotalUSD, updated.tasa2) : 0;
      return { ...isl, pvTotalUSD, pvTotalBs, pv2TotalUSD, pv2TotalBs };
    });
    set({ currentShift: updated });
    get()._persist();
  },

  setGandolaLiters: (liters) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift, gandolaLiters: liters };
    set({ currentShift: updated });
    get()._persist();
  },

  updateTasa: (field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    set({ currentShift: { ...currentShift, [field]: value } });
    get()._persist();
  },

  closeShift: async () => {
    const { currentShift, currentShiftId, shiftsHistory } = get();
    if (!currentShift || !currentShiftId) return;

    // Final recalculation
    const updated = { ...currentShift };
    updated.pumpReadings = updated.pumpReadings.map((r) => ({
      ...r,
      litersSold: calcLitersSold(r),
    }));
    updated.tankReadings = updated.tankReadings.map((r) => {
      const cmVal = parseFloat(r.cm) || 0;
      return { ...r, cm: cmVal, liters: cmToLiters(cmVal) };
    });
    updated.islands = updated.islands.map((isl) => ({
      ...isl,
      pvTotalUSD: calcPVTotalUSD(isl.pvMonto1, isl.pvMonto2, isl.pvMonto3),
      pvTotalBs: pvUSDToBs(calcPVTotalUSD(isl.pvMonto1, isl.pvMonto2, isl.pvMonto3), updated.tasa1),
      pv2TotalUSD: calcPVTotalUSD(isl.pv2Monto1, isl.pv2Monto2, isl.pv2Monto3),
      pv2TotalBs: updated.tasa2 > 0 ? pvUSDToBs(calcPVTotalUSD(isl.pv2Monto1, isl.pv2Monto2, isl.pv2Monto3), updated.tasa2) : 0,
    }));

    set({ currentShift: updated });
    try {
      // Persist final state then close
      await updateCurrentShift(currentShiftId, {
        pumpReadings: updated.pumpReadings,
        tankReadings: updated.tankReadings,
        islands: updated.islands,
        tasa1: updated.tasa1,
        tasa2: updated.tasa2,
        gandolaLiters: updated.gandolaLiters,
      });
      await closeShiftFS(currentShiftId);
      const closedShift = { ...updated, status: 'cerrado', closedAt: new Date().toISOString() };
      const newHistory = [closedShift, ...shiftsHistory].slice(0, 50);
      set({ currentShift: null, currentShiftId: null, shiftsHistory: newHistory });
    } catch (err) {
      console.error('Error closing shift:', err.message);
    }
  },

  addProductSold: (islandId, product) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      return { ...isl, productsSold: [...isl.productsSold, product] };
    });
    set({ currentShift: updated });
    get()._persist();
  },

  removeProductSold: (islandId, index) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const newProducts = [...isl.productsSold];
      newProducts.splice(index, 1);
      return { ...isl, productsSold: newProducts };
    });
    set({ currentShift: updated });
    get()._persist();
  },

  loadShiftsHistory: async () => {
    try {
      const shifts = await getShiftsHistory();
      // Firestore returns native data, no JSON.parse needed
      const parsed = shifts.map((s) => ({
        ...s,
        tasa1: parseFloat(s.tasa1) || 0,
        tasa2: parseFloat(s.tasa2) || 0,
        gandolaLiters: parseFloat(s.gandolaLiters) || 0,
      }));
      set({ shiftsHistory: parsed });
    } catch (err) {
      console.error('Error loading shift history:', err.message);
    }
  },

  getShiftById: (id) => {
    const { shiftsHistory } = get();
    return shiftsHistory.find((s) => s.id === id);
  },
}));

export { useCierreStore };
