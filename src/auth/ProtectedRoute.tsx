import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { FullScreenLoader } from '@/components/ui/Spinner';

export function ProtectedRoute() {
  const { user, org, loading, error, logout } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (error || !org) {
    return (
      <div className="center-screen">
        <div className="card" style={{ maxWidth: 420 }}>
          <h2>Error al cargar</h2>
          <p className="muted">{error ?? 'Espacio de trabajo no disponible.'}</p>
          <button className="btn btn--secondary" onClick={logout}>Cerrar sesión</button>
        </div>
      </div>
    );
  }
  return <Outlet />;
}
