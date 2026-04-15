// netlify/functions/deleteUser.js
// Eliminar usuario Firebase Auth + documento Firestore
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp
if (!getApps().length) {
  adminApp = initializeApp({
    credential: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  })
} else {
  adminApp = getApps()[0]
}

const adminAuth = getAuth(adminApp)
const adminDb = getFirestore(adminApp)

export default async (req, context) => {
  if (req.httpMethod !== 'DELETE') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo no permitido' }) }
  }

  try {
    const { uid } = JSON.parse(req.body)

    if (!uid) {
      return { statusCode: 400, body: JSON.stringify({ error: 'UID es requerido' }) }
    }

    // Verificar que el solicitante es admin
    const callerToken = req.headers.authorization?.replace('Bearer ', '')
    if (!callerToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token requerido' }) }
    }

    const decoded = await adminAuth.verifyIdToken(callerToken)
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!callerDoc.exists() || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden eliminar usuarios' }) }
    }

    // No eliminar el propio admin
    const userDoc = await adminDb.collection('users').doc(uid).get()
    if (userDoc.exists() && userDoc.data().email === 'admin@pdv-smf.com') {
      return { statusCode: 403, body: JSON.stringify({ error: 'No se puede eliminar el administrador principal' }) }
    }

    // Eliminar documento Firestore
    await adminDb.collection('users').doc(uid).delete()

    // Eliminar usuario Auth
    await adminAuth.deleteUser(uid)

    return { statusCode: 200, body: JSON.stringify({ message: 'Usuario eliminado' }) }
  } catch (error) {
    console.error('Error deleting user:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
