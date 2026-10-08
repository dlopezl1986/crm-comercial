import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { fb } from '@/lib/firebase';
import { ensureWorkspace } from '@/services/workspace';
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
    return onAuthStateChanged(fb().auth, async (u) => {
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
        const ws = await ensureWorkspace(u);
        setProfile(ws.profile);
        setOrg(ws.org);
      } catch (e) {
        console.error(e);
        setError('No se pudo cargar tu espacio de trabajo. Revisa las reglas de Firestore.');
      } finally {
        setLoading(false);
      }
    });
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
