import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Plus, Sparkles, Tags, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { TagList } from '@/components/ui/TagList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Badge, WhenBadge } from '@/components/ui/Badges';
import { Tabs } from '@/components/ui/Tabs';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useSelection } from '@/hooks/useSelection';
import { bulkUpdate } from '@/services/repository';
import { LEAD_STATUS } from '@/domain/labels';
import { relativeDay, tsToDate, whenOf } from '@/lib/dates';
import { matches, uniqueSorted } from '@/lib/text';
import { num } from '@/lib/format';
import type { Lead, LeadStatus } from '@/types/models';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { BulkTagDialog, applyTags } from '@/features/shared/BulkTagDialog';
import { LeadForm } from './LeadForm';

const PAGE = 50;
type Tab = 'active' | LeadStatus | 'all';

export function LeadsPage() {
  const d = useData();
  const { orgId } = useSession();
  const toast = useToast();
  const [tab, setTab] = usePersistentState<Tab>('leads.tab', 'active');
  const [q, setQ] = usePersistentState('leads.q', '');
  const [tag, setTag] = usePersistentState('leads.tag', '');
  const [sector, setSector] = usePersistentState('leads.sector', '');
  const [next, setNext] = usePersistentState('leads.next', '');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [calling, setCalling] = useState<Lead | null>(null);
  const [dialog, setDialog] = useState<'tags' | 'delete' | null>(null);
  const sel = useSelection();

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: d.leads.length, active: 0 };
    d.leads.forEach((l) => { c[l.status] = (c[l.status] ?? 0) + 1; if (l.status !== 'converted' && l.status !== 'disqualified') c.active++; });
    return c;
  }, [d.leads]);
  const tags = useMemo(() => uniqueSorted(d.leads.flatMap((l) => l.tags ?? [])), [d.leads]);
  const sectors = useMemo(() => uniqueSorted(d.leads.map((l) => l.companyId ? d.companyById.get(l.companyId)?.sector : undefined)), [d.leads, d.companyById]);

  const filtered = useMemo(() => d.leads.filter((l) => {
    if (tab === 'active' ? (l.status === 'converted' || l.status === 'disqualified') : tab !== 'all' && l.status !== tab) return false;
    if (tag && !l.tags?.includes(tag)) return false;
    const co = l.companyId ? d.companyById.get(l.companyId) : undefined;
    if (sector && co?.sector !== sector) return false;
    if (next) {
      const w = whenOf(l.nextStepAt);
      if (next === 'none' ? !!l.nextStep : next === 'due' ? !(w === 'overdue' || w === 'today') : w !== next) return false;
    }
    return matches(q, [l.title, co?.name, co?.phone, co?.email, co?.city, co?.sector, l.source]);
  }).sort((a, b) => {
    // Primero lo que toca hoy o está atrasado, después sin próximo paso, después el resto por fecha.
    const ta = tsToDate(a.nextStepAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const tb = tsToDate(b.nextStepAt)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return ta - tb || a.title.localeCompare(b.title, 'es');
  }), [d.leads, d.companyById, tab, q, tag, sector, next]);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); sel.clear(); };
  const ids = [...sel.selected];
  if (!d.ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Leads" subtitle={`${num(counts.active)} activos de ${num(d.leads.length)}`}
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo lead</button>} />
      <Tabs value={tab} onChange={reset(setTab)} items={[
        { id: 'active', label: 'Activos', count: counts.active },
        ...(['new', 'attempting', 'contacted', 'qualified', 'converted', 'disqualified'] as LeadStatus[]).map((s) => ({ id: s, label: LEAD_STATUS[s].label, count: counts[s] ?? 0 })),
        { id: 'all', label: 'Todos', count: counts.all },
      ]} />
      <div className="toolbar">
        <SearchInput value={q} onChange={reset(setQ)} placeholder="Buscar lead, empresa, teléfono, ciudad…" />
        <FilterSelect label="Etiqueta" value={tag} onChange={reset(setTag)} options={tags.map((t) => ({ value: t, label: t }))} />
        <FilterSelect label="Sector" value={sector} onChange={reset(setSector)} options={sectors.map((t) => ({ value: t, label: t }))} />
        <FilterSelect label="Próximo paso" value={next} onChange={reset(setNext)} options={[
          { value: 'due', label: 'Hoy o atrasado' }, { value: 'tomorrow', label: 'Mañana' }, { value: 'none', label: 'Sin próximo paso' },
        ]} />
      </div>
      {sel.selected.size > 0 && (
        <div className="bulkbar">
          <strong>{num(sel.selected.size)} seleccionados</strong>
          <button className="btn btn--secondary btn--sm" onClick={() => setDialog('tags')}><Tags size={14} /> Etiquetas</button>
          <button className="btn btn--secondary btn--sm danger" onClick={() => setDialog('delete')}><Trash2 size={14} /> Eliminar</button>
          <button className="btn btn--ghost btn--sm" onClick={sel.clear}>Cancelar</button>
        </div>
      )}
      <div className="card card--flush">
        {filtered.length === 0 ? (
          <EmptyState icon={Sparkles} title={d.leads.length ? 'Sin resultados' : 'Aún no hay leads'}>
            {d.leads.length ? 'Prueba con otros filtros.' : 'Crea un lead o genera leads desde Empresas (selección → Crear leads).'}
          </EmptyState>
        ) : (
          <table className="table">
            <thead><tr>
              <th className="col-check"><input type="checkbox" checked={sel.selected.size === filtered.length} onChange={(e) => sel.setAll(filtered.map((l) => l.id), e.target.checked)} /></th>
              <th>Lead</th><th>Teléfono</th><th>Estado</th><th>Próximo paso</th><th>Etiquetas</th><th>Últ. actividad</th><th></th>
            </tr></thead>
            <tbody>
              {filtered.slice(page * PAGE, page * PAGE + PAGE).map((l) => {
                const co = l.companyId ? d.companyById.get(l.companyId) : undefined;
                const ct = l.contactId ? d.contactById.get(l.contactId) : undefined;
                const tel = ct?.phone || ct?.mobile || co?.phone;
                return (
                  <tr key={l.id} className={sel.selected.has(l.id) ? 'selected' : ''}>
                    <td className="col-check"><input type="checkbox" checked={sel.selected.has(l.id)} onChange={() => sel.toggle(l.id)} /></td>
                    <td><Link to={`/leads/${l.id}`} className="strong-link">{l.title}</Link>
                      {co && <div className="muted small truncate">{[co.sector, co.city].filter(Boolean).join(' · ')}</div>}</td>
                    <td className="nowrap">{tel && <a href={`tel:${tel}`}>{tel}</a>}</td>
                    <td><Badge color={LEAD_STATUS[l.status].color}>{LEAD_STATUS[l.status].label}</Badge></td>
                    <td>{l.nextStep ? <span className="inline">{l.nextStep} <WhenBadge when={whenOf(l.nextStepAt)} /></span> : <span className="muted small">—</span>}</td>
                    <td><TagList tags={l.tags} max={2} /></td>
                    <td className="muted nowrap">{l.lastActivityAt ? relativeDay(l.lastActivityAt) : ''}</td>
                    <td><button className="btn btn--secondary btn--sm" onClick={() => setCalling(l)}><Phone size={13} /> Llamada</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
      </div>
      {creating && <LeadForm onClose={() => setCreating(false)} />}
      {calling && <ActivityDialog defaults={{ type: 'call', title: `Llamada a ${calling.title}`, leadId: calling.id, companyId: calling.companyId ?? null, contactId: calling.contactId ?? null,
        completes: calling.nextStep ? { col: 'leads', id: calling.id } : undefined }} onClose={() => setCalling(null)} />}
      {dialog === 'tags' && <BulkTagDialog count={ids.length} onClose={() => setDialog(null)} onApply={async (add, rem) => {
        await bulkUpdate(orgId, 'leads', ids.map((id) => ({ id, data: { tags: applyTags(d.leadById.get(id)?.tags, add, rem) } })));
        toast('Etiquetas aplicadas'); sel.clear();
      }} />}
      {dialog === 'delete' && <ConfirmDialog title="Eliminar leads" danger confirmLabel="Eliminar" onClose={() => setDialog(null)} onConfirm={async () => {
        await bulkUpdate(orgId, 'leads', ids.map((id) => ({ id, data: { deleted: true } })));
        toast(`${num(ids.length)} leads eliminados`); sel.clear();
      }}>Se eliminarán {num(ids.length)} leads. Las empresas se conservan.</ConfirmDialog>}
    </>
  );
}
