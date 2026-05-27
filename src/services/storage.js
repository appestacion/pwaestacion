// src/services/storage.js
// Claves de localStorage y datos iniciales por defecto.
// E/S Montaña Fresca — Identidad exclusiva.

import { PRODUCTS_LIST, DEFAULT_PRODUCT_PRICES } from '../config/constants.js';

export const STORAGE_KEYS = {
  USERS: 'mf_users',
  PRODUCTS: 'mf_products',
  SHIFTS: 'mf_shifts',
  CURRENT_SHIFT: 'mf_current_shift',
  INVENTORY: 'mf_inventory_stock',
  CONFIG: 'mf_config',
  AUTH: 'mf_auth',
  GANDOLA_CURRENT: 'mf_gandola_current',
  GANDOLA_HISTORY: 'mf_gandola_history',
};

/**
 * Inicializar datos por defecto en localStorage si no existen.
 * NO incluye usuarios: esos se gestionan exclusivamente via Firebase Authentication.
 * NO incluye campos de identidad: están hardcodeados como constantes en STATION_IDENTITY.
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

  // Inicializar config operativa (solo campos dinámicos — sin campos de identidad)
  if (!localStorage.getItem(STORAGE_KEYS.CONFIG)) {
    const config = {
      tasa1: 50.00,
      tasa2: 0,
      precioLitroUSD: 0.50,
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