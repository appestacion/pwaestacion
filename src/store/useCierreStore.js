// src/store/useCierreStore.js
// Store de cierres de turno con Firebase Firestore en tiempo real.
// Incluye localStorage como respaldo para herencia de lecturas.
// ★ FIX SINCRONIZACIÓN: Al cerrar turno, se descuentan los productos
//   vendidos del inventario por isla para que el siguiente turno
//   encuentre el inventario actualizado.

import { create } from 'zustand';
import { useConfigStore } from './useConfigStore.js';
import { useInventoryStore } from './useInventoryStore.js';
import { generateId, getVenezuelaDateString, getVenezuelaDate } from '../lib/formatters.js';
import { calcLitersSold } from '../lib/calculations.js';
import { cmToLiters } from '../lib/conversions.js';
import { isFirebaseConfigured, getDb, getFirebaseAuth } from '../config/firebase.js';
import {
  collection, doc, setDoc, updateDoc,
  query, where, orderBy, limit, onSnapshot, getDocs, getDoc,
} from 'firebase/firestore';
import { format, subDays } from 'date-fns';

// ═══════════════════════════════════════════════════════════
// LOCALSTORAGE — Respaldo offline para herencia de lecturas
// ═══════════════════════════════════════════════════════════
const LS_PREFIX = 'lastClosedShift_';

function saveLastClosedShiftToLocal(operatorShiftType, shift) {
  try {
    // ★ FIX CADENA ROTA: Si finalReading es 0 pero initialReading > 0,
    // preservar initialReading como finalReading. Así la cadena de
    // herencia NUNCA se rompe, incluso si el usuario cierra sin
    // ingresar lecturas finales.
    const safePumpReadings = (shift.pumpReadings || []).map(r => ({
      ...r,
      finalReading: Math.max(r.finalReading || 0, r.initialReading || 0),
    }));

    const data = {
      operatorShiftType,
      closedAt: shift.closedAt || new Date().toISOString(),
      pumpReadings: safePumpReadings,
      tankReadings: shift.tankReadings || [],
    };
    localStorage.setItem(LS_PREFIX + operatorShiftType, JSON.stringify(data));
  } catch (e) {
    console.warn('[CierreStore] No se pudo guardar en localStorage:', e);
  }
}

function getLastClosedShiftFromLocal(operatorShiftType) {
  try {
    const raw = localStorage.getItem(LS_PREFIX + operatorShiftType);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !data.pumpReadings || data.pumpReadings.length === 0) return null;
    // Descartar datos mayores a 48 horas
    const closedTime = new Date(data.closedAt || 0).getTime();
    if (Date.now() - closedTime > 48 * 60 * 60 * 1000) return null;
    return data;
  } catch (e) {
    console.warn('[CierreStore] Error leyendo localStorage:', e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════
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
let currentShiftListening = false; // Guard: evitar listener duplicado (StrictMode)

// Protección contra race condition: cuando initNewShift escribe a Firestore,
// el listener onSnapshot puede sobrescribir el estado local. Este flag evita eso.
let _initializingShiftId = null;
const INITIALIZATION_GUARD_MS = 8000; // 8 segundos de protección

// ★ FIX BUG CRÍTICO 2: Flag para proteger contra race condition al CERRAR turno.
// Evita que onSnapshot reviva un turno que se está cerrando.
let _closingShiftId = null;
const CLOSING_GUARD_MS = 10000; // 10 segundos de protección durante cierre

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

// ═══════════════════════════════════════════════════════════
// Aplica lecturas heredadas a un turno (SOLO surtidores/bombas)
// Los tanques NO se heredan: se miden fisicamente en cada turno.
// ═══════════════════════════════════════════════════════════
function applyInheritedReadings(shift, prevReadings) {
  if (!prevReadings) return shift;
  let applied = false;

  // Heredar SOLO lecturas de surtidores (bombas)
  if (prevReadings.pumpReadings && prevReadings.pumpReadings.length > 0) {
    shift.pumpReadings = shift.pumpReadings.map((reading) => {
      const prev = prevReadings.pumpReadings.find(
        (p) => p.islandId === reading.islandId && p.pumpNumber === reading.pumpNumber
      );
      if (prev && prev.finalReading && prev.finalReading > 0) {
        applied = true;
        return {
          ...reading,
          initialReading: prev.finalReading,
          litersSold: calcLitersSold({ ...reading, initialReading: prev.finalReading }),
        };
      }
      return reading;
    });
  }

  // Los tanques NO se heredan — empiezan en 0 para medicion fisica

  return { shift, applied };
}

// ═══════════════════════════════════════════════════════════
// ★ HELPER: Construir mapa de productos vendidos por isla
// Agrega cantidades del mismo producto (diferentes métodos de pago)
// ═══════════════════════════════════════════════════════════
function buildSoldByIslandMap(islands) {
  const soldByIsland = {};
  islands.forEach((isl) => {
    const iid = String(isl.islandId);
    const products = {};
    (isl.productsSold || []).forEach((ps) => {
      products[ps.productName] = (products[ps.productName] || 0) + (ps.quantity || 0);
    });
    if (Object.keys(products).length > 0) {
      soldByIsland[iid] = products;
    }
  });
  return soldByIsland;
}

// ═══════════════════════════════════════════════════════════
// Helper: esperar una cantidad de ms
// ═══════════════════════════════════════════════════════════
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════
const useCierreStore = create((set, get) => ({
  currentShift: null,
  shiftsHistory: [],
  firestoreActive: false,
  loadingHistory: false,
  closingShift: false,

  initNewShift: async (supervisorShiftType, tasa1, tasa2) => {
    const config = useConfigStore.getState().config || {};
    const operatorShiftType = supervisorShiftType === 'AM' ? 'NOCTURNO' : 'DIURNO';
    // ★ FIX BUG CRÍTICO 3: Determinar el tipo de turno ANTERIOR para buscar
    // sus lecturas finales (tanto en localStorage como en Firestore).
    const prevOperatorType = operatorShiftType === 'DIURNO' ? 'NOCTURNO' : 'DIURNO';
    const shift = createEmptyShift(operatorShiftType, supervisorShiftType, tasa1, tasa2, config);

    // Asignar createdBy para que Firestore rules permitan update
    const auth = getFirebaseAuth();
    if (auth.currentUser) {
      shift.createdBy = auth.currentUser.uid;
    }

    shift.date = getShiftDate(supervisorShiftType);

    // ─────────────────────────────────────────────────────
    // HERENCIA DE LECTURAS — 3 capas de seguridad
    // ─────────────────────────────────────────────────────

    // CAPA 1: localStorage (instantánea, funciona offline)
    const localReadings = getLastClosedShiftFromLocal(prevOperatorType);
    if (localReadings) {
      const result = applyInheritedReadings(shift, localReadings);
      if (result.applied) {
        console.log('[CierreStore] Lecturas de surtidores heredadas desde localStorage.');
      } else {
        console.warn('[CierreStore] localStorage tenía datos pero no se aplicaron (finalReading = 0).');
      }
    }

    // CAPA 2: Firestore con reintentos y consulta fallback
    let firestoreReadings = null;

    if (isFirebaseConfigured()) {
      firestoreReadings = await get().getPreviousShiftFinalReadings(operatorShiftType);
    }

    // Si Firestore tiene datos, comparar y usar los más recientes
    if (firestoreReadings) {
      const firestoreClosedAt = new Date(firestoreReadings.closedAt || 0).getTime();
      const localClosedAt = new Date(localReadings?.closedAt || 0).getTime();

      if (firestoreClosedAt >= localClosedAt) {
        const result = applyInheritedReadings(shift, firestoreReadings);
        if (result.applied) {
          console.log('[CierreStore] Lecturas heredadas desde Firestore (más recientes que localStorage).');
        }
      } else {
        console.log('[CierreStore] localStorage tiene datos más recientes, se mantiene.');
      }
    }

    // CAPA 3: Si ninguna fuente dio lecturas, intentar consulta simplificada (sin compound index)
    const hasInheritedPumps = shift.pumpReadings.some((r) => r.initialReading > 0);
    if (!hasInheritedPumps && isFirebaseConfigured()) {
      console.warn('[CierreStore] No se heredaron lecturas. Intentando consulta de emergencia...');
      const emergencyReadings = await get().getEmergencyPreviousReadings(operatorShiftType);
      if (emergencyReadings) {
        const result = applyInheritedReadings(shift, emergencyReadings);
        if (result.applied) {
          console.log('[CierreStore] Lecturas recuperadas con consulta de emergencia.');
        }
      }
    }

    // Log resumen de la herencia
    const finalInherited = shift.pumpReadings.filter((r) => r.initialReading > 0).length;
    console.log(`[CierreStore] Herencia completada: ${finalInherited}/${shift.pumpReadings.length} bombas con lectura inicial.`);

    // Marcar que este shift está siendo inicializado (protección contra race condition)
    _initializingShiftId = shift.id;
    setTimeout(() => { _initializingShiftId = null; }, INITIALIZATION_GUARD_MS);

    set({ currentShift: shift });

    // ★ Sincronizar el tracking de distribuciones con el nuevo turno activo
    useInventoryStore.getState().setActiveShiftId(shift.id);

    // Guardar a Firestore (con las lecturas ya heredadas incluidas)
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
    if (currentShiftListening) return;
    if (!isFirebaseConfigured()) return;

    currentShiftListening = true;
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
          // ★ FIX BUG CRÍTICO 2: Ignorar snapshots durante el cierre de turno.
          if (_closingShiftId) {
            console.log('[CierreStore] onSnapshot ignorado: turno en proceso de cierre.');
            return;
          }

          if (!snapshot.empty) {
            const shiftData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

            if (_initializingShiftId && shiftData.id === _initializingShiftId) {
              console.log('[CierreStore] onSnapshot ignorado: shift en inicialización protegida.');
              return;
            }

            const config = useConfigStore.getState().config || {};
            const shift = ensureShiftStructure(shiftData, config);
            set({ currentShift: shift, firestoreActive: true });

            // ★ Sincronizar tracking de distribuciones con el turno cargado
            useInventoryStore.getState().setActiveShiftId(shift.id);
          }
        },
        (error) => {
          if (error.message?.includes('Target ID already exists')) {
            console.warn('[CierreStore] Listener ya activo (HMR), se reutiliza.');
            return;
          }
          console.error('Error Firestore onSnapshot (currentShift):', error);
          currentShiftListening = false;
        }
      );
    } catch (error) {
      currentShiftListening = false;
      console.error('Error escuchando turno actual:', error);
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

  // ★ FIX BUG CRÍTICO 1 + 2 + 4 + 5 + SINCRONIZACIÓN INVENTARIO:
  // closeShift reescrito completamente.
  // Al cerrar el turno, se descuentan los productos vendidos del
  // inventario por isla para que el siguiente turno encuentre el
  // inventario actualizado.
  closeShift: async () => {
    const { currentShift } = get();
    if (!currentShift) return { success: false, error: 'No hay un turno activo para cerrar.' };

    const shiftId = currentShift.id;

    // ★ FIX: Marcar que este turno se está cerrando (protección onSnapshot)
    _closingShiftId = shiftId;

    // ★ FIX: Cancelar cualquier sync pendiente
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }

    // ★ FIX BUG 4: Indicar al UI que se está procesando el cierre
    set({ closingShift: true });

    try {
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

      // ★ FIX BUG CRÍTICO 1: Guardar en Firestore PRIMERO y ESPERAR confirmación.
      if (isFirebaseConfigured()) {
        try {
          const db = getDb();
          const cleanShift = JSON.parse(JSON.stringify(closedShift));
          await setDoc(doc(db, 'shifts', shiftId), cleanShift, { merge: true });
          console.log('[CierreStore] Turno cerrado y guardado en Firestore exitosamente.');
        } catch (firestoreError) {
          console.error('[CierreStore] ERROR al guardar cierre en Firestore:', firestoreError);
          saveLastClosedShiftToLocal(updated.operatorShiftType, closedShift);
          _closingShiftId = null;
          set({ closingShift: false });
          return {
            success: false,
            error: 'Error de conexión al cerrar turno. El turno se guardó localmente como respaldo. Intenta nuevamente cuando tengas internet.',
          };
        }
      }

      // ★ SINCRONIZACIÓN INVENTARIO: Descontar productos vendidos del inventario por isla.
      // Esto garantiza que el siguiente turno encuentre el inventario actualizado.
      // Se ejecuta DESPUÉS de confirmar el cierre en Firestore (punto de no retorno).
      // Si falla, el turno ya está cerrado; el inventario se puede corregir manualmente.
      try {
        const soldByIsland = buildSoldByIslandMap(closedShift.islands);

        if (Object.keys(soldByIsland).length > 0) {
          const { deductSoldFromIslandStock } = useInventoryStore.getState();
          await deductSoldFromIslandStock(soldByIsland);
          console.log('[CierreStore] ✅ Inventario por isla sincronizado tras cierre de turno.');
        } else {
          console.log('[CierreStore] No se vendieron productos en este turno. Inventario sin cambios.');
        }
      } catch (invError) {
        // No crítico: el turno ya está cerrado correctamente.
        // El inventario se puede corregir manualmente desde la pantalla de Inventario.
        console.error('[CierreStore] ⚠️ Error al sincronizar inventario tras cierre (no crítico):', invError);
      }

      // ★ Firestore write exitoso: guardar en localStorage como respaldo
      // (saveLastClosedShiftToLocal ya usa Math.max(final, initial) para
      //  preservar la cadena de herencia aunque finalReading sea 0)
      saveLastClosedShiftToLocal(updated.operatorShiftType, closedShift);
      console.log('[CierreStore] Lecturas finales guardadas en localStorage para herencia futura.');

      // ★ FIX BUG CRÍTICO 2: Limpiar el estado DESPUÉS de confirmar Firestore.
      set({ currentShift: null, closingShift: false });

      // ★ Limpiar tracking de distribuciones del turno cerrado
      useInventoryStore.getState().clearShiftDistributions(shiftId);

      // Limpiar flag de protección después de un margen de seguridad
      setTimeout(() => { _closingShiftId = null; }, CLOSING_GUARD_MS);

      return { success: true, error: null };
    } catch (error) {
      console.error('[CierreStore] Error inesperado al cerrar turno:', error);
      _closingShiftId = null;
      set({ closingShift: false });
      // FIX M6: No exponer detalles internos al usuario
      return {
        success: false,
        error: 'Error inesperado al cerrar turno. Verifica tu conexión e intenta de nuevo.',
      };
    }
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

        if (unsubscribeShiftsHistory) unsubscribeShiftsHistory();

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
            if (error.message?.includes('Target ID already exists')) {
              console.warn('[CierreStore] Listener historial ya activo (HMR), se reutiliza.');
              return;
            }
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
    const prevOperatorType = currentShiftType === 'DIURNO' ? 'NOCTURNO' : 'DIURNO';

    if (isFirebaseConfigured()) {
      for (let attempt = 1; attempt <= 2; attempt++) {
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
              closedAt: prevShift.closedAt || prevShift.createdAt || '',
              pumpReadings: prevShift.pumpReadings || [],
              tankReadings: prevShift.tankReadings || [],
            };
          }
          return null;
        } catch (error) {
          console.error(`[CierreStore] Consulta Firestore intento ${attempt}/2 falló:`, error.message);
          if (attempt < 2) {
            await delay(1500);
          }
        }
      }
    }
    return null;
  },

  // ── CONSULTA DE EMERGENCIA ──
  getEmergencyPreviousReadings: async (currentShiftType) => {
    const prevOperatorType = currentShiftType === 'DIURNO' ? 'NOCTURNO' : 'DIURNO';

    if (!isFirebaseConfigured()) return null;

    try {
      const db = getDb();
      const q = query(
        collection(db, 'shifts'),
        where('status', '==', 'cerrado'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);

      let bestMatch = null;
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        if (data.operatorShiftType === prevOperatorType) {
          if (!bestMatch) bestMatch = data;
          else {
            const bestTime = new Date(bestMatch.closedAt || 0).getTime();
            const thisTime = new Date(data.closedAt || 0).getTime();
            if (thisTime > bestTime) bestMatch = data;
          }
        }
      }

      if (bestMatch) {
        return {
          closedAt: bestMatch.closedAt || bestMatch.createdAt || '',
          pumpReadings: bestMatch.pumpReadings || [],
          tankReadings: bestMatch.tankReadings || [],
        };
      }
    } catch (error) {
      console.error('[CierreStore] Consulta de emergencia falló:', error.message);
    }
    return null;
  },

  // ★ FIX: Verificar si ya existe un turno cerrado del mismo tipo en la misma fecha
  checkForDuplicateShift: async (operatorShiftType) => {
    if (!isFirebaseConfigured()) return null;

    try {
      const db = getDb();
      const today = getVenezuelaDateString();
      const q = query(
        collection(db, 'shifts'),
        where('operatorShiftType', '==', operatorShiftType),
        where('status', '==', 'cerrado'),
        orderBy('closedAt', 'desc'),
        limit(1)
      );
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        const shiftId = snapshot.docs[0].id;
        if (data.date === today) {
          return { id: shiftId, date: data.date, operatorShiftType: data.operatorShiftType };
        }
      }
    } catch (error) {
      console.warn('[CierreStore] Error verificando turno duplicado:', error.message);
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
    currentShiftListening = false;
    _initializingShiftId = null;
    _closingShiftId = null;
  },
}));

export { useCierreStore };