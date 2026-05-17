// src/store/useCierreStore.js
// Store de cierres de turno con Firebase Firestore en tiempo real.
// Cloud-only — no localStorage fallback.

import { create } from 'zustand';
import { useConfigStore } from './useConfigStore.js';
import { generateId, getVenezuelaDateString, getVenezuelaDate } from '../lib/formatters.js';
import { calcLitersSold } from '../lib/calculations.js';
import { cmToLiters } from '../lib/conversions.js';
import { isFirebaseConfigured, getDb, getFirebaseAuth } from '../config/firebase.js';
import {
  collection, doc, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, getDocs, getDoc,
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';

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
    gastos: [],
    islands,
    status: 'en_progreso',
    createdAt: new Date().toISOString(),
  };
}

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
      ? shift.pumpReadings.map((r) => ({
          ...r,
          litersSold: Math.max(0, calcLitersSold(r)),
        })) : template.pumpReadings,
    tankReadings: Array.isArray(shift.tankReadings) && shift.tankReadings.length > 0
      ? shift.tankReadings : template.tankReadings,
    islands: Array.isArray(shift.islands) && shift.islands.length > 0
      ? shift.islands.map((isl) => migrateIsland(isl, maxCortes)) : template.islands,
  };
}

let unsubscribeCurrentShift = null;
let unsubscribeShiftsHistory = null;
let syncTimeout = null;

function debounceSyncToFirestore(shift) {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    saveShiftToFirestore(shift);
  }, 2000);
}

async function saveShiftToFirestore(shift) {
  if (!isFirebaseConfigured() || !shift?.id) return;
  try {
    const db = getDb();
    const cleanShift = JSON.parse(JSON.stringify(shift));
    await setDoc(doc(db, 'shifts', shift.id), cleanShift, { merge: true });
  } catch (error) {
    console.error('Error sincronizando turno a Firestore:', error);
  }
}

function getShiftDate(supervisorShiftType) {
  if (supervisorShiftType === 'AM') {
    const yesterday = subDays(getVenezuelaDate(), 1);
    return format(yesterday, 'dd/MM/yyyy');
  }
  return getVenezuelaDateString();
}

const useCierreStore = create((set, get) => ({
  currentShift: null,
  shiftsHistory: [],
  firestoreActive: false,
  loadingHistory: false,

  initNewShift: async (supervisorShiftType, tasa1, tasa2) => {
    const config = useConfigStore.getState().config || {};
    const operatorShiftType = supervisorShiftType === 'AM' ? 'NOCTURNO' : 'DIURNO';
    const shift = createEmptyShift(operatorShiftType, supervisorShiftType, tasa1, tasa2, config);

    // Asignar createdBy para que Firestore rules permitan update
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      shift.createdBy = auth.currentUser.uid;
    }

    shift.date = getShiftDate(supervisorShiftType);

    // ── Heredar lecturas finales del turno anterior como lecturas iniciales ──
    try {
      const prevReadings = await get().getPreviousShiftFinalReadings(operatorShiftType);
      if (prevReadings && prevReadings.pumpReadings && prevReadings.pumpReadings.length > 0) {
        shift.pumpReadings = shift.pumpReadings.map((reading) => {
          const prev = prevReadings.pumpReadings.find(
            (p) => p.islandId === reading.islandId && p.pumpNumber === reading.pumpNumber
          );
          if (prev && prev.finalReading && prev.finalReading > 0) {
            return {
              ...reading,
              initialReading: prev.finalReading,
              litersSold: calcLitersSold({ ...reading, initialReading: prev.finalReading }),
            };
          }
          return reading;
        });
      }
    } catch (error) {
      console.error('Error heredando lecturas del turno anterior:', error);
    }

    set({ currentShift: shift });

    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        await setDoc(doc(db, 'shifts', shift.id), {
          ...shift,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creando turno en Firestore:', error);
      }
    }
  },

  loadCurrentShift: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'shifts'),
          where('status', '==', 'en_progreso'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );

        if (unsubscribeCurrentShift) unsubscribeCurrentShift();

        unsubscribeCurrentShift = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const shiftData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
              const config = useConfigStore.getState().config || {};
              const shift = ensureShiftStructure(shiftData, config);
              set({ currentShift: shift, firestoreActive: true });
            }
          },
          (error) => {
            console.error('Error Firestore onSnapshot (currentShift):', error);
          }
        );
      } catch (error) {
        console.error('Error escuchando turno actual:', error);
      }
    }
  },

  saveCurrentShift: () => {
    const { currentShift } = get();
    if (currentShift) {
      debounceSyncToFirestore(currentShift);
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
    debounceSyncToFirestore(updated);
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
    debounceSyncToFirestore(updated);
  },

  updateIslandField: (islandId, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.islands = updated.islands.map((isl) =>
      isl.islandId === islandId ? { ...isl, [field]: value } : isl
    );
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
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
    debounceSyncToFirestore(updated);
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
    debounceSyncToFirestore(updated);
  },

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
    debounceSyncToFirestore(updated);
  },

  setGandolaLiters: (liters) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift, gandolaLiters: liters };
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
  },

  // ── Gastos a nivel turno (no por isla) ──
  addShiftGasto: (gasto) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift, gastos: [...(currentShift.gastos || []), gasto] };
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
  },
  removeShiftGasto: (index) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const gastos = [...(currentShift.gastos || [])];
    gastos.splice(index, 1);
    const updated = { ...currentShift, gastos };
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
  },
  updateShiftGasto: (index, field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const gastos = [...(currentShift.gastos || [])];
    gastos[index] = { ...gastos[index], [field]: value };
    const updated = { ...currentShift, gastos };
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
  },


  updateTasa: (field, value) => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift, [field]: value };
    set({ currentShift: updated });
    debounceSyncToFirestore(updated);
  },

  closeShift: () => {
    const { currentShift } = get();
    if (!currentShift) return;
    const updated = { ...currentShift };
    updated.pumpReadings = updated.pumpReadings.map((r) => ({
      ...r, litersSold: calcLitersSold(r),
    }));
    updated.tankReadings = updated.tankReadings.map((r) => ({
      ...r, liters: cmToLiters(r.cm),
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

    set({ currentShift: null });
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
    debounceSyncToFirestore(updated);
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
    debounceSyncToFirestore(updated);
  },

  loadShiftsHistory: async () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const shiftsRef = collection(db, 'shifts');

        if (unsubscribeShiftsHistory) unsubscribeShiftsHistory;

        unsubscribeShiftsHistory = onSnapshot(
          query(shiftsRef, where('status', '==', 'cerrado'), orderBy('createdAt', 'desc'), limit(50)),
          (snapshot) => {
            const firestoreShifts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            const config = useConfigStore.getState().config || {};
            const completeShifts = firestoreShifts
              .map((s) => ensureShiftStructure(s, config));

            set({ shiftsHistory: completeShifts, firestoreActive: true, loadingHistory: false });
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

  loadShiftsByDate: async (date) => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'shifts'),
          where('date', '==', date),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const shifts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const config = useConfigStore.getState().config || {};
        return shifts.map((s) => ensureShiftStructure(s, config));
      } catch (error) {
        console.error('Error consultando turnos por fecha:', error);
      }
    }
    return [];
  },

  getShiftById: async (id) => {
    const { shiftsHistory } = get();
    const found = shiftsHistory.find((s) => s.id === id);
    if (found) return found;

    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const docSnap = await getDoc(doc(db, 'shifts', id));
        if (docSnap.exists()) {
          const shiftData = { id: docSnap.id, ...docSnap.data() };
          const config = useConfigStore.getState().config || {};
          return ensureShiftStructure(shiftData, config);
        }
      } catch (error) {
        console.error('Error buscando turno por ID:', error);
      }
    }
    return null;
  },

  getPreviousShiftFinalReadings: async (currentShiftType) => {
    // Determinar el tipo de turno anterior y la fecha
    // Secuencia: 2TS(PM) → 1TS(AM) → 2TS(PM) → 1TS(AM)
    const prevOperatorType = currentShiftType === 'DIURNO' ? 'NOCTURNO' : 'DIURNO';
    const config = useConfigStore.getState().config || {};
    const supervisorType = config.supervisorShiftType || 'PM';

    // Buscar el turno cerrado más reciente del tipo de operador opuesto
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'shifts'),
          where('status', '==', 'cerrado'),
          where('operatorShiftType', '==', prevOperatorType),
          orderBy('closedAt', 'desc'),
          limit(1)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const prevShift = snapshot.docs[0].data();
          return {
            pumpReadings: prevShift.pumpReadings || [],
            tankReadings: prevShift.tankReadings || [],
          };
        }
      } catch (error) {
        console.error('Error consultando turno anterior:', error);
      }
    }
    return null;
  },

  loadDatesWithShifts: async () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const snapshot = await getDocs(
          query(collection(db, 'shifts'), where('status', '==', 'cerrado'), orderBy('createdAt', 'desc'), limit(500))
        );
        const dates = new Set();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.date) dates.add(data.date);
        });
        return Array.from(dates).sort().reverse();
      } catch (error) {
        console.error('Error consultando fechas:', error);
      }
    }
    return [];
  },

  cleanup: () => {
    if (unsubscribeCurrentShift) { unsubscribeCurrentShift(); unsubscribeCurrentShift = null; }
    if (unsubscribeShiftsHistory) { unsubscribeShiftsHistory(); unsubscribeShiftsHistory = null; }
    if (syncTimeout) { clearTimeout(syncTimeout); syncTimeout = null; }
  },
}));

export { useCierreStore };