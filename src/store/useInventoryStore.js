// src/store/useInventoryStore.js
// Inventario con Firestore en tiempo real + localStorage (offline cache)

import { create } from 'zustand';
import { STORAGE_KEYS } from '../services/storage.js';
import { PRODUCTS_LIST } from '../config/constants.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore';

let unsubscribeInventory = null;

/**
 * Generar inventario por defecto (todo en cero)
 */
function getDefaultStock() {
  const stock = {};
  PRODUCTS_LIST.forEach((p) => { stock[p.name] = 0; });
  return stock;
}

/**
 * Sembrar inventario en Firestore
 */
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

  /**
   * Cargar inventario: localStorage primero (rapido/offline),
   * luego escuchar Firestore en tiempo real.
   *
   * LOGICA DE AUTO-SEED:
   * - Si Firestore esta vacio pero hay datos en localStorage -> sube esos datos a Firestore
   * - Si Firestore Y localStorage estan vacios -> usa defaults y los sube a Firestore
   */
  loadStock: () => {
    // 1. Cargar desde localStorage primero
    const localData = localStorage.getItem(STORAGE_KEYS.INVENTORY);
    let localStock = {};
    if (localData) {
      try {
        localStock = JSON.parse(localData);
        if (localStock && Object.keys(localStock).length > 0) {
          set({ stock: localStock });
        }
      } catch (e) {
        console.error('Error parseando inventario localStorage:', e);
      }
    }

    // 2. Si Firebase esta configurado, escuchar en tiempo real
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
              // Firestore vacio - NO sobreescribir con objeto vacio!
              const currentStock = get().stock && Object.keys(get().stock).length > 0
                ? get().stock
                : getDefaultStock();

              console.log('[InventoryStore] Firestore vacio, usando', Object.keys(currentStock).length, 'items locales');

              set({ stock: currentStock, firestoreActive: true });
              localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(currentStock));

              // Sembrar a Firestore
              seedInventoryToFirestore(currentStock);
              return;
            }

            // Firestore tiene datos - usarlos
            set({ stock: stockMap, firestoreActive: true });
            localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(stockMap));
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

    // 3. Si no hay datos, inicializar con defaults
    if (Object.keys(localStock).length === 0 && !isFirebaseConfigured()) {
      const defaultStock = getDefaultStock();
      set({ stock: defaultStock });
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultStock));
    }
  },

  updateStockItem: async (productName, quantity) => {
    // Siempre actualizar localStorage
    const { stock } = get();
    const updated = { ...stock, [productName]: quantity };
    set({ stock: updated });
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(updated));

    // Si Firestore esta activo, sincronizar
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        await setDoc(doc(db, 'inventory', productName), {
          productName,
          quantity: parseInt(quantity) || 0,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      } catch (error) {
        console.error('Error actualizando inventario en Firestore:', error);
      }
    }
  },

  getStockItem: (productName) => {
    return get().stock[productName] ?? 0;
  },

  resetStock: async () => {
    const defaultStock = getDefaultStock();
    set({ stock: defaultStock });
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(defaultStock));

    if (isFirebaseConfigured()) {
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