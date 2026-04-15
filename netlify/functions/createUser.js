// netlify/functions/createUser.js
// Crear usuario Firebase Auth + documento Firestore
import { initializeApp, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let adminApp
if (!getApps().length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('ERROR: FIREBASE_SERVICE_ACCOUNT no esta configurada en Netlify')
    adminApp = initializeApp({ projectId: 'missing-config' })
  } else {
    try {
      adminApp = initializeApp({
        credential: JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
      })
    } catch (parseError) {
      console.error('ERROR: FIREBASE_SERVICE_ACCOUNT JSON invalido:', parseError.message)
      adminApp = initializeApp({ projectId: 'missing-config' })
    }
  }
} else {
  adminApp = getApps()[0]
}

const adminAuth = getAuth(adminApp)
const adminDb = getFirestore(adminApp)

export default async (req, context) => {
  if (req.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Metodo no permitido' }) }
  }

  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('FIREBASE_SERVICE_ACCOUNT no configurada')
    return { statusCode: 500, body: JSON.stringify({ error: 'Firebase Admin no configurado. Contacta al administrador del sitio.' }) }
  }

  try {
    const { name, email, password, role } = JSON.parse(req.body)

    if (!name || !email || !password || !role) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Todos los campos son requeridos' }) }
    }

    if (password.length < 6) {
      return { statusCode: 400, body: JSON.stringify({ error: 'La contrasena debe tener al menos 6 caracteres' }) }
    }

    // Verificar que el solicitante es admin
    const callerToken = req.headers.authorization?.replace('Bearer ', '')
    if (!callerToken) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token requerido' }) }
    }

    const decoded = await adminAuth.verifyIdToken(callerToken)
    const callerDoc = await adminDb.collection('users').doc(decoded.uid).get()
    if (!callerDoc.exists() || callerDoc.data().role !== 'administrador') {
      return { statusCode: 403, body: JSON.stringify({ error: 'Solo administradores pueden crear usuarios' }) }
    }

    // Crear usuario en Firebase Auth
    const userRecord = await adminAuth.createUser({
      email: email.toLowerCase().trim(),
      password,
      displayName: name,
      disabled: false
    })

    // Crear documento en Firestore
    const { Timestamp } = await import('firebase-admin/firestore')
    await adminDb.collection('users').doc(userRecord.uid).set({
      name,
      email: email.toLowerCase().trim(),
      role,
      active: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })

    return {
      statusCode: 201,
      body: JSON.stringify({
        id: userRecord.uid,
        name,
        email: userRecord.email,
        role,
        active: true
      })
    }
  } catch (error) {
    console.error('Error creating user:', error)
    let statusCode = 500
    let errorMessage = error.message

    if (error.code === 'auth/email-already-exists') {
      statusCode = 409
      errorMessage = 'El correo electronico ya esta registrado'
    } else if (error.code === 'auth/invalid-email') {
      statusCode = 400
      errorMessage = 'Correo electronico invalido'
    } else if (error.code === 'auth/weak-password') {
      statusCode = 400
      errorMessage = 'La contrasena es demasiado debil'
    }

    return { statusCode, body: JSON.stringify({ error: errorMessage }) }
  }
}