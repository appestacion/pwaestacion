// src/services/storage.js
// Claves de localStorage y datos iniciales por defecto (sin usuarios)

import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';

export const STORAGE_KEYS = {
  USERS: 'pdv_users',
  PRODUCTS: 'pdv_products',
  SHIFTS: 'pdv_shifts',
  CURRENT_SHIFT: 'pdv_current_shift',
  INVENTORY: 'pdv_inventory_stock',
  CONFIG: 'pdv_config',
  AUTH: 'pdv_auth',
  GANDOLA_CURRENT: 'pdv_gandola_current',
  GANDOLA_HISTORY: 'pdv_gandola_history',
};

/**
 * Inicializar datos por defecto en localStorage si no existen.
 * NO incluye usuarios: esos se gestionan exclusivamente via Firebase Authentication.
 *
 * IMPORTANTE: Tambien verifica que los datos no sean arrays/objetos vacios,
 * ya que el listener de Firestore puede haber sobrescrito con datos vacios.
 */
export function initDefaultData() {
  if (typeof window === 'undefined') return;

  // Inicializar productos (verificar que no sea array vacio)
  const existingProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
  if (!existingProducts) {
    const products = PRODUCTS_LIST.map((p, i) => ({
      id: `prod-${(i + 1).toString().padStart(3, '0')}`,
      name: p.name,
      priceUSD: DEFAULT_PRODUCT_PRICES[p.name] || 5.00,
      category: p.category,
      active: true,
    }));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  } else {
    // Si existe pero es un array vacio, re-sembrar con defaults
    try {
      const parsed = JSON.parse(existingProducts);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        console.log('[storage] Productos vacios en localStorage, re-seed con defaults');
        const products = PRODUCTS_LIST.map((p, i) => ({
          id: `prod-${(i + 1).toString().padStart(3, '0')}`,
          name: p.name,
          priceUSD: DEFAULT_PRODUCT_PRICES[p.name] || 5.00,
          category: p.category,
          active: true,
        }));
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      }
    } catch (e) {
      console.error('[storage] Error parseando productos, re-seed:', e);
      const products = PRODUCTS_LIST.map((p, i) => ({
        id: `prod-${(i + 1).toString().padStart(3, '0')}`,
        name: p.name,
        priceUSD: DEFAULT_PRODUCT_PRICES[p.name] || 5.00,
        category: p.category,
        active: true,
      }));
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    }
  }

  // Inicializar historial de turnos
  if (!localStorage.getItem(STORAGE_KEYS.SHIFTS)) {
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify([]));
  }

  // Inicializar inventario (todo en cero) - verificar que no sea objeto vacio con sin keys
  const existingInventory = localStorage.getItem(STORAGE_KEYS.INVENTORY);
  if (!existingInventory) {
    const stock = {};
    PRODUCTS_LIST.forEach((p) => {
      stock[p.name] = 0;
    });
    localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(stock));
  } else {
    try {
      const parsed = JSON.parse(existingInventory);
      if (typeof parsed === 'object' && Object.keys(parsed).length === 0) {
        console.log('[storage] Inventario vacio en localStorage, re-seed con defaults');
        const stock = {};
        PRODUCTS_LIST.forEach((p) => {
          stock[p.name] = 0;
        });
        localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(stock));
      }
    } catch (e) {
      console.error('[storage] Error parseando inventario, re-seed:', e);
      const stock = {};
      PRODUCTS_LIST.forEach((p) => {
        stock[p.name] = 0;
      });
      localStorage.setItem(STORAGE_KEYS.INVENTORY, JSON.stringify(stock));
    }
  }

  // Inicializar configuracion por defecto
  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    const config = {
      tasa1: 50.00,
      tasa2: 0,
      stationName: 'Mi Estacion de Servicio',
      stationRif: 'J-00000000-0',
      stationAddress: 'Venezuela',
      stationPhone: '',
      stationLogo: '',
      stationColorPrimary: '#CE1126',
      stationColorSecondary: '#003399',
      stationColorAccent: '#FFD100',
      tanksCount: 3,
      islandsCount: 3,
      pumpsPerIsland: 2,
      maxCortes: 12,
    };
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  }

  // Inicializar historial de gandolas
  if (!localStorage.getItem(STORAGE_KEYS.GANDOLA_HISTORY)) {
    localStorage.setItem(STORAGE_KEYS.GANDOLA_HISTORY, JSON.stringify([]));
  }
}