/**
 * Configuración web del proyecto Firebase del CRM (crm-comercial-dlopez).
 * Estos valores identifican el proyecto, no son secretos: la seguridad real
 * la dan Firebase Authentication y las reglas de Firestore (firestore.rules).
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDyHxStHvEb-9FiuTwt0MmRCwgK08OhTuU',
  authDomain: 'crm-comercial-dlopez.firebaseapp.com',
  projectId: 'crm-comercial-dlopez',
  storageBucket: 'crm-comercial-dlopez.firebasestorage.app',
  messagingSenderId: '537282313822',
  appId: '1:537282313822:web:383af51dceb9b1816efecf',
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
