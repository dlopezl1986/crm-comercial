import { lazy } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/auth/AuthProvider';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { ToastProvider } from '@/components/ui/Toast';
import { AppLayout } from '@/layout/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';

const named = <K extends string>(loader: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => loader().then((m) => ({ default: m[name] })));

// Pantallas cargadas bajo demanda (gráficos y Excel pesan: no se descargan hasta usarlos).
const CompaniesPage = named(() => import('@/features/companies/CompaniesPage'), 'CompaniesPage');
const CompanyDetailPage = named(() => import('@/features/companies/CompanyDetailPage'), 'CompanyDetailPage');
const ContactsPage = named(() => import('@/features/contacts/ContactsPage'), 'ContactsPage');
const ContactDetailPage = named(() => import('@/features/contacts/ContactDetailPage'), 'ContactDetailPage');
const LeadsPage = named(() => import('@/features/leads/LeadsPage'), 'LeadsPage');
const LeadDetailPage = named(() => import('@/features/leads/LeadDetailPage'), 'LeadDetailPage');
const OpportunitiesPage = named(() => import('@/features/opportunities/OpportunitiesPage'), 'OpportunitiesPage');
const OpportunityDetailPage = named(() => import('@/features/opportunities/OpportunityDetailPage'), 'OpportunityDetailPage');
const ActivitiesPage = named(() => import('@/features/activities/ActivitiesPage'), 'ActivitiesPage');
const CalendarPage = named(() => import('@/features/calendar/CalendarPage'), 'CalendarPage');
const ServicesPage = named(() => import('@/features/services/ServicesPage'), 'ServicesPage');
const ReportsPage = named(() => import('@/features/reports/ReportsPage'), 'ReportsPage');
const ImportExportPage = named(() => import('@/features/importExport/ImportExportPage'), 'ImportExportPage');
const CampaignsPage = named(() => import('@/features/campaigns/CampaignsPage'), 'CampaignsPage');
const SettingsPage = named(() => import('@/pages/SettingsPage'), 'SettingsPage');

// HashRouter: compatible con hosting estático (GitHub Pages) sin reescrituras de rutas.
export function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ToastProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/empresas" element={<CompaniesPage />} />
                  <Route path="/empresas/:id" element={<CompanyDetailPage />} />
                  <Route path="/contactos" element={<ContactsPage />} />
                  <Route path="/contactos/:id" element={<ContactDetailPage />} />
                  <Route path="/leads" element={<LeadsPage />} />
                  <Route path="/leads/:id" element={<LeadDetailPage />} />
                  <Route path="/oportunidades" element={<OpportunitiesPage />} />
                  <Route path="/oportunidades/:id" element={<OpportunityDetailPage />} />
                  <Route path="/actividades" element={<ActivitiesPage />} />
                  <Route path="/calendario" element={<CalendarPage />} />
                  <Route path="/servicios" element={<ServicesPage />} />
                  <Route path="/campanas" element={<CampaignsPage />} />
                  <Route path="/informes" element={<ReportsPage />} />
                  <Route path="/importar" element={<ImportExportPage />} />
                  <Route path="/configuracion" element={<SettingsPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </HashRouter>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
