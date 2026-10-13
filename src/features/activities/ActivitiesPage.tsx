import { useMemo, useState } from 'react';
import { ListChecks, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/Select';
import { Tabs } from '@/components/ui/Tabs';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { ACTIVITY_META, ACTIVITY_TYPES, CALL_RESULTS } from '@/domain/labels';
import { addDays, startOfDay, tsToDate } from '@/lib/dates';
import { fullName, matches } from '@/lib/text';
import { num } from '@/lib/format';
import { Timeline } from './Timeline';
import { ActivityDialog } from './ActivityDialog';

type Tab = 'pending' | 'done' | 'all';

export function ActivitiesPage() {
  const d = useData();
  const [tab, setTab] = usePersistentState<Tab>('acts.tab', 'pending');
  const [q, setQ] = usePersistentState('acts.q', '');
  const [type, setType] = usePersistentState('acts.type', '');
  const [range, setRange] = usePersistentState('acts.range', '');
  const [result, setResult] = usePersistentState('acts.result', '');
  const [creating, setCreating] = useState(false);
  const [limit, setLimit] = useState(100);

  const filtered = useMemo(() => {
    const today = startOfDay(new Date());
    const inRange = (dt: Date) => {
      switch (range) {
        case 'overdue': return dt < today;
        case 'today': return dt >= today && dt < addDays(today, 1);
        case 'week': return dt >= addDays(today, -7) && dt < addDays(today, 8);
        case 'month': return dt >= addDays(today, -30) && dt < addDays(today, 31);
        default: return true;
      }
    };
    return d.activities.filter((a) => {
      if (tab === 'pending' && a.status !== 'pending') return false;
      if (tab === 'done' && a.status !== 'done') return false;
      if (type && a.type !== type) return false;
      if (result && a.result !== result) return false;
      const dt = tsToDate(a.dueAt);
      if (dt && !inRange(dt)) return false;
      const co = a.companyId ? d.companyById.get(a.companyId)?.name : '';
      const ct = a.contactId ? d.contactById.get(a.contactId) : undefined;
      return matches(q, [a.title, a.description, co, ct ? fullName(ct) : '']);
    });
  }, [d, tab, q, type, range, result]);

  const counts = useMemo(() => ({
    pending: d.activities.filter((a) => a.status === 'pending').length,
    done: d.activities.filter((a) => a.status === 'done').length,
  }), [d.activities]);

  if (!d.ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Actividades" subtitle={`${num(counts.pending)} pendientes · ${num(counts.done)} hechas`}
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Registrar actividad</button>} />
      <Tabs value={tab} onChange={setTab} items={[
        { id: 'pending', label: 'Pendientes', count: counts.pending },
        { id: 'done', label: 'Hechas', count: counts.done },
        { id: 'all', label: 'Todas', count: d.activities.length },
      ]} />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Buscar actividad, empresa, contacto…" />
        <FilterSelect label="Tipo" value={type} onChange={setType} options={ACTIVITY_TYPES.map((t) => ({ value: t, label: ACTIVITY_META[t].label }))} />
        <FilterSelect label="Fecha" value={range} onChange={setRange} options={[
          { value: 'overdue', label: 'Atrasadas / pasadas' }, { value: 'today', label: 'Hoy' },
          { value: 'week', label: '± 7 días' }, { value: 'month', label: '± 30 días' },
        ]} />
        <FilterSelect label="Resultado llamada" value={result} onChange={setResult} options={Object.entries(CALL_RESULTS).map(([value, label]) => ({ value, label }))} />
      </div>
      <Card title={`${num(filtered.length)} actividades`} icon={ListChecks}>
        {filtered.length ? <Timeline activities={filtered.slice(0, limit)} /> : <EmptyState icon={ListChecks} title="Sin actividades">Registra llamadas, emails, reuniones o tareas.</EmptyState>}
        {filtered.length > limit && <button className="btn btn--ghost" onClick={() => setLimit((l) => l + 100)}>Ver más</button>}
      </Card>
      {creating && <ActivityDialog onClose={() => setCreating(false)} />}
    </>
  );
}
