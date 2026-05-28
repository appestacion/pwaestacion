// src/store/useProductStore.js
// Productos con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.
// Sin productos por defecto: el admin agrega los que necesite.

import { create } from 'zustand';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';

let unsubscribeProducts = null;

const useProductStore = create((set, get) => ({
  products: [],
  firestoreActive: false,

  loadProducts: () => {
    if (unsubscribeProducts) return; // Guard: evitar listener duplicado (StrictMode)
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(collection(db, 'products'), orderBy('name', 'asc'));

        unsubscribeProducts = onSnapshot(
          q,
          (snapshot) => {
            const products = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

            set({ products, firestoreActive: true });
          },
          (error) => {
            // HMR / StrictMode: el listener anterior sigue vivo tras reload del módulo.
            if (error.message?.includes('Target ID already exists')) {
              console.warn('[ProductStore] Listener ya activo (HMR), se reutiliza.');
              return;
            }
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
    const filtered = products.filter((p) => p.id !== id);
    set({ products: filtered });

    try {
      const db = getDb();
      await updateDoc(doc(db, 'products', id), { active: false });
    } catch (error) {
      console.error('Error desactivando producto en Firestore:', error);
      set({ products });
    }
  },

  cleanup: () => {
    if (unsubscribeProducts) {
      unsubscribeProducts();
      unsubscribeProducts = null;
    }
  },
}));

export { useProductStore };