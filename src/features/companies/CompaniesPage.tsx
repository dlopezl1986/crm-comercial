import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Sparkles, Tags, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { TagList } from '@/components/ui/TagList';
import { EmptyState } from '@/components/ui/EmptyState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useSelection } from '@/hooks/useSelection';
import { bulkCreate, bulkUpdate } from '@/services/repository';
import { matches, uniqueSorted } from '@/lib/text';
import { num } from '@/lib/format';
import { relativeDay, tsToDate } from '@/lib/dates';
import { CompanyForm } from './CompanyForm';
import { BulkTagDialog, applyTags } from '@/features/shared/BulkTagDialog';

const PAGE = 50;
type Sort = 'name' | 'recent' | 'activity';

export function CompaniesPage() {
  const { companies, contacts, opportunities, leads, ready } = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [q, setQ] = usePersistentState('companies.q', '');
  const [sector, setSector] = usePersistentState('companies.sector', '');
  const [city, setCity] = usePersistentState('companies.city', '');
  const [tag, setTag] = usePersistentState('companies.tag', '');
  const [sort, setSort] = usePersistentState<Sort>('companies.sort', 'name');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<'tags' | 'delete' | 'leads' | null>(null);
  const sel = useSelection();

  const counts = useMemo(() => {
    const m = new Map<string, { contacts: number; opps: number; lead: boolean }>();
    const get = (id: string) => m.get(id) ?? (m.set(id, { contacts: 0, opps: 0, lead: false }), m.get(id)!);
    contacts.forEach((c) => c.companyId && get(c.companyId).contacts++);
    opportunities.forEach((o) => o.companyId && get(o.companyId).opps++);
    leads.forEach((l) => l.companyId && (get(l.companyId).lead = true));
    return m;
  }, [contacts, opportunities, leads]);

  const sectors = useMemo(() => uniqueSorted(companies.map((c) => c.sector)), [companies]);
  const cities = useMemo(() => uniqueSorted(companies.map((c) => c.city)), [companies]);
  const tags = useMemo(() => uniqueSorted(companies.flatMap((c) => c.tags ?? [])), [companies]);

  const filtered = useMemo(() => {
    const list = companies.filter((c) =>
      (!sector || c.sector === sector) && (!city || c.city === city) && (!tag || c.tags?.includes(tag)) &&
      matches(q, [c.name, c.cif, c.email, c.phone, c.city, c.sector, c.website]));
    const time = (x: unknown) => tsToDate(x as never)?.getTime() ?? 0;
    return list.sort((a, b) =>
      sort === 'recent' ? time(b.createdAt) - time(a.createdAt)
        : sort === 'activity' ? time(b.lastActivityAt) - time(a.lastActivityAt)
          : a.name.localeCompare(b.name, 'es'));
  }, [companies, q, sector, city, tag, sort]);

  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE);
  const resetPage = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); sel.clear(); };
  const selectedIds = [...sel.selected];
  const allSelected = filtered.length > 0 && sel.selected.size === filtered.length;

  const applyBulkTags = async (add: string[], remove: string[]) => {
    const byId = new Map(companies.map((c) => [c.id, c]));
    await bulkUpdate(orgId, 'companies', selectedIds.map((id) => ({ id, data: { tags: applyTags(byId.get(id)?.tags, add, remove) } })));
    toast(`Etiquetas aplicadas a ${num(selectedIds.length)} empresas`);
    sel.clear();
  };
  const bulkDelete = async () => {
    await bulkUpdate(orgId, 'companies', selectedIds.map((id) => ({ id, data: { deleted: true } })));
    toast(`${num(selectedIds.length)} empresas eliminadas`);
    sel.clear();
  };
  const bulkLeads = async () => {
    const byId = new Map(companies.map((c) => [c.id, c]));
    const rows = selectedIds.filter((id) => !counts.get(id)?.lead).map((id) => {
      const c = byId.get(id)!;
      return { title: c.name, companyId: c.id, status: 'new', source: c.source ?? 'Empresas', tags: c.tags ?? [] };
    });
    await bulkCreate(orgId, 'leads', uid, rows);
    toast(`${num(rows.length)} leads creados`);
    sel.clear();
  };

  if (!ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Empresas" subtitle={`${num(companies.length)} empresas`}
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva empresa</button>} />

      <div className="toolbar">
        <SearchInput value={q} onChange={resetPage(setQ)} placeholder="Buscar por nombre, CIF, email, teléfono…" />
        <FilterSelect label="Sector" value={sector} onChange={resetPage(setSector)} options={sectors.map((s) => ({ value: s, label: s }))} />
        <FilterSelect label="Ciudad" value={city} onChange={resetPage(setCity)} options={cities.map((s) => ({ value: s, label: s }))} />
        <FilterSelect label="Etiqueta" value={tag} onChange={resetPage(setTag)} options={tags.map((s) => ({ value: s, label: s }))} />
        <select className="filter-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ordenar">
          <option value="name">Orden: nombre</option>
          <option value="recent">Orden: más recientes</option>
          <option value="activity">Orden: última actividad</option>
        </select>
      </div>

      {sel.selected.size > 0 && (
        <div className="bulkbar">
          <strong>{num(sel.selected.size)} seleccionadas</strong>
          <button className="btn btn--secondary btn--sm" onClick={() => setDialog('leads')}><Sparkles size={14} /> Crear leads</button>
          <button className="btn btn--secondary btn--sm" onClick={() => setDialog('tags')}><Tags size={14} /> Etiquetas</button>
          <button className="btn btn--secondary btn--sm danger" onClick={() => setDialog('delete')}><Trash2 size={14} /> Eliminar</button>
          <button className="btn btn--ghost btn--sm" onClick={sel.clear}>Cancelar</button>
        </div>
      )}

      <div className="card card--flush">
        {filtered.length === 0 ? (
          <EmptyState icon={Building2} title={companies.length ? 'Sin resultados' : 'Aún no hay empresas'}>
            {companies.length ? 'Prueba con otros filtros.' : 'Crea tu primera empresa o impórtalas desde Excel.'}
          </EmptyState>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th className="col-check"><input type="checkbox" checked={allSelected} onChange={(e) => sel.setAll(filtered.map((c) => c.id), e.target.checked)}
                  title={`Seleccionar las ${filtered.length} filtradas`} /></th>
                <th>Empresa</th><th>Sector</th><th>Ciudad</th><th>Teléfono</th><th>Email</th><th>Etiquetas</th>
                <th className="num">Cont.</th><th className="num">Opor.</th><th>Últ. actividad</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => {
                const n = counts.get(c.id);
                return (
                  <tr key={c.id} className={sel.selected.has(c.id) ? 'selected' : ''}>
                    <td className="col-check"><input type="checkbox" checked={sel.selected.has(c.id)} onChange={() => sel.toggle(c.id)} /></td>
                    <td><Link to={`/empresas/${c.id}`} className="strong-link">{c.name}</Link></td>
                    <td className="muted truncate">{c.sector}</td>
                    <td className="muted">{c.city}</td>
                    <td className="nowrap">{c.phone && <a href={`tel:${c.phone}`}>{c.phone}</a>}</td>
                    <td className="truncate">{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</td>
                    <td><TagList tags={c.tags} max={2} /></td>
                    <td className="num">{n?.contacts || ''}</td>
                    <td className="num">{n?.opps || ''}</td>
                    <td className="muted nowrap">{c.lastActivityAt ? relativeDay(c.lastActivityAt) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
      </div>

      {creating && <CompanyForm onClose={() => setCreating(false)} />}
      {dialog === 'tags' && <BulkTagDialog count={sel.selected.size} onApply={applyBulkTags} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog title="Eliminar empresas" danger confirmLabel="Eliminar" onConfirm={bulkDelete} onClose={() => setDialog(null)}>
          Se eliminarán {num(sel.selected.size)} empresas. Sus contactos, oportunidades y actividades se conservan.
        </ConfirmDialog>
      )}
      {dialog === 'leads' && (
        <ConfirmDialog title="Crear leads" confirmLabel="Crear leads" onConfirm={bulkLeads} onClose={() => setDialog(null)}>
          Se creará un lead "Nuevo" por cada empresa seleccionada que aún no tenga lead
          ({num(selectedIds.filter((id) => !counts.get(id)?.lead).length)} de {num(selectedIds.length)}).
        </ConfirmDialog>
      )}
    </>
  );
}
