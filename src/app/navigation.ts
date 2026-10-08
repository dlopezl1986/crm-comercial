import {
  LayoutDashboard, CalendarDays, ListChecks, Sparkles, KanbanSquare, Building2, Users,
  BarChart3, Package, Settings, type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Fase del plan en la que se construye la sección (para mostrar su estado). */
  phase: number;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/** Fuente única de la navegación: la usan el menú lateral y el router. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Mi día',
    items: [
      { path: '/', label: 'Dashboard', icon: LayoutDashboard, phase: 1 },
      { path: '/calendario', label: 'Calendario', icon: CalendarDays, phase: 6 },
      { path: '/actividades', label: 'Actividades', icon: ListChecks, phase: 5 },
    ],
  },
  {
    label: 'Ventas',
    items: [
      { path: '/leads', label: 'Leads', icon: Sparkles, phase: 3 },
      { path: '/oportunidades', label: 'Oportunidades', icon: KanbanSquare, phase: 4 },
    ],
  },
  {
    label: 'Cuentas',
    items: [
      { path: '/empresas', label: 'Empresas', icon: Building2, phase: 2 },
      { path: '/contactos', label: 'Contactos', icon: Users, phase: 2 },
    ],
  },
  {
    label: 'Análisis',
    items: [{ path: '/informes', label: 'Informes', icon: BarChart3, phase: 8 }],
  },
  {
    label: 'Ajustes',
    items: [
      { path: '/servicios', label: 'Servicios', icon: Package, phase: 4 },
      { path: '/configuracion', label: 'Configuración', icon: Settings, phase: 1 },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Fase actualmente desplegada: las secciones de fases posteriores se muestran como "próximamente". */
export const CURRENT_PHASE = 1;
