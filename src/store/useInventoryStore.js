// src/store/useInventoryStore.js
import { create } from 'zustand';
import { PRODUCTS_LIST } from '../config/constants.js';
import { getInventory, updateInventoryItem } from '../services/firestore.js';

const useInventoryStore = create((set, get) => ({
  stock: {},

  loadStock: async () => {
    try {
      const stock = await getInventory();
      set({ stock });
    } catch (err) {
      console.error('Error loading stock:', err.message);
      const defaultStock = {};
      PRODUCTS_LIST.forEach((p) => { defaultStock[p.name] = 0; });
      set({ stock: defaultStock });
    }
  },

  updateStockItem: async (productName, quantity) => {
    try {
      const result = await updateInventoryItem(productName, quantity);
      if (result.success) {
        const { stock } = get();
        set({ stock: { ...stock, [productName]: result.quantity } });
      }
    } catch (err) {
      console.error('Error updating stock:', err.message);
    }
  },
}));

export { useInventoryStore };
