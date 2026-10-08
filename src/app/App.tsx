import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AppLayout } from '@/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { CURRENT_PHASE, NAV_ITEMS } from './navigation';

const BUILT: Record<string, JSX.Element> = {
  '/': <DashboardPage />,
  '/configuracion': <SettingsPage />,
};

// HashRouter: compatible con hosting estático (GitHub Pages) sin reescrituras de rutas.
export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {NAV_ITEMS.map((item) => (
                  <Route
                    key={item.path}
                    path={item.path}
                    element={item.phase <= CURRENT_PHASE && BUILT[item.path] ? BUILT[item.path] : <ComingSoonPage />}
                  />
                ))}
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </HashRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
