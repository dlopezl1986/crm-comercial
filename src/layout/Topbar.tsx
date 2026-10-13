import { LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { usingEmulators } from '@/lib/firebase';

export function Topbar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const initial = (user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <header className="topbar">
      <GlobalSearch />
      <div className="topbar__spacer" />
      {usingEmulators && <span className="badge badge--warn">Entorno de pruebas</span>}
      <div className="topbar__actions">
        <button className="icon-btn" onClick={toggle} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} aria-label="Cambiar tema">
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="user-chip" title={user?.email ?? ''}>
          <span className="avatar">{initial}</span>
          <span className="user-chip__email">{user?.email}</span>
        </div>
        <button className="icon-btn" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
