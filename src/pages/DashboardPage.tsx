import { AlertTriangle, CalendarClock, History, KanbanSquare, TrendingUp } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';

const KPIS = ['Leads', 'Oportunidades abiertas', 'Valor del pipeline', 'Valor ganado', 'Tasa de conversión'];

function greeting(d: Date) {
  const h = d.getHours();
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

/**
 * Dashboard "¿Qué tengo que hacer ahora?".
 * Fase 1: estructura y jerarquía de bloques. Cada bloque se conecta a datos reales
 * en la fase que crea esos datos (oportunidades F4, actividades F5, pendientes F6, KPIs F8).
 */
export function DashboardPage() {
  const { user } = useAuth();
  const now = new Date();
  const today = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const name = user?.displayName || user?.email?.split('@')[0];

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div>
          <div className="dash-hero__date">{today}</div>
          <h1>{greeting(now)}, {name}</h1>
          <p className="muted">Esto es lo que tienes entre manos hoy.</p>
        </div>
      </div>

      <div className="dash-grid">
        <Card title="Próximos pasos" icon={CalendarClock} className="dash-next">
          <div className="next-cols">
            {['Hoy', 'Mañana', 'Próximamente'].map((label) => (
              <div key={label} className="next-col">
                <div className={`next-col__label next-col__label--${label === 'Hoy' ? 'today' : label === 'Mañana' ? 'tomorrow' : 'later'}`}>{label}</div>
                <EmptyState icon={CalendarClock} title="Nada programado">
                  Aquí aparecerán los próximos pasos de tus oportunidades.
                </EmptyState>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Pendientes" icon={AlertTriangle} className="dash-pending">
          <EmptyState icon={AlertTriangle} title="Sin atrasos">
            Actividades vencidas y oportunidades estancadas.
          </EmptyState>
        </Card>

        <Card title="Actividad reciente" icon={History} className="dash-activity">
          <EmptyState icon={History} title="Sin actividad todavía">
            Llamadas, emails, reuniones y demos que registres.
          </EmptyState>
        </Card>

        <Card title="Pipeline" icon={KanbanSquare} className="dash-pipeline">
          <EmptyState icon={KanbanSquare} title="Sin oportunidades">
            Resumen de oportunidades por etapa.
          </EmptyState>
        </Card>

        <Card title="Resultados" icon={TrendingUp} className="dash-results">
          <div className="kpis">
            {KPIS.map((k) => (
              <div key={k} className="kpi">
                <div className="kpi__label">{k}</div>
                <div className="kpi__value">—</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
