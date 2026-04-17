// src/services/firestore.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore'
import { getDb } from '../config/firebase'
const db = getDb()

// Utilidad: Manejo de errores de permisos
const handlePermissionError = (error, context) => {
  if (error.code === 'permission-denied' || error.message?.includes('permission')) {
    return null
  }
  console.error(`Error en ${context}:`, error)
  return null
}

// ============================================
// USUARIOS
// ============================================
export const USERS_COLLECTION = 'users'

export const getUsers = async () => {
  try {
    const snapshot = await getDocs(collection(db, USERS_COLLECTION))
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    handlePermissionError(error, 'getUsers')
    return []
  }
}

export const getUser = async (userId) => {
  try {
    const docSnap = await getDoc(doc(db, USERS_COLLECTION, userId))
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() }
    return null
  } catch (error) {
    return handlePermissionError(error, 'getUser') || []
  }
}

export const updateUser = async (userId, userData) => {
  try {
    await updateDoc(doc(db, USERS_COLLECTION, userId), {
      ...userData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// TURNOS (SHIFTS)
// ============================================
export const SHIFTS_COLLECTION = 'shifts'

export const getCurrentShift = async (userId) => {
  try {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      where('status', '==', 'en_progreso'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    return handlePermissionError(error, 'getCurrentShift')
  }
}

export const getShiftsHistory = async () => {
  try {
    const q = query(
      collection(db, SHIFTS_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(50)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    handlePermissionError(error, 'getShiftsHistory')
    return []
  }
}

export const getShiftById = async (shiftId) => {
  try {
    const docSnap = await getDoc(doc(db, SHIFTS_COLLECTION, shiftId))
    if (docSnap.exists()) return { id: docSnap.id, ...docSnap.data() }
    return null
  } catch (error) {
    return handlePermissionError(error, 'getShiftById')
  }
}

export const initShift = async (shiftData, userId) => {
  try {
    const { getVenezuelaDateString } = await import('../lib/formatters.js')
    const date = getVenezuelaDateString()
    const docRef = await setDoc(doc(collection(db, SHIFTS_COLLECTION)), {
      ...shiftData,
      date,
      status: 'en_progreso',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: docRef.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateCurrentShift = async (shiftId, data) => {
  try {
    await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), {
      ...data,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const closeShift = async (shiftId) => {
  try {
    await updateDoc(doc(db, SHIFTS_COLLECTION, shiftId), {
      status: 'cerrado',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// RECEPCIÓN GANDOLA
// ============================================
export const GANDOLA_COLLECTION = 'gandolaReceptions'

export const getCurrentReception = async (userId) => {
  try {
    const q = query(
      collection(db, GANDOLA_COLLECTION),
      where('status', '==', 'en_proceso'),
      where('createdBy', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
    const snapshot = await getDocs(q)
    if (!snapshot.empty) {
      const docSnap = snapshot.docs[0]
      return { id: docSnap.id, ...docSnap.data() }
    }
    return null
  } catch (error) {
    return handlePermissionError(error, 'getCurrentReception')
  }
}

export const getReceptionsHistory = async () => {
  try {
    const q = query(
      collection(db, GANDOLA_COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    handlePermissionError(error, 'getReceptionsHistory')
    return []
  }
}

export const initReception = async (userId) => {
  try {
    const { getVenezuelaDateString } = await import('../lib/formatters.js')
    const date = getVenezuelaDateString()
    const ref = doc(collection(db, GANDOLA_COLLECTION))
    await setDoc(ref, {
      date,
      status: 'en_proceso',
      createdBy: userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: ref.id }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateCurrentReception = async (receptionId, data) => {
  try {
    await updateDoc(doc(db, GANDOLA_COLLECTION, receptionId), {
      ...data,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const closeReception = async (receptionId) => {
  try {
    await updateDoc(doc(db, GANDOLA_COLLECTION, receptionId), {
      status: 'completada',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const cancelReception = async (receptionId) => {
  try {
    await deleteDoc(doc(db, GANDOLA_COLLECTION, receptionId))
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// PRODUCTOS
// ============================================
export const PRODUCTS_COLLECTION = 'products'

export const getProducts = async () => {
  try {
    const q = query(collection(db, PRODUCTS_COLLECTION), orderBy('name', 'asc'))
    const snapshot = await getDocs(q)
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
  } catch (error) {
    handlePermissionError(error, 'getProducts')
    return []
  }
}

export const createProduct = async (productData) => {
  try {
    const ref = doc(collection(db, PRODUCTS_COLLECTION))
    await setDoc(ref, {
      ...productData,
      active: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    return { success: true, id: ref.id, ...productData }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const updateProduct = async (productId, productData) => {
  try {
    await updateDoc(doc(db, PRODUCTS_COLLECTION, productId), {
      ...productData,
      updatedAt: serverTimestamp()
    })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// CONFIGURACIÓN DE ESTACIÓN
// ============================================
export const SETTINGS_COLLECTION = 'settings'
export const STATION_CONFIG_DOC = 'station'

export const getStationConfig = async () => {
  try {
    const docSnap = await getDoc(doc(db, SETTINGS_COLLECTION, STATION_CONFIG_DOC))
    if (docSnap.exists()) return docSnap.data()
    return null
  } catch (error) {
    return handlePermissionError(error, 'getStationConfig')
  }
}

export const updateStationConfig = async (configData) => {
  try {
    await setDoc(doc(db, SETTINGS_COLLECTION, STATION_CONFIG_DOC), {
      ...configData,
      updatedAt: serverTimestamp()
    }, { merge: true })
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const resetStationConfig = async () => {
  try {
    const defaults = {
      tasa1: 50.00,
      tasa2: 0,
      stationName: 'Mi Estacion de Servicio',
      stationRif: 'J-00000000-0',
      stationAddress: 'Venezuela',
      stationPhone: '',
      stationLogo: '',
      tanksCount: 3,
      islandsCount: 3,
      pumpsPerIsland: 2,
      maxCortes: 12,
      updatedAt: serverTimestamp()
    }
    await setDoc(doc(db, SETTINGS_COLLECTION, STATION_CONFIG_DOC), defaults)
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// INVENTARIO
// ============================================
export const INVENTORY_COLLECTION = 'inventory'

export const getInventory = async () => {
  try {
    const snapshot = await getDocs(collection(db, INVENTORY_COLLECTION))
    const stockMap = {}
    snapshot.docs.forEach(d => {
      stockMap[d.id] = d.data().quantity
    })
    return stockMap
  } catch (error) {
    handlePermissionError(error, 'getInventory')
    return {}
  }
}

export const updateInventoryItem = async (productName, quantity) => {
  try {
    await setDoc(doc(db, INVENTORY_COLLECTION, productName), {
      productName,
      quantity: parseInt(quantity) || 0,
      updatedAt: serverTimestamp()
    }, { merge: true })
    return { success: true, productName, quantity: parseInt(quantity) || 0 }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

export const bulkUpdateInventory = async (items) => {
  try {
    const batch = writeBatch(db)
    for (const item of items) {
      const ref = doc(db, INVENTORY_COLLECTION, item.productName)
      batch.set(ref, {
        productName: item.productName,
        quantity: parseInt(item.quantity) || 0,
        updatedAt: serverTimestamp()
      }, { merge: true })
    }
    await batch.commit()
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

// ============================================
// ESTADÍSTICAS
// ============================================
export const getStatsSummary = async () => {
  try {
    const [shiftsSnapshot, receptionsSnapshot] = await Promise.all([
      getDocs(query(collection(db, SHIFTS_COLLECTION), where('status', '==', 'cerrado'), orderBy('createdAt', 'desc'), limit(100))),
      getDocs(query(collection(db, GANDOLA_COLLECTION), where('status', '==', 'completada')))
    ])

    const allShifts = shiftsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    const totalRecepciones = receptionsSnapshot.size

    let totalLitros = 0
    let litrosDiurno = 0
    let litrosNocturno = 0

    for (const s of allShifts) {
      try {
        const readings = s.pumpReadings || []
        const liters = readings.reduce((sum, r) => sum + (r.litersSold || 0), 0)
        totalLitros += liters
        if (s.operatorShiftType === 'DIURNO') litrosDiurno += liters
        else litrosNocturno += liters
      } catch (e) { /* skip */ }
    }

    return {
      totalTurnos: allShifts.length,
      totalLitros,
      litrosDiurno,
      litrosNocturno,
      totalRecepciones,
      shifts: allShifts
    }
  } catch (error) {
    handlePermissionError(error, 'getStatsSummary')
    return null
  }
}
