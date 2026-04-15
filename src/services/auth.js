// src/services/auth.js
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../config/firebase'

// Roles disponibles
export const ROLES = {
  ADMIN: 'administrador',
  SUPERVISOR: 'supervisor'
}

// INICIAR SESIÓN
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password)
    const user = userCredential.user

    // Obtener datos adicionales del usuario desde Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid))
    if (!userDoc.exists()) {
      await signOut(auth)
      return { success: false, error: 'Usuario no encontrado en la base de datos' }
    }

    const userData = userDoc.data()

    if (!userData.active) {
      await signOut(auth)
      return { success: false, error: 'Tu cuenta está desactivada. Contacta al administrador.' }
    }

    // Actualizar último acceso
    await setDoc(doc(db, 'users', user.uid), {
      lastLogin: serverTimestamp()
    }, { merge: true })

    return {
      success: true,
      user: {
        uid: user.uid,
        email: user.email,
        ...userData
      }
    }
  } catch (error) {
    console.error('Error iniciando sesión:', error)
    let errorMessage = 'Error al iniciar sesión'
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'Usuario no encontrado'
    } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
      errorMessage = 'Credenciales incorrectas'
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Correo electrónico invalido'
    }
    return { success: false, error: errorMessage }
  }
}

// CERRAR SESIÓN
export const logoutUser = async () => {
  try {
    await signOut(auth)
    return { success: true }
  } catch (error) {
    console.error('Error cerrando sesión:', error)
    return { success: false, error: error.message }
  }
}

// RECUPERAR CONTRASEÑA
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email)
    return { success: true }
  } catch (error) {
    console.error('Error enviando email de recuperación:', error)
    let errorMessage = 'Error al enviar el email'
    if (error.code === 'auth/user-not-found') {
      errorMessage = 'No existe una cuenta con este correo'
    }
    return { success: false, error: errorMessage }
  }
}

// OBSERVADOR DE AUTENTICACIÓN
export const subscribeToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data()
          if (!userData.active) {
            callback(null)
            await signOut(auth)
            return
          }
          callback({
            uid: user.uid,
            email: user.email,
            ...userData
          })
        } else {
          callback(null)
        }
      } catch (error) {
        console.error('Error verificando usuario en Firestore:', error)
        callback(null)
      }
    } else {
      callback(null)
    }
  })
}

// OBTENER USUARIO ACTUAL
export const getCurrentUser = async () => {
  const user = auth.currentUser
  if (!user) return null
  const userDoc = await getDoc(doc(db, 'users', user.uid))
  if (!userDoc.exists()) return null
  return { uid: user.uid, email: user.email, ...userDoc.data() }
}
