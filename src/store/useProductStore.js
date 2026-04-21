// src/store/useProductStore.js
// Productos con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.

import { create } from 'zustand';
import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

let unsubscribeProducts = null;

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

  loadProducts: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));

        unsubscribeProducts = onSnapshot(
          q,
          (snapshot) => {
            const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

            if (products.length === 0) {
              const defaultProducts = getDefaultProducts();
              console.log('[ProductStore] Firestore vacio, sembrando', defaultProducts.length, 'productos por defecto');
              set({ products: defaultProducts, firestoreActive: true });
              seedProductsToFirestore(defaultProducts);
              return;
            }

            set({ products, firestoreActive: true });
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
  },

  addProduct: async (name, priceUSD, category) => {
    if (!isFirebaseConfigured()) return;

    const newProduct = {
      name: name.toUpperCase(),
      priceUSD,
      category,
      active: true,
      createdAt: new Date().toISOString(),
    };

    const { products } = get();
    const id = `prod-${Date.now()}`;
    const withId = { ...newProduct, id };
    set({ products: [...products, withId] });

    try {
      const db = getDb();
      await setDoc(doc(db, 'products', id), newProduct);
    } catch (error) {
      console.error('Error creando producto en Firestore:', error);
      set({ products });
    }
  },

  updateProduct: async (id, updates) => {
    if (!isFirebaseConfigured()) return;

    const { products } = get();
    const updated = products.map((p) => (p.id === id ? { ...p, ...updates } : p));
    set({ products: updated });

    try {
      const db = getDb();
      await updateDoc(doc(db, 'products', id), updates);
    } catch (error) {
      console.error('Error actualizando producto en Firestore:', error);
      set({ products });
    }
  },

  deleteProduct: async (id) => {
    if (!isFirebaseConfigured()) return;

    const { products } = get();
    const updated = products.map((p) => (p.id === id ? { ...p, active: false } : p));
    set({ products: updated });

    try {
      const db = getDb();
      await updateDoc(doc(db, 'products', id), { active: false });
    } catch (error) {
      console.error('Error desactivando producto en Firestore:', error);
      set({ products });
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