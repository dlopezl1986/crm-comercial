import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { onSnapshot } from 'firebase/firestore';
import { fb } from '@/lib/firebase';
import { ensureWorkspace, DEFAULT_ORG_SETTINGS } from '@/services/workspace';
import { orgDoc } from '@/services/paths';
import type { Org, UserProfile } from '@/types/models';

interface AuthState {
  user: User | null;
  profile: UserProfile | null;
  org: Org | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unsubOrg: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(fb().auth, async (u) => {
      unsubOrg?.();
      unsubOrg = null;
      setUser(u);
      setError(null);
      if (!u) {
        setProfile(null);
        setOrg(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const p = await ensureWorkspace(u);
        setProfile(p);
        // La organización se escucha en vivo (nombre, ajustes como días de estancamiento…).
        unsubOrg = onSnapshot(orgDoc(p.defaultOrgId), (snap) => {
          const data = snap.data() as Omit<Org, 'id'> | undefined;
          if (data) setOrg({ ...data, id: snap.id, settings: { ...DEFAULT_ORG_SETTINGS, ...data.settings } });
          setLoading(false);
        }, (e) => { console.error(e); setError('No se pudo cargar la organización.'); setLoading(false); });
      } catch (e) {
        console.error(e);
        setError('No se pudo cargar tu espacio de trabajo. Revisa las reglas de Firestore.');
        setLoading(false);
      }
    });
    return () => { unsubAuth(); unsubOrg?.(); };
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(fb().auth, email.trim(), password);
  };
  const logout = () => signOut(fb().auth);

  return (
    <AuthContext.Provider value={{ user, profile, org, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Org activa; solo usar dentro de rutas protegidas. */
export function useOrg() {
  const { org } = useAuth();
  if (!org) throw new Error('No hay organización activa');
  return org;
}

/** uid + orgId de la sesión (para escrituras). */
export function useSession() {
  const { user, org } = useAuth();
  if (!user || !org) throw new Error('Sin sesión');
  return { uid: user.uid, orgId: org.id, org };
}

export function authErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'El email no es válido.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found': return 'Email o contraseña incorrectos.';
    case 'auth/too-many-requests': return 'Demasiados intentos. Espera unos minutos.';
    case 'auth/network-request-failed': return 'Sin conexión. Comprueba tu red.';
    case 'auth/operation-not-allowed': return 'El acceso con email y contraseña no está activado en Firebase.';
    default: return 'No se pudo iniciar sesión.';
  }
}
