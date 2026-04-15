import { create } from 'zustand';
import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';
import { getProducts, createProduct, updateProduct } from '../services/firestore.js';

const useProductStore = create((set, get) => ({
  products: [],

  loadProducts: async () => {
    try {
      const products = await getProducts();
      set({ products });
    } catch (err) {
      console.error('Error loading products:', err.message);
      // Fallback to defaults
      const products = PRODUCTS_LIST.map((p, i) => ({
        id: `prod-${(i + 1).toString().padStart(3, '0')}`,
        name: p.name,
        priceUSD: DEFAULT_PRODUCT_PRICES[p.name] || 5.00,
        category: p.category,
        active: true,
      }));
      set({ products });
    }
  },

  addProduct: async (name, priceUSD, category) => {
    try {
      const result = await createProduct({ name: name.toUpperCase(), priceUSD, category });
      if (result.success && result.id) {
        const newProduct = { id: result.id, name: name.toUpperCase(), priceUSD, category: category || 'otro', active: true };
        const { products } = get();
        set({ products: [...products, newProduct] });
        return newProduct;
      }
      throw new Error('Error creating product');
    } catch (err) {
      console.error('Error adding product:', err.message);
      throw err;
    }
  },

  updateProduct: async (id, updates) => {
    try {
      await updateProduct(id, updates);
      const { products } = get();
      set({ products: products.map((p) => (p.id === id ? { ...p, ...updates } : p)) });
    } catch (err) {
      console.error('Error updating product:', err.message);
      throw err;
    }
  },
}));

export { useProductStore };
