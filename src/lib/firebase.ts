import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '@/config/firebase.config';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // Caché local persistente: lecturas instantáneas y tolerancia a cortes de red.
  db = initializeFirestore(app, { localCache: persistentLocalCache() });
}

export { app, auth, db };

/** Acceso a los servicios asumiendo que Firebase está configurado (se valida al arrancar). */
export function fb() {
  if (!app || !auth || !db) throw new Error('Firebase no está configurado');
  return { app, auth, db };
}
