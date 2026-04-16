// src/store/useCierreStore.js
// Store de cierres de turno con Firebase Firestore (historial) + localStorage (turno activo)

import { create } from 'zustand';
import { useConfigStore } from './useConfigStore.js';
import { generateId, getVenezuelaDateString } from '../lib/formatters.js';
import { calcLitersSold } from '../lib/calculations.js';
import { cmToLiters } from '../lib/conversions.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';

const STORAGE_KEYS = {
  CURRENT_SHIFT: 'pdv_current_shift',
  SHIFTS: 'pdv_shifts',
};

function createEmptyIsland(islandId, maxCortes = 12) {
  return {
    islandId,
    operatorName: '',
    cortesBs: new Array(maxCortes).fill(0),
    cortesUSD: new Array(maxCortes).fill(0),
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
    vales: [],
    transferencias: [],
    productsSold: [],
  };
}

function createEmptyPumpReading(islandId, pumpNumber) {
  return { islandId, pumpNumber, initialReading: 0, finalReading: 0, litersSold: 0 };
}

function createEmptyTankReading(tankId) {
  return { tankId, cm: 0, liters: 0 };
}

function createEmptyShift(operatorShiftType, supervisorShiftType, tasa1, tasa2, config = {}) {
  const islandsCount = config.islandsCount || 3;
  const pumpsPerIsland = config.pumpsPerIsland || 2;
  const tanksCount = config.tanksCount || 3;
  const maxCortes = config.maxCortes || 12;

  const pumpReadings = [];
  for (let i = 1; i <= islandsCount; i++) {
    for (let j = 1; j <= pumpsPerIsland; j++) {
      pumpReadings.push(createEmptyPumpReading(i, j));
    }
  }
  const tankReadings = [];
  for (let t = 1; t <= tanksCount; t++) {
    tankReadings.push(createEmptyTankReading(t));
  }
  const islands = [];
  for (let i = 1; i <= islandsCount; i++) {
    islands.push(createEmptyIsland(i, maxCortes));
  }

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

// Migrate old island format to new format
function migrateIsland(isl, maxCortes) {
  const migrated = { ...isl };

  if (!Array.isArray(migrated.vales)) {
    if (migrated.valesMonto > 0) {
      migrated.vales = [{ monto: migrated.valesMonto || 0, descripcion: migrated.valesDescripcion || '' }];
    } else {
      migrated.vales = [];
    }
  }
  delete migrated.valesMonto;
  delete migrated.valesDescripcion;

  if (!Array.isArray(migrated.transferencias)) {
    if (migrated.transferenciaMonto > 0) {
      migrated.transferencias = [{ monto: migrated.transferenciaMonto || 0, descripcion: migrated.transferenciaDescripcion || '' }];
    } else {
      migrated.transferencias = [];
    }
  }
  delete migrated.transferenciaMonto;
  delete migrated.transferenciaDescripcion;

  if (!Array.isArray(migrated.cortesBs) || migrated.cortesBs.length !== maxCortes) {
    const old = migrated.cortesBs || [];
    migrated.cortesBs = new Array(maxCortes).fill(0).map((_, i) => old[i] || 0);
  }
  if (!Array.isArray(migrated.cortesUSD) || migrated.cortesUSD.length !== maxCortes) {
    const old = migrated.cortesUSD || [];
    migrated.cortesUSD = new Array(maxCortes).fill(0).map((_, i) => old[i] || 0);
  }

  return migrated;
}

function ensureShiftStructure(shift, config = {}) {
  if (!shift) return shift;
  const maxCortes = config.maxCortes || 12;

  const template = createEmptyShift(
    shift.operatorShiftType || 'DIURNO',
    shift.supervisorShiftType || 'PM',
    shift.tasa1 || 0,
    shift.tasa2 || 0,
    config
  );

  return {
    ...template,
    ...shift,
    id: shift.id || template.id,
    pumpReadings: Array.isArray(shift.pumpReadings) && shift.pumpReadings.length > 0
      ? shift.pumpReadings
      : template.pumpReadings,
    tankReadings: Array.isArray(shift.tankReadings) && shift.tankReadings.length > 0
      ? shift.tankReadings
      : template.tankReadings,
    islands: Array.isArray(shift.islands) && shift.islands.length > 0
      ? shift.islands.map((isl) => migrateIsland(isl, maxCortes))
      : template.islands,
  };
}

/**
 * Guardar un turno cerrado en Firestore
 */
async function saveShiftToFirestore(shift) {
  if (!isFirebaseConfigured()) return false;
  try {
    const { doc, setDoc } = await import('firebase/firestore');
    const db = getDb();
    const shiftRef = doc(db, 'shifts', shift.id);
    const cleanShift = JSON.parse(JSON.stringify(shift));
    await setDoc(shiftRef, cleanShift, { merge: true });
    console.log('Turno guardado en Firestore:', shift.id);
    return true;
  } catch (error) {
    console.error('Error guardando turno en Firestore:', error);
    return false;
  }
}

let unsubscribeShiftsHistory = null;

const useCierreStore = create((set, get) => ({
  currentShift: null,
  shiftsHistory: [],
  firestoreActive: false,
  loadingHistory: false,

  initNewShift: (supervisorShiftType, tasa1, tasa2) => {
    const config = useConfigStore.getState().config || {};
    const operatorShiftType = supervisorShiftType === 'AM' ? 'NOCTURNO' : 'DIURNO';
    const shift = createEmptyShift(operatorShiftType, supervisorShiftType, tasa1, tasa2, config);
    set({ currentShift: shift });
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(shift));
  },

  loadCurrentShift: () => {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_SHIFT);
    if (data) {
      const parsed = JSON.parse(data);
      const config = useConfigStore.getState().config || {};
      set({ currentShift: ensureShiftStructure(parsed, config) });
    }
  },

  saveCurrentShift: () => {
    const { currentShift } = get();
    if (currentShift) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(currentShift));
    }
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
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(updated));
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
    localStorage.setItem(STORAGE_KEYS.CURRENT_SHIFT, JSON.stringify(updated));
  },

  updateIslandField: (islandId, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) =>
      isl.islandId === islandId ? { ...isl, [field]: value } : isl
    );
    set({ currentShift: updated });
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
  },

  // PV montos are in Bs. - recalc converts to USD
  recalcIslandPV: (islandId) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const pvTotalBs = (isl.pvMonto1 || 0) + (isl.pvMonto2 || 0) + (isl.pvMonto3 || 0);
      const pvTotalUSD = updated.tasa1 > 0 ? pvTotalBs / updated.tasa1 : 0;
      const pv2TotalBs = (isl.pv2Monto1 || 0) + (isl.pv2Monto2 || 0) + (isl.pv2Monto3 || 0);
      const pv2TotalUSD = updated.tasa2 > 0 ? pv2TotalBs / updated.tasa2 : 0;
      return { ...isl, pvTotalUSD, pvTotalBs, pv2TotalUSD, pv2TotalBs };
    });
    set({ currentShift: updated });
  },

  setGandolaLiters: (liters) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift, gandolaLiters: liters };
    set({ currentShift: updated });
  },

  updateTasa: (field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    set({ currentShift: { ...currentShift, [field]: value } });
  },

  closeShift: () => {
    const { currentShift, shiftsHistory } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.pumpReadings = updated.pumpReadings.map((r) => ({
      ...r,
      litersSold: calcLitersSold(r),
    }));
    updated.tankReadings = updated.tankReadings.map((r) => ({
      ...r,
      liters: cmToLiters(r.cm),
    }));
    updated.islands = updated.islands.map((isl) => {
      const pvTotalBs = (isl.pvMonto1 || 0) + (isl.pvMonto2 || 0) + (isl.pvMonto3 || 0);
      const pvTotalUSD = updated.tasa1 > 0 ? pvTotalBs / updated.tasa1 : 0;
      const pv2TotalBs = (isl.pv2Monto1 || 0) + (isl.pv2Monto2 || 0) + (isl.pv2Monto3 || 0);
      const pv2TotalUSD = updated.tasa2 > 0 ? pv2TotalBs / updated.tasa2 : 0;
      return { ...isl, pvTotalUSD, pvTotalBs, pv2TotalUSD, pv2TotalBs };
    });

    const closedShift = {
      ...updated,
      status: 'cerrado',
      closedAt: new Date().toISOString(),
    };

    // localStorage: siempre
    const newHistory = [closedShift, ...shiftsHistory].slice(0, 50);
    set({ currentShift: null, shiftsHistory: newHistory });
    localStorage.removeItem(STORAGE_KEYS.CURRENT_SHIFT);
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(newHistory));

    // Firestore: guardar el turno cerrado (async, no bloquea)
    saveShiftToFirestore(closedShift);
  },

  addProductSold: (islandId, product) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      return { ...isl, productsSold: [...(isl.productsSold || []), product] };
    });
    set({ currentShift: updated });
  },

  removeProductSold: (islandId, index) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) => {
      if (isl.islandId !== islandId) return isl;
      const newProducts = [...(isl.productsSold || [])];
      newProducts.splice(index, 1);
      return { ...isl, productsSold: newProducts };
    });
    set({ currentShift: updated });
  },

  /**
   * Cargar historial de turnos: Firestore si disponible, si no localStorage
   */
  loadShiftsHistory: async () => {
    // 1. Siempre cargar de localStorage primero (rápido)
    const localData = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        set({ shiftsHistory: parsed });
      } catch (e) {
        console.error('Error parseando historial localStorage:', e);
      }
    }

    // 2. Si Firebase está configurado, escuchar Firestore en tiempo real
    if (isFirebaseConfigured()) {
      try {
        const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
        const db = getDb();
        const shiftsRef = collection(db, 'shifts');

        // Cancelar listener anterior si existe
        if (unsubscribeShiftsHistory) {
          unsubscribeShiftsHistory();
        }

        unsubscribeShiftsHistory = onSnapshot(
          query(shiftsRef, orderBy('closedAt', 'desc')),
          (snapshot) => {
            const firestoreShifts = [];
            snapshot.forEach((docSnap) => {
              firestoreShifts.push(docSnap.data());
            });

            const config = useConfigStore.getState().config || {};
            const completeShifts = firestoreShifts
              .map((s) => ensureShiftStructure(s, config))
              .slice(0, 50);

            set({ shiftsHistory: completeShifts, firestoreActive: true, loadingHistory: false });

            // Cache en localStorage
            localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(completeShifts));
          },
          (error) => {
            console.error('Error Firestore onSnapshot (shifts):', error);
            set({ firestoreActive: false, loadingHistory: false });
          }
        );

        set({ firestoreActive: true, loadingHistory: true });
      } catch (error) {
        console.error('Error cargando historial de Firestore:', error);
        set({ firestoreActive: false, loadingHistory: false });
      }
    } else {
      set({ firestoreActive: false, loadingHistory: false });
    }
  },

  /**
   * Obtener turnos de una fecha específica (para historial diario)
   * Retorna ambos turnos de un día: AM y PM
   */
  loadShiftsByDate: async (date) => {
    if (isFirebaseConfigured()) {
      try {
        const { collection, query, where, orderBy, getDocs } = await import('firebase/firestore');
        const db = getDb();
        const shiftsRef = collection(db, 'shifts');
        const q = query(shiftsRef, where('date', '==', date), orderBy('closedAt', 'desc'));
        const snapshot = await getDocs(q);

        const shifts = [];
        snapshot.forEach((docSnap) => {
          shifts.push(docSnap.data());
        });

        const config = useConfigStore.getState().config || {};
        return shifts.map((s) => ensureShiftStructure(s, config));
      } catch (error) {
        console.error('Error consultando turnos por fecha:', error);
      }
    }

    // Fallback: buscar en localStorage
    const localData = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (localData) {
      try {
        const all = JSON.parse(localData);
        const config = useConfigStore.getState().config || {};
        return all
          .filter((s) => s.date === date)
          .map((s) => ensureShiftStructure(s, config));
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  /**
   * Obtener un turno específico por ID (para regenerar PDFs)
   */
  getShiftById: async (id) => {
    // Primero buscar en el historial local (rápido)
    const { shiftsHistory } = get();
    const found = shiftsHistory.find((s) => s.id === id);
    if (found) return found;

    // Si Firebase disponible, buscar en Firestore
    if (isFirebaseConfigured()) {
      try {
        const { doc, getDoc } = await import('firebase/firestore');
        const db = getDb();
        const shiftRef = doc(db, 'shifts', id);
        const docSnap = await getDoc(shiftRef);

        if (docSnap.exists()) {
          const shiftData = docSnap.data();
          const config = useConfigStore.getState().config || {};
          return ensureShiftStructure(shiftData, config);
        }
      } catch (error) {
        console.error('Error buscando turno por ID en Firestore:', error);
      }
    }

    return null;
  },

  /**
   * Obtener lista de fechas que tienen turnos cerrados
   * Útil para el calendario de historial diario
   */
  loadDatesWithShifts: async () => {
    if (isFirebaseConfigured()) {
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const db = getDb();
        const shiftsRef = collection(db, 'shifts');
        const snapshot = await getDocs(shiftsRef);

        const dates = new Set();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.date) dates.add(data.date);
        });

        return Array.from(dates).sort().reverse();
      } catch (error) {
        console.error('Error consultando fechas con turnos:', error);
      }
    }

    // Fallback: localStorage
    const localData = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (localData) {
      try {
        const all = JSON.parse(localData);
        const dates = new Set(all.map((s) => s.date).filter(Boolean));
        return Array.from(dates).sort().reverse();
      } catch (e) {
        return [];
      }
    }
    return [];
  },

  /**
   * Limpiar listener de Firestore
   */
  cleanup: () => {
    if (unsubscribeShiftsHistory) {
      unsubscribeShiftsHistory();
      unsubscribeShiftsHistory = null;
    }
  },
}));

export { useCierreStore };
