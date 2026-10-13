import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock, Check, Clock, History, KanbanSquare, Phone, TrendingUp, Users } from 'lucide-react';
import { useAuth, useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { buildAgenda, staleOpportunities, withoutNextStep, type AgendaItem } from '@/domain/agenda';
import { computeKpis } from '@/domain/stats';
import { ACTIVITY_META, PIPELINE_STAGE_LIST, STAGE_META } from '@/domain/labels';
import { guessType } from '@/domain/labels';
import { setActivityStatus } from '@/services/crm';
import { formatTime, relativeDay, tsToDate, addDays, startOfDay } from '@/lib/dates';
import { money, moneyCompact, num } from '@/lib/format';
import { fullName } from '@/lib/text';
import { ActivityDialog, type ActivityDefaults } from '@/features/activities/ActivityDialog';
import { KpiGrid } from '@/features/reports/KpiGrid';

function greeting(d: Date) {
  const h = d.getHours();
  return h < 14 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

const COLS = [
  { id: 'overdue', label: 'Atrasado' },
  { id: 'today', label: 'Hoy' },
  { id: 'tomorrow', label: 'Mañana' },
  { id: 'soon', label: 'Próximamente' },
] as const;

/** Dashboard "¿Qué tengo que hacer ahora?". */
export function DashboardPage() {
  const { user } = useAuth();
  const ctx = useSession();
  const d = useData();
  const [logging, setLogging] = useState<ActivityDefaults | null>(null);
  const now = new Date();

  const view = useMemo(() => {
    const agenda = buildAgenda(d, now);
    const stale = staleOpportunities(d, ctx.org.settings.staleDays, now);
    const noNext = withoutNextStep(d);
    const recent = d.activities.filter((a) => a.status === 'done')
      .sort((a, b) => (tsToDate(b.completedAt ?? b.dueAt)?.getTime() ?? 0) - (tsToDate(a.completedAt ?? a.dueAt)?.getTime() ?? 0)).slice(0, 8);
    const weekAgo = addDays(startOfDay(now), -6);
    const week = d.activities.filter((a) => a.status === 'done' && (tsToDate(a.completedAt ?? a.dueAt)?.getTime() ?? 0) >= weekAgo.getTime());
    const upcomingMeetings = d.activities.filter((a) => a.status === 'pending' && (a.type === 'meeting' || a.type === 'demo')
      && (tsToDate(a.dueAt)?.getTime() ?? 0) >= now.getTime() && (tsToDate(a.dueAt)?.getTime() ?? 0) < addDays(now, 2).getTime());
    const pipeline = PIPELINE_STAGE_LIST.map((s) => {
      const os = d.opportunities.filter((o) => o.stage === s);
      return { stage: s, count: os.length, value: os.reduce((t, o) => t + (o.value ?? 0), 0) };
    });
    return { agenda, stale, noNext, recent, week, upcomingMeetings, pipeline, kpis: computeKpis(d) };
  }, [d, ctx.org.settings.staleDays]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d.ready) return <FullScreenLoader />;

  const name = user?.displayName || user?.email?.split('@')[0];
  const byWhen = (w: string) => view.agenda.filter((i) => i.when === w);
  const overdue = byWhen('overdue');
  const todayCount = byWhen('today').length;
  const maxPipe = Math.max(1, ...view.pipeline.map((p) => p.count));
  const weekCount = (t: string) => view.week.filter((a) => a.type === t).length;

  const complete = (i: AgendaItem) => {
    if (i.kind === 'activity' && i.activity) { setActivityStatus(ctx, i.activity, 'done'); return; }
    const o = i.kind === 'opportunity' ? d.opportunityById.get(i.id) : undefined;
    const l = i.kind === 'lead' ? d.leadById.get(i.id) : undefined;
    const src = o ?? l;
    setLogging({
      type: guessType(i.title), title: i.title, status: 'done',
      opportunityId: o?.id ?? null, leadId: l?.id ?? null, companyId: src?.companyId ?? null, contactId: src?.contactId ?? null,
      completes: { col: o ? 'opportunities' : 'leads', id: i.id },
    });
  };

  const Item = ({ i }: { i: AgendaItem }) => {
    const Icon = i.activityType ? ACTIVITY_META[i.activityType].icon : CalendarClock;
    return (
      <li className="agenda-item">
        <button className="agenda-item__check" title="Hecho" onClick={() => complete(i)}><Check size={13} /></button>
        <Link to={i.link} className="agenda-item__body">
          <span className="agenda-item__title"><Icon size={13} /> <span>{i.title}</span></span>
          <span className="agenda-item__sub">
            <span className="agenda-item__time">{i.when === 'overdue' ? relativeDay(i.at) : i.when === 'soon' ? i.at.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }) : formatTime(i.at)}</span>
            {i.subtitle && <> · {i.subtitle}</>}
          </span>
        </Link>
      </li>
    );
  };

  return (
    <div className="dashboard">
      <div className="dash-hero">
        <div>
          <div className="dash-hero__date">{now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>{greeting(now)}, {name}</h1>
          <p className="muted">
            {todayCount ? `Tienes ${todayCount} ${todayCount === 1 ? 'cosa' : 'cosas'} para hoy` : 'Nada programado para hoy'}
            {overdue.length ? ` y ${overdue.length} atrasada${overdue.length === 1 ? '' : 's'}` : ''}.
          </p>
        </div>
        <div className="dash-hero__actions">
          <button className="btn btn--primary" onClick={() => setLogging({ type: 'call' })}><Phone size={15} /> Registrar llamada</button>
          <Link to="/oportunidades" className="btn btn--secondary"><KanbanSquare size={15} /> Pipeline</Link>
        </div>
      </div>

      <div className="dash-grid">
        <Card title="Próximos pasos" icon={CalendarClock} subtitle="¿Qué tengo que hacer?" className="dash-next">
          {view.agenda.filter((i) => i.when !== 'later').length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nada programado">Define el próximo paso de tus oportunidades y leads.</EmptyState>
          ) : (
            <div className="next-cols next-cols--4">
              {COLS.map((c) => {
                const list = byWhen(c.id);
                return (
                  <div key={c.id} className="next-col">
                    <div className={`next-col__label next-col__label--${c.id}`}>{c.label}<span className="next-col__count">{list.length}</span></div>
                    {list.length ? <ul className="agenda">{list.slice(0, 8).map((i) => <Item key={i.key} i={i} />)}</ul> : <p className="muted small next-col__empty">—</p>}
                    {list.length > 8 && <Link to="/calendario" className="small">+{list.length - 8} más</Link>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Pendientes" icon={AlertTriangle} subtitle="¿Qué tengo atrasado?" className="dash-pending">
          <ul className="alerts">
            <li className={overdue.length ? 'alerts__item alerts__item--danger' : 'alerts__item'}>
              <Clock size={15} /><span><strong>{overdue.length}</strong> {overdue.length === 1 ? 'tarea atrasada' : 'tareas y pasos atrasados'}</span>
            </li>
            <li className={view.stale.length ? 'alerts__item alerts__item--warn' : 'alerts__item'}>
              <AlertTriangle size={15} /><span><strong>{view.stale.length}</strong> oportunidades llevan más de {ctx.org.settings.staleDays} días sin actividad</span>
            </li>
            <li className={view.noNext.length ? 'alerts__item alerts__item--warn' : 'alerts__item'}>
              <CalendarClock size={15} /><span><strong>{view.noNext.length}</strong> oportunidades abiertas sin próximo paso</span>
            </li>
            <li className={view.upcomingMeetings.length ? 'alerts__item alerts__item--info' : 'alerts__item'}>
              <Users size={15} /><span><strong>{view.upcomingMeetings.length}</strong> reuniones o demos en las próximas 48 h</span>
            </li>
          </ul>
          {(view.stale.length > 0 || view.noNext.length > 0) && (
            <ul className="mini-list">
              {view.stale.slice(0, 4).map(({ opp, days }) => (
                <li key={opp.id}><Link to={`/oportunidades/${opp.id}`} className="strong-link">{opp.name}</Link><span className="mini-list__end warn small">{days} días</span></li>
              ))}
              {view.noNext.filter((o) => !view.stale.some((s) => s.opp.id === o.id)).slice(0, 3).map((o) => (
                <li key={o.id}><Link to={`/oportunidades/${o.id}`} className="strong-link">{o.name}</Link><span className="mini-list__end muted small">sin próximo paso</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Actividad" icon={History} subtitle="¿Qué he hecho?" className="dash-activity">
          <div className="week-stats">
            <div><strong>{weekCount('call')}</strong><span>llamadas</span></div>
            <div><strong>{weekCount('email')}</strong><span>emails</span></div>
            <div><strong>{weekCount('meeting') + weekCount('demo')}</strong><span>reuniones/demos</span></div>
            <div className="muted small">últimos 7 días</div>
          </div>
          {view.recent.length === 0 ? <p className="muted small">Aún no has registrado actividad.</p> : (
            <ul className="mini-list">
              {view.recent.map((a) => {
                const M = ACTIVITY_META[a.type];
                const co = a.companyId ? d.companyById.get(a.companyId)?.name : a.contactId ? fullName(d.contactById.get(a.contactId) ?? { firstName: '' }) : '';
                return <li key={a.id}><M.icon size={14} style={{ color: M.color }} /><span className="truncate">{a.title}{co ? ` · ${co}` : ''}</span><span className="mini-list__end muted small">{relativeDay(a.completedAt ?? a.dueAt)}</span></li>;
              })}
            </ul>
          )}
        </Card>

        <Card title="Pipeline" icon={KanbanSquare} subtitle={`¿Cómo están mis oportunidades? · ${money(view.kpis.pipelineValue)} abierto`} className="dash-pipeline"
          actions={<Link to="/oportunidades" className="small">Ver pipeline</Link>}>
          {d.opportunities.length === 0 ? <EmptyState icon={KanbanSquare} title="Sin oportunidades">Crea una o convierte un lead.</EmptyState> : (
            <div className="pipe-bars">
              {view.pipeline.map((p) => (
                <Link to="/oportunidades" key={p.stage} className="pipe-bar">
                  <span className="pipe-bar__label">{STAGE_META[p.stage].label}</span>
                  <span className="pipe-bar__track"><span className="pipe-bar__fill" style={{ width: `${(p.count / maxPipe) * 100}%`, background: 'var(--series-1)' }} /></span>
                  <span className="pipe-bar__count">{num(p.count)}</span>
                  <span className="pipe-bar__value">{p.value ? moneyCompact(p.value) : ''}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="Resultados" icon={TrendingUp} subtitle="¿Cómo estoy vendiendo?" className="dash-results" actions={<Link to="/informes" className="small">Ver informes</Link>}>
          <KpiGrid k={view.kpis} compact />
        </Card>
      </div>

      {logging && <ActivityDialog defaults={logging} onClose={() => setLogging(null)} />}
    </div>
  );
}
