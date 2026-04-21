// src/store/useGandolaStore.js
// Recepcion de gandolas con Firestore en tiempo real.
// Cloud-only — no localStorage fallback.

import { create } from 'zustand';
import { generateId, getVenezuelaDateString } from '../lib/formatters.js';
import { cmToLiters } from '../lib/conversions.js';
import { isFirebaseConfigured, getDb } from '../config/firebase.js';
import { collection, query, where, orderBy, limit, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

function createEmptyTankReception(tankId) {
  return {
    tankId,
    cmBefore: 0,
    litersBefore: 0,
    cmAfter: 0,
    litersAfter: 0,
    cmDifference: 0,
    litersDifference: 0,
  };
}

function createEmptyGandolaReception() {
  return {
    id: generateId(),
    date: getVenezuelaDateString(),
    supervisorName: '',
    gandolaPlate: '',
    gandolaDriver: '',
    productType: '',
    tankReadings: [1, 2, 3].map(createEmptyTankReception),
    observations: '',
    status: 'en_proceso',
    createdAt: new Date().toISOString(),
  };
}

let unsubscribeReceptionsHistory = null;
let unsubscribeCurrentReception = null;

const useGandolaStore = create((set, get) => ({
  currentReception: null,
  receptionsHistory: [],
  firestoreActive: false,

  loadCurrentReception: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'gandolaReceptions'),
          where('status', '==', 'en_proceso'),
          orderBy('createdAt', 'desc'),
          limit(1)
        );

        unsubscribeCurrentReception = onSnapshot(
          q,
          (snapshot) => {
            if (!snapshot.empty) {
              const reception = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
              set({ currentReception: reception, firestoreActive: true });
            } else {
              set({ currentReception: null });
            }
          },
          (error) => {
            console.error('Error Firestore onSnapshot (currentReception):', error);
          }
        );
      } catch (error) {
        console.error('Error escuchando recepcion actual:', error);
      }
    }
  },

  loadReceptionsHistory: () => {
    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const q = query(
          collection(db, 'gandolaReceptions'),
          orderBy('createdAt', 'desc')
        );

        unsubscribeReceptionsHistory = onSnapshot(
          q,
          (snapshot) => {
            const history = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .slice(0, 100);
            set({ receptionsHistory: history, firestoreActive: true });
          },
          (error) => {
            console.error('Error Firestore onSnapshot (receptions):', error);
          }
        );
      } catch (error) {
        console.error('Error cargando historial recepciones:', error);
      }
    }
  },

  initNewReception: async () => {
    const reception = createEmptyGandolaReception();

    set({ currentReception: reception });

    if (isFirebaseConfigured()) {
      try {
        const db = getDb();
        const ref = doc(db, 'gandolaReceptions', reception.id);
        await setDoc(ref, {
          ...reception,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Error creando recepcion en Firestore:', error);
      }
    }
  },

  saveCurrentReception: () => {
    const { currentReception } = get();
    if (currentReception && isFirebaseConfigured()) {
      try {
        const db = getDb();
        setDoc(doc(db, 'gandolaReceptions', currentReception.id), currentReception, { merge: true });
      } catch (error) {
        console.error('Error guardando recepcion en Firestore:', error);
      }
    }
  },

  updateReceptionField: async (field, value) => {
    const { currentReception } = get();
    if (!currentReception) return;
    const updated = { ...currentReception, [field]: value };
    set({ currentReception: updated });

    if (isFirebaseConfigured() && currentReception.id) {
      try {
        const db = getDb();
        await updateDoc(doc(db, 'gandolaReceptions', currentReception.id), { [field]: value });
      } catch (error) {
        console.error('Error actualizando recepcion:', error);
      }
    }
  },

  updateTankReception: async (index, field, value) => {
    const { currentReception } = get();
    if (!currentReception) return;
    const updated = { ...currentReception };
    updated.tankReadings = [...updated.tankReadings];

    const numValue = (field === 'cmBefore' || field === 'cmAfter') ? (parseFloat(value) || 0) : value;
    updated.tankReadings[index] = { ...updated.tankReadings[index], [field]: numValue };

    if (field === 'cmBefore') {
      updated.tankReadings[index].litersBefore = cmToLiters(numValue);
    }
    if (field === 'cmAfter') {
      updated.tankReadings[index].litersAfter = cmToLiters(numValue);
    }

    const tank = updated.tankReadings[index];
    tank.cmDifference = tank.cmAfter - tank.cmBefore;
    tank.litersDifference = tank.litersAfter - tank.litersBefore;

    set({ currentReception: updated });

    if (isFirebaseConfigured() && currentReception.id) {
      try {
        const db = getDb();
        await updateDoc(doc(db, 'gandolaReceptions', currentReception.id), {
          tankReadings: updated.tankReadings,
        });
      } catch (error) {
        console.error('Error actualizando tanques:', error);
      }
    }
  },

  closeReception: async () => {
    const { currentReception } = get();
    if (!currentReception) return;
    const closed = {
      ...currentReception,
      status: 'completada',
      closedAt: new Date().toISOString(),
    };

    set({ currentReception: null });

    if (isFirebaseConfigured() && currentReception.id) {
      try {
        const db = getDb();
        await updateDoc(doc(db, 'gandolaReceptions', currentReception.id), {
          status: 'completada',
          closedAt: new Date().toISOString(),
          tankReadings: closed.tankReadings,
        });
      } catch (error) {
        console.error('Error cerrando recepcion en Firestore:', error);
      }
    }
  },

  cancelReception: async () => {
    const { currentReception } = get();
    set({ currentReception: null });

    if (isFirebaseConfigured() && currentReception?.id) {
      try {
        const db = getDb();
        await deleteDoc(doc(db, 'gandolaReceptions', currentReception.id));
      } catch (error) {
        console.error('Error cancelando recepcion en Firestore:', error);
      }
    }
  },

  cleanup: () => {
    if (unsubscribeCurrentReception) {
      unsubscribeCurrentReception();
      unsubscribeCurrentReception = null;
    }
    if (unsubscribeReceptionsHistory) {
      unsubscribeReceptionsHistory();
      unsubscribeReceptionsHistory = null;
    }
  },
}));

export { useGandolaStore };