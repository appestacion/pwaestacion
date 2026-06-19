// src/store/useInventoryStore.js
// Inventario con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.
// Soporta inventario general (cajas/almacen) e inventario por isla (distribucion).
// FIX: Eliminada dependencia de PRODUCTS_LIST (estaba vacia y desincronizada
//      con el catalogo dinamico en useProductStore). El inventario se crea
//      dinamicamente en Firestore cuando el admin agrega productos.
//
// ★ INDICADOR DE DISTRIBUCIÓN POR TURNO:
//   Mientras un turno está activo, las distribuciones (distributeToIsland) y
//   retornos (returnFromIsland) se acumulan en localStorage con clave
//   `shiftDistributions_<shiftId>`. El UI muestra "+N" en la celda "En Isla"
//   junto al stock actual, usando el mismo color del estado del stock.
//   Al cerrar el turno, se limpia el registro vía clearShiftDistributions().

import { create } from 'zustand';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

let unsubscribeInventory = null;
let unsubscribeIslandInventory = null;

// ═══════════════════════════════════════════════════
// ★ HELPERS — Tracking de distribuciones por turno (localStorage)
// Shape: { [islandId]: { [productName]: netQuantity } }
// Solo refleja distribuciones netas (+) o retornos (-) durante el turno.
// ═══════════════════════════════════════════════════
function getShiftDistributionsFromLS(shiftId) {
  if (!shiftId) return {};
  try {
    const raw = localStorage.getItem(`shiftDistributions_${shiftId}`);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('[InventoryStore] Error leyendo shiftDistributions:', e);
    return {};
  }
}

function saveShiftDistributionsToLS(shiftId, data) {
  if (!shiftId) return;
  try {
    localStorage.setItem(`shiftDistributions_${shiftId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('[InventoryStore] Error guardando shiftDistributions:', e);
  }
}

const useInventoryStore = create((set, get) => ({
  // ── Inventario General (cajas en almacen) ──
  stock: {},
  firestoreActive: false,

  // ── Inventario por Isla (productos distribuidos) ──
  // Shape: { [islandId]: { [productName]: quantity } }
  islandStock: {},
  islandFirestoreActive: false,

  // ── ★ Tracking de distribuciones del turno activo ──
  // Shape igual a localStorage: { [islandId]: { [productName]: netQuantity } }
  // Se sincroniza con localStorage para persistencia entre recargas.
  activeShiftId: null,
  shiftDistributions: {},

  // Llamado por useCierreStore cuando se inicia/carga un turno.
  // Sincroniza el estado de Zustand con localStorage.
  setActiveShiftId: (shiftId) => {
    if (!shiftId) {
      set({ activeShiftId: null, shiftDistributions: {} });
      return;
    }
    const distData = getShiftDistributionsFromLS(shiftId);
    set({ activeShiftId: shiftId, shiftDistributions: distData });
  },

  // Devuelve el neto de distribuciones para un producto en una isla
  // durante el turno activo. Retorna 0 si no hay turno activo o no hay datos.
  getShiftDistributionFor: (productName, islandId) => {
    const { shiftDistributions } = get();
    const iid = String(islandId);
    return shiftDistributions[iid]?.[productName] || 0;
  },

  // Limpia las distribuciones del turno (al cerrarlo).
  clearShiftDistributions: (shiftId) => {
    if (!shiftId) return;
    try {
      localStorage.removeItem(`shiftDistributions_${shiftId}`);
    } catch (e) {
      console.warn('[InventoryStore] Error limpiando shiftDistributions:', e);
    }
    const { activeShiftId } = get();
    if (activeShiftId === shiftId) {
      set({ activeShiftId: null, shiftDistributions: {} });
    }
  },

  // ═══════════════════════════════════════════════════
  // GENERAL STOCK
  // ═══════════════════════════════════════════════════

  loadStock: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();

        unsubscribeInventory = onSnapshot(
          collection(db, 'inventory'),
          (snapshot) => {
            const stockMap = {};
            snapshot.docs.forEach((d) => {
              const data = d.data();
              stockMap[data.productName] = data.quantity || 0;
            });

            if (Object.keys(stockMap).length === 0) {
              console.log('[InventoryStore] Firestore vacio. Los productos se crean dinámicamente desde el admin.');
            }

            set({ stock: stockMap, firestoreActive: true });
          },
          (error) => {
            if (error.message?.includes('Target ID already exists')) {
              console.warn('[InventoryStore] Listener ya activo (HMR), se reutiliza.');
              return;
            }
            console.error('Error Firestore onSnapshot (inventory):', error);
            set({ firestoreActive: false });
          }
        );
      } catch (error) {
        console.error('Error inicializando Firestore inventory:', error);
        set({ firestoreActive: false });
      }
    }
  },

  updateStockItem: async (productName, quantity) => {
    if (!isFirebaseConfigured()) return;

    const { stock } = get();
    const updated = { ...stock, [productName]: quantity };
    set({ stock: updated });

    try {
      const db = getDb();
      await setDoc(doc(db, 'inventory', productName), {
        productName,
        quantity: parseInt(quantity) || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error actualizando inventario en Firestore:', error);
      set({ stock });
    }
  },

  addGeneralStock: async (productName, quantityToAdd) => {
    if (!isFirebaseConfigured() || quantityToAdd <= 0) return;

    const { stock } = get();
    const current = parseInt(stock[productName]) || 0;
    const newQty = current + parseInt(quantityToAdd);
    const updated = { ...stock, [productName]: newQty };
    set({ stock: updated });

    try {
      const db = getDb();
      await setDoc(doc(db, 'inventory', productName), {
        productName,
        quantity: newQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error agregando stock general en Firestore:', error);
      set({ stock });
      return false;
    }
  },

  getStockItem: (productName) => {
    return get().stock[productName] ?? 0;
  },

  // FIX: resetStock ahora resetea todos los items EXISTENTES en el store a 0.
  // Ya no depende de PRODUCTS_LIST (que estaba vacio).
  resetStock: async () => {
    if (!isFirebaseConfigured()) return;

    const { stock } = get();
    const currentItems = Object.keys(stock);

    if (currentItems.length === 0) {
      console.log('[InventoryStore] No hay items para resetear.');
      return;
    }

    // Resetear localmente a 0
    const zeroedStock = {};
    currentItems.forEach((name) => { zeroedStock[name] = 0; });
    set({ stock: zeroedStock });

    try {
      const db = getDb();
      for (const name of currentItems) {
        await setDoc(doc(db, 'inventory', name), {
          productName: name,
          quantity: 0,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
      console.log(`[InventoryStore] ${currentItems.length} items reseteados a 0.`);
    } catch (error) {
      console.error('Error reset inventario en Firestore:', error);
      set({ stock });
    }
  },

  // ═══════════════════════════════════════════════════
  // ISLAND STOCK (productos distribuidos a cada isla)
  // ═══════════════════════════════════════════════════

  loadIslandStock: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();

        unsubscribeIslandInventory = onSnapshot(
          collection(db, 'islandInventory'),
          (snapshot) => {
            const islandMap = {};
            snapshot.docs.forEach((d) => {
              const data = d.data();
              const iid = String(data.islandId);
              if (!islandMap[iid]) islandMap[iid] = {};
              islandMap[iid][data.productName] = data.quantity || 0;
            });
            set({ islandStock: islandMap, islandFirestoreActive: true });
          },
          (error) => {
            if (error.message?.includes('Target ID already exists')) {
              console.warn('[InventoryStore] Listener island ya activo (HMR), se reutiliza.');
              return;
            }
            console.error('Error Firestore onSnapshot (islandInventory):', error);
            set({ islandFirestoreActive: false });
          }
        );
      } catch (error) {
        console.error('Error inicializando Firestore islandInventory:', error);
        set({ islandFirestoreActive: false });
      }
    }
  },

  distributeToIsland: async (productName, islandId, quantity) => {
    if (!isFirebaseConfigured() || quantity <= 0) return false;

    const { stock, islandStock, activeShiftId } = get();
    const generalQty = parseInt(stock[productName]) || 0;

    if (generalQty < quantity) {
      console.warn('[InventoryStore] Stock insuficiente en general:', productName, 'tiene', generalQty, 'solicita', quantity);
      return false;
    }

    // Deduct from general stock
    const newGeneralQty = generalQty - quantity;
    const updatedStock = { ...stock, [productName]: newGeneralQty };

    // Add to island stock
    const iid = String(islandId);
    const currentIsland = islandStock[iid] || {};
    const currentIslandQty = parseInt(currentIsland[productName]) || 0;
    const newIslandQty = currentIslandQty + quantity;
    const updatedIsland = {
      ...islandStock,
      [iid]: { ...currentIsland, [productName]: newIslandQty },
    };

    // ★ TRACKING: acumular la distribución en el turno activo (localStorage)
    if (activeShiftId) {
      const distData = getShiftDistributionsFromLS(activeShiftId);
      if (!distData[iid]) distData[iid] = {};
      const prev = distData[iid][productName] || 0;
      distData[iid][productName] = prev + quantity;
      saveShiftDistributionsToLS(activeShiftId, distData);
      // Actualizar el estado de Zustand para que el UI reaccione
      set({ shiftDistributions: distData });
    }

    // Optimistic update
    set({ stock: updatedStock, islandStock: updatedIsland });

    try {
      const db = getDb();
      // Update general stock
      await setDoc(doc(db, 'inventory', productName), {
        productName,
        quantity: newGeneralQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      // Update island stock
      await setDoc(doc(db, 'islandInventory', `${islandId}_${productName}`), {
        productName,
        islandId: parseInt(islandId),
        quantity: newIslandQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error distribuyendo a isla en Firestore:', error);
      set({ stock, islandStock });
      return false;
    }
  },

  returnFromIsland: async (productName, islandId, quantity) => {
    if (!isFirebaseConfigured() || quantity <= 0) return false;

    const { stock, islandStock, activeShiftId } = get();
    const iid = String(islandId);
    const currentIsland = islandStock[iid] || {};
    const currentIslandQty = parseInt(currentIsland[productName]) || 0;

    if (currentIslandQty < quantity) {
      console.warn('[InventoryStore] Stock insuficiente en isla:', productName, 'tiene', currentIslandQty, 'solicita', quantity);
      return false;
    }

    // Deduct from island stock
    const newIslandQty = currentIslandQty - quantity;
    const updatedIsland = {
      ...islandStock,
      [iid]: { ...currentIsland, [productName]: newIslandQty },
    };

    // Add back to general stock
    const generalQty = parseInt(stock[productName]) || 0;
    const newGeneralQty = generalQty + quantity;
    const updatedStock = { ...stock, [productName]: newGeneralQty };

    // ★ TRACKING: descontar del acumulado de distribuciones del turno (neto)
    if (activeShiftId) {
      const distData = getShiftDistributionsFromLS(activeShiftId);
      if (distData[iid] && typeof distData[iid][productName] === 'number') {
        const prev = distData[iid][productName];
        const next = prev - quantity;
        if (next <= 0) {
          delete distData[iid][productName];
          if (Object.keys(distData[iid]).length === 0) delete distData[iid];
        } else {
          distData[iid][productName] = next;
        }
        saveShiftDistributionsToLS(activeShiftId, distData);
        set({ shiftDistributions: distData });
      }
    }

    // Optimistic update
    set({ stock: updatedStock, islandStock: updatedIsland });

    try {
      const db = getDb();
      // Update general stock
      await setDoc(doc(db, 'inventory', productName), {
        productName,
        quantity: newGeneralQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      // Update island stock
      await setDoc(doc(db, 'islandInventory', `${islandId}_${productName}`), {
        productName,
        islandId: parseInt(islandId),
        quantity: newIslandQty,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error retornando de isla en Firestore:', error);
      set({ stock, islandStock });
      return false;
    }
  },

  updateIslandStockItem: async (productName, islandId, quantity) => {
    if (!isFirebaseConfigured()) return;

    const { islandStock } = get();
    const iid = String(islandId);
    const currentIsland = islandStock[iid] || {};
    const updatedIsland = {
      ...islandStock,
      [iid]: { ...currentIsland, [productName]: parseInt(quantity) || 0 },
    };
    set({ islandStock: updatedIsland });

    try {
      const db = getDb();
      await setDoc(doc(db, 'islandInventory', `${islandId}_${productName}`), {
        productName,
        islandId: parseInt(islandId),
        quantity: parseInt(quantity) || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      console.error('Error actualizando islandInventory en Firestore:', error);
      set({ islandStock });
    }
  },

  getIslandStockItem: (productName, islandId) => {
    const iid = String(islandId);
    return get().islandStock[iid]?.[productName] ?? 0;
  },

  // ═══════════════════════════════════════════════════
  // ★ SINCRONIZACIÓN INVENTARIO-TURNO
  // ═══════════════════════════════════════════════════
  // Descuenta los productos vendidos del inventario por isla
  // cuando se cierra un turno. Esto garantiza que el siguiente
  // turno encuentre el inventario actualizado.
  //
  // ★ PROTECCIÓN: Nunca permite stock negativo. Si la venta
  // excede el stock actual, el stock queda en 0 y se registra
  // el faltante en console.warn para auditoría.
  //
  // soldByIsland: { [islandId]: { [productName]: totalQuantity } }
  // ═══════════════════════════════════════════════════
  deductSoldFromIslandStock: async (soldByIsland) => {
    if (!isFirebaseConfigured()) return;
    if (!soldByIsland || Object.keys(soldByIsland).length === 0) return;

    const { islandStock } = get();

    // Deep clone para actualizar estado local (optimistic)
    const updatedIslandStock = JSON.parse(JSON.stringify(islandStock));
    const writePromises = [];
    const discrepancies = [];

    for (const [iid, products] of Object.entries(soldByIsland)) {
      for (const [productName, qtySold] of Object.entries(products)) {
        if (qtySold <= 0) continue;

        const currentQty = parseInt(updatedIslandStock[iid]?.[productName]) || 0;
        // ★ PROTECCIÓN: Nunca stock negativo. Clamp a 0.
        const newQty = Math.max(0, currentQty - qtySold);

        // Warning si la venta excedió el stock (discrepancia para auditoría)
        if (qtySold > currentQty) {
          const faltante = qtySold - currentQty;
          console.warn(
            `[InventoryStore] ¡DISCREPANCIA! ${productName} en Isla ${iid}: ` +
            `se vendió ${qtySold} pero el stock era ${currentQty}. ` +
            `Faltante: ${faltante}. Stock queda en 0 (no negativo).`
          );
          discrepancies.push({
            islandId: iid,
            productName,
            stockAntes: currentQty,
            qtyVendida: qtySold,
            faltante,
          });
        }

        // Actualizar estado local
        if (!updatedIslandStock[iid]) updatedIslandStock[iid] = {};
        updatedIslandStock[iid][productName] = newQty;

        // Escribir a Firestore
        const islandIdNum = parseInt(iid);
        writePromises.push(
          setDoc(doc(getDb(), 'islandInventory', `${islandIdNum}_${productName}`), {
            productName,
            islandId: islandIdNum,
            quantity: newQty,
            updatedAt: new Date().toISOString(),
          }, { merge: true }).catch((err) => {
            console.error(`[InventoryStore] Error descontando ${productName} de Isla ${iid} en Firestore:`, err);
          })
        );
      }
    }

    // Optimistic update del estado local
    set({ islandStock: updatedIslandStock });

    // Ejecutar todas las escrituras a Firestore en paralelo
    try {
      await Promise.all(writePromises);
      const totalProducts = Object.values(soldByIsland).reduce(
        (sum, prods) => sum + Object.keys(prods).length, 0
      );
      console.log(`[InventoryStore] ✅ Inventario actualizado: ${totalProducts} productos descontados en ${Object.keys(soldByIsland).length} islas.`);
    } catch (error) {
      console.error('[InventoryStore] Error general al descontar inventario:', error);
    }
  },

  cleanup: () => {
    if (unsubscribeInventory) {
      unsubscribeInventory();
      unsubscribeInventory = null;
    }
    if (unsubscribeIslandInventory) {
      unsubscribeIslandInventory();
      unsubscribeIslandInventory = null;
    }
  },
}));

export { useInventoryStore };