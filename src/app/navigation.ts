import {
  LayoutDashboard, CalendarDays, ListChecks, Sparkles, KanbanSquare, Building2, Users,
  BarChart3, Package, Settings, ArrowDownUp, Mail, type LucideIcon,
} from 'lucide-react';

export interface NavItem { path: string; label: string; icon: LucideIcon }
export interface NavGroup { label: string; items: NavItem[] }

/** Fuente única de la navegación lateral. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Mi día',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/calendario', label: 'Calendario', icon: CalendarDays },
      { path: '/actividades', label: 'Actividades', icon: ListChecks },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { path: '/leads', label: 'Leads', icon: Sparkles },
      { path: '/oportunidades', label: 'Oportunidades', icon: KanbanSquare },
      { path: '/campanas', label: 'Campañas', icon: Mail },
    ],
  },
  {
    label: 'Cuentas',
    items: [
      { path: '/empresas', label: 'Empresas', icon: Building2 },
      { path: '/contactos', label: 'Contactos', icon: Users },
    ],
  },
  { label: 'Análisis', items: [{ path: '/informes', label: 'Informes', icon: BarChart3 }] },
  {
    label: 'Ajustes',
    items: [
      { path: '/servicios', label: 'Servicios', icon: Package },
      { path: '/importar', label: 'Importar / Exportar', icon: ArrowDownUp },
      { path: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
];
