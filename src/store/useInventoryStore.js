// src/store/useInventoryStore.js
// Inventario con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.
// Soporta inventario general (cajas/almacen) e inventario por isla (distribucion).

import { create } from 'zustand';
import { PRODUCTS_LIST } from '../config/constants.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

let unsubscribeInventory = null;
let unsubscribeIslandInventory = null;

function getDefaultStock() {
  const stock = {};
  PRODUCTS_LIST.forEach((p) => { stock[p.name] = 0; });
  return stock;
}

async function seedInventoryToFirestore(stockMap) {
  if (!isFirebaseConfigured() || !stockMap || Object.keys(stockMap).length === 0) return;
  try {
    const db = getDb();
    const batch = Object.entries(stockMap).map(([name, quantity]) =>
      setDoc(doc(db, 'inventory', name), {
        productName: name,
        quantity: parseInt(quantity) || 0,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    );
    await Promise.all(batch);
    console.log(`[InventoryStore] ${Object.keys(stockMap).length} items sembrados en Firestore`);
  } catch (error) {
    console.error('[InventoryStore] Error sembrando inventario en Firestore:', error);
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
              const defaultStock = getDefaultStock();
              console.log('[InventoryStore] Firestore vacio, sembrando', Object.keys(defaultStock).length, 'items por defecto');
              set({ stock: defaultStock, firestoreActive: true });
              seedInventoryToFirestore(defaultStock);
              return;
            }

            set({ stock: stockMap, firestoreActive: true });
          },
          (error) => {
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

  resetStock: async () => {
    if (!isFirebaseConfigured()) return;

    const defaultStock = getDefaultStock();
    set({ stock: defaultStock });

    try {
      const db = getDb();
      for (const name of Object.keys(defaultStock)) {
        await setDoc(doc(db, 'inventory', name), {
          productName: name,
          quantity: 0,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error reset inventario en Firestore:', error);
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

    const { stock, islandStock } = get();
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

    const { stock, islandStock } = get();
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