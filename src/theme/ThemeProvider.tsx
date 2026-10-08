import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/auth/AuthProvider';
import { saveThemePref } from '@/services/workspace';

export type Theme = 'light' | 'dark';
const STORAGE_KEY = 'crm.theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* almacenamiento no disponible */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } | null>(null);

/** Tema claro/oscuro: se guarda en el navegador (arranque inmediato) y en el perfil del usuario (sincroniza entre equipos). */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignorar */ }
  }, [theme]);

  // Al iniciar sesión, la preferencia guardada en el perfil manda.
  useEffect(() => {
    const t = profile?.prefs?.theme;
    if (t) setThemeState(t);
  }, [profile?.prefs?.theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (profile) saveThemePref(profile.uid, t).catch(console.error);
  }, [profile]);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme debe usarse dentro de <ThemeProvider>');
  return ctx;
}
