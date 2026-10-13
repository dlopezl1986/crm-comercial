import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ACTIVITY_META } from '@/domain/labels';
import { addDays, formatTime, sameDay, startOfDay, tsToDate } from '@/lib/dates';
import type { Activity } from '@/types/models';
import { ActivityDialog, type ActivityDefaults } from '@/features/activities/ActivityDialog';

type View = 'month' | 'week' | 'day';

interface CalItem {
  key: string; title: string; sub?: string; at: Date; color: string; done: boolean;
  activity?: Activity; link?: string; isNextStep?: boolean;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00–20:00

const startOfWeek = (d: Date) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));

/** Calendario interno: actividades + próximos pasos de oportunidades y leads. */
export function CalendarPage() {
  const d = useData();
  const navigate = useNavigate();
  const [view, setView] = usePersistentState<View>('cal.view', 'week');
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [creating, setCreating] = useState<ActivityDefaults | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);

  const items = useMemo<CalItem[]>(() => {
    const out: CalItem[] = [];
    d.activities.forEach((a) => {
      if (a.status === 'cancelled') return;
      const at = tsToDate(a.dueAt);
      if (!at) return;
      const co = a.companyId ? d.companyById.get(a.companyId)?.name : undefined;
      out.push({ key: a.id, title: a.title, sub: co, at, color: ACTIVITY_META[a.type].color, done: a.status === 'done', activity: a });
    });
    d.opportunities.forEach((o) => {
      const at = tsToDate(o.nextStepAt);
      if (!at || !o.nextStep) return;
      out.push({ key: `o${o.id}`, title: o.nextStep, sub: o.name, at, color: '#4f46e5', done: false, link: `/oportunidades/${o.id}`, isNextStep: true });
    });
    d.leads.forEach((l) => {
      const at = tsToDate(l.nextStepAt);
      if (!at || !l.nextStep || l.status === 'converted' || l.status === 'disqualified') return;
      out.push({ key: `l${l.id}`, title: l.nextStep, sub: l.title, at, color: '#0ea5e9', done: false, link: `/leads/${l.id}`, isNextStep: true });
    });
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [d]);

  const dayItems = (day: Date) => items.filter((i) => sameDay(i.at, day));
  const open = (i: CalItem) => (i.activity ? setEditing(i.activity) : i.link && navigate(i.link));
  const createAt = (day: Date, hour = 9) => setCreating({ dueAt: new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour), status: 'pending', type: 'task' });

  const move = (dir: number) => setCursor((c) => view === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * (view === 'week' ? 7 : 1)));
  const title = view === 'month'
    ? cursor.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `Semana del ${startOfWeek(cursor).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`
      : cursor.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  if (!d.ready) return <FullScreenLoader />;
  const today = new Date();

  const Chip = ({ i }: { i: CalItem }) => (
    <button className={`cal-item ${i.done ? 'cal-item--done' : ''} ${i.isNextStep ? 'cal-item--next' : ''}`} style={{ '--c': i.color } as React.CSSProperties}
      onClick={(e) => { e.stopPropagation(); open(i); }} title={[i.title, i.sub].filter(Boolean).join(' · ')}>
      {i.isNextStep && <CalendarClock size={11} />}
      <span className="cal-item__time">{formatTime(i.at)}</span>
      <span className="truncate">{i.title}</span>
    </button>
  );

  return (
    <>
      <PageHeader title="Calendario" actions={<>
        <div className="segmented">
          {(['month', 'week', 'day'] as View[]).map((v) => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>{{ month: 'Mes', week: 'Semana', day: 'Día' }[v]}</button>
          ))}
        </div>
        <button className="btn btn--primary" onClick={() => createAt(cursor)}><Plus size={16} /> Nueva actividad</button>
      </>} />
      <div className="cal-nav">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
        <button className="btn btn--secondary btn--sm" onClick={() => setCursor(startOfDay(new Date()))}>Hoy</button>
        <button className="icon-btn" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        <h2 className="cal-nav__title">{title}</h2>
        <span className="muted small cal-legend"><CalendarClock size={12} /> = próximo paso de oportunidad o lead</span>
      </div>

      {view === 'month' && (() => {
        const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
        const start = startOfWeek(first);
        const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
        return (
          <div className="cal-month card card--flush">
            {WEEKDAYS.map((w) => <div key={w} className="cal-month__wd">{w}</div>)}
            {days.map((day) => {
              const list = dayItems(day);
              return (
                <div key={day.toISOString()} className={`cal-month__day ${day.getMonth() !== cursor.getMonth() ? 'out' : ''} ${sameDay(day, today) ? 'today' : ''}`}
                  onClick={() => createAt(day)}>
                  <button className="cal-month__num" onClick={(e) => { e.stopPropagation(); setCursor(day); setView('day'); }}>{day.getDate()}</button>
                  {list.slice(0, 3).map((i) => <Chip key={i.key} i={i} />)}
                  {list.length > 3 && <button className="cal-more" onClick={(e) => { e.stopPropagation(); setCursor(day); setView('day'); }}>+{list.length - 3} más</button>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {(view === 'week' || view === 'day') && (() => {
        const days = view === 'week' ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor), i)) : [cursor];
        return (
          <div className="cal-grid card card--flush" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
            <div className="cal-grid__corner" />
            {days.map((day) => (
              <div key={day.toISOString()} className={`cal-grid__head ${sameDay(day, today) ? 'today' : ''}`}>
                {day.toLocaleDateString('es-ES', { weekday: 'short' })} <strong>{day.getDate()}</strong>
              </div>
            ))}
            <div className="cal-grid__hour cal-grid__hour--allday">Sin hora</div>
            {days.map((day) => (
              <div key={`ad${day.toISOString()}`} className="cal-grid__cell cal-grid__cell--allday">
                {dayItems(day).filter((i) => i.at.getHours() < 8 || i.at.getHours() > 20).map((i) => <Chip key={i.key} i={i} />)}
              </div>
            ))}
            {HOURS.map((h) => (
              <div key={h} className="cal-grid__row">
                <div className="cal-grid__hour">{String(h).padStart(2, '0')}:00</div>
                {days.map((day) => (
                  <div key={day.toISOString() + h} className="cal-grid__cell" onClick={() => createAt(day, h)}>
                    {dayItems(day).filter((i) => i.at.getHours() === h).map((i) => <Chip key={i.key} i={i} />)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {creating && <ActivityDialog defaults={creating} onClose={() => setCreating(null)} />}
      {editing && <ActivityDialog activity={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
