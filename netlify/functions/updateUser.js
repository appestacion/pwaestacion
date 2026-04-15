// netlify/functions/updateUser.js
// Actualizar usuario Firestore + opcionalmente cambiar password en Auth
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
  if (req.httpMethod !== 'PUT') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo no permitido' }) }
  }

  try {
    const { uid, name, role, active, password } = JSON.parse(req.body)

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
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden actualizar usuarios' }) }
    }

    // Actualizar documento Firestore
    const updateData = { updatedAt: new Date() }
    if (name !== undefined) updateData.name = name
    if (role !== undefined) updateData.role = role
    if (active !== undefined) updateData.active = active

    await adminDb.collection('users').doc(uid).update(updateData)

    // Si se proporciona nueva contraseña, actualizar en Auth
    if (password && password.length >= 6) {
      await adminAuth.updateUser(uid, { password })
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Usuario actualizado' }) }
  } catch (error) {
    console.error('Error updating user:', error)
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) }
  }
}
