import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED, type Firestore,
} from 'firebase/firestore';
import { firebaseConfig, isFirebaseConfigured } from '@/config/firebase.config';

/** `npm run dev:emu` arranca la app contra los emuladores locales (pruebas sin tocar datos reales). */
export const usingEmulators = import.meta.env.VITE_EMULATORS === '1';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

if (isFirebaseConfigured) {
  // Con emuladores se usa un proyecto "demo-", que nunca puede llegar a producción.
  app = initializeApp(usingEmulators ? { ...firebaseConfig, projectId: 'demo-crm' } : firebaseConfig);
  auth = getAuth(app);
  // Caché local persistente y sin límite: la sincronización incremental (services/sync.ts) depende de ella.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager(), cacheSizeBytes: CACHE_SIZE_UNLIMITED }),
  });
  if (usingEmulators) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8085);
  }
}

export { app, auth, db };

/** Acceso a los servicios asumiendo que Firebase está configurado (se valida al arrancar). */
export function fb() {
  if (!app || !auth || !db) throw new Error('Firebase no está configurado');
  return { app, auth, db };
}
