// src/store/useInventoryStore.js
// Inventario con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.

import { create } from 'zustand';
import { PRODUCTS_LIST } from '../config/constants.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

let unsubscribeInventory = null;

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
  stock: {},
  firestoreActive: false,

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

  cleanup: () => {
    if (unsubscribeInventory) {
      unsubscribeInventory();
      unsubscribeInventory = null;
    }
  },
}));

export { useInventoryStore };