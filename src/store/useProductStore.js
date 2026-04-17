// src/store/useProductStore.js
// Productos con Firestore en tiempo real + localStorage (offline cache)

import { create } from 'zustand';
import { STORAGE_KEYS } from '../services/storage.js';
import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

let unsubscribeProducts = null;

/**
 * Generar los productos por defecto a partir de PRODUCTS_LIST
 */
function getDefaultProducts() {
  return PRODUCTS_LIST.map((p, i) => ({
    id: `prod-${(i + 1).toString().padStart(3, '0')}`,
    name: p.name,
    priceUSD: DEFAULT_PRODUCT_PRICES[p.name] || 5.00,
    category: p.category,
    active: true,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Sembrar productos en Firestore (para primer uso o migracion)
 */
async function seedProductsToFirestore(products) {
  if (!isFirebaseConfigured() || !products || products.length === 0) return;
  try {
    const db = getDb();
    const batch = products.map((p) => {
      const { id, ...data } = p;
      return setDoc(doc(db, 'products', id), data);
    });
    await Promise.all(batch);
    console.log(`[ProductStore] ${products.length} productos sembrados en Firestore`);
  } catch (error) {
    console.error('[ProductStore] Error sembrando productos en Firestore:', error);
  }
}

const useProductStore = create((set, get) => ({
  products: [],
  firestoreActive: false,

  /**
   * Cargar productos: localStorage primero (rapido/offline),
   * luego escuchar Firestore en tiempo real si esta disponible.
   *
   * LOGICA DE AUTO-SEED:
   * - Si Firestore esta vacio pero hay datos en localStorage -> sube esos datos a Firestore
   * - Si Firestore Y localStorage estan vacios -> usa productos por defecto y los sube a Firestore
   */
  loadProducts: () => {
    // 1. Cargar desde localStorage primero (offline cache)
    const localData = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    let localProducts = [];
    if (localData) {
      try {
        localProducts = JSON.parse(localData);
        if (Array.isArray(localProducts) && localProducts.length > 0) {
          set({ products: localProducts });
        }
      } catch (e) {
        console.error('Error parseando productos localStorage:', e);
      }
    }

    // 2. Si Firebase esta configurado, escuchar en tiempo real
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));

        unsubscribeProducts = onSnapshot(
          q,
          (snapshot) => {
            const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

            if (products.length === 0) {
              // Firestore vacio - NO sobreescribir con array vacio!
              // Usar lo que tengamos (localStorage o defaults) y sembrar a Firestore
              const currentProducts = get().products.length > 0
                ? get().products
                : getDefaultProducts();

              console.log('[ProductStore] Firestore vacio, usando', currentProducts.length, 'productos locales');

              set({ products: currentProducts, firestoreActive: true });
              localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(currentProducts));

              // Sembrar a Firestore para que no este vacio la proxima vez
              seedProductsToFirestore(currentProducts);
              return;
            }

            // Firestore tiene datos - usarlos
            set({ products, firestoreActive: true });
            // Cache en localStorage
            localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
          },
          (error) => {
            console.error('Error Firestore onSnapshot (products):', error);
            set({ firestoreActive: false });
          }
        );
      } catch (error) {
        console.error('Error inicializando Firestore products:', error);
        set({ firestoreActive: false });
      }
    }

    // 3. Si no hay datos en localStorage ni Firebase, inicializar con defaults
    if (localProducts.length === 0 && !isFirebaseConfigured()) {
      const products = getDefaultProducts();
      set({ products });
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    }
  },

  addProduct: async (name, priceUSD, category) => {
    const newProduct = {
      name: name.toUpperCase(),
      priceUSD,
      category,
      active: true,
      createdAt: new Date().toISOString(),
    };

    // Siempre guardar en localStorage (offline)
    const { products } = get();
    const id = `prod-${Date.now()}`;
    const withId = { ...newProduct, id };
    const updated = [...products, withId];
    set({ products: updated });
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));

    // Si Firestore esta activo, sincronizar
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        await setDoc(doc(db, 'products', id), newProduct);
      } catch (error) {
        console.error('Error creando producto en Firestore:', error);
      }
    }
  },

  updateProduct: async (id, updates) => {
    // Siempre actualizar localStorage
    const { products } = get();
    const updated = products.map((p) => (p.id === id ? { ...p, ...updates } : p));
    set({ products: updated });
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));

    // Si Firestore esta activo, sincronizar
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        await updateDoc(doc(db, 'products', id), updates);
      } catch (error) {
        console.error('Error actualizando producto en Firestore:', error);
      }
    }
  },

  deleteProduct: async (id) => {
    // Desactivar (soft delete)
    const { products } = get();
    const updated = products.map((p) => (p.id === id ? { ...p, active: false } : p));
    set({ products: updated });
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(updated));

    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        await updateDoc(doc(db, 'products', id), { active: false });
      } catch (error) {
        console.error('Error desactivando producto en Firestore:', error);
      }
    }
  },

  getProductByName: (name) => {
    return get().products.find((p) => p.name === name && p.active);
  },

  getActiveProducts: () => {
    return get().products.filter((p) => p.active);
  },

  cleanup: () => {
    if (unsubscribeProducts) {
      unsubscribeProducts();
      unsubscribeProducts = null;
    }
  },
}));

export { useProductStore };