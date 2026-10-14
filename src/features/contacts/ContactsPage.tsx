import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/Select';
import { Pagination } from '@/components/ui/Pagination';
import { TagList } from '@/components/ui/TagList';
import { EmptyState } from '@/components/ui/EmptyState';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { CONTACT_PREFERENCE } from '@/domain/labels';
import { fullName, matches, uniqueSorted } from '@/lib/text';
import { num } from '@/lib/format';
import { relativeDay } from '@/lib/dates';
import { ContactForm } from './ContactForm';

const PAGE = 50;

export function ContactsPage() {
  const { contacts, companyById, ready } = useData();
  const [q, setQ] = usePersistentState('contacts.q', '');
  const [company, setCompany] = usePersistentState('contacts.company', '');
  const [tag, setTag] = usePersistentState('contacts.tag', '');
  const [pref, setPref] = usePersistentState('contacts.pref', '');
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);

  const companies = useMemo(() => {
    const ids = new Set(contacts.map((c) => c.companyId).filter(Boolean) as string[]);
    return [...ids].map((id) => ({ value: id, label: companyById.get(id)?.name ?? '' })).filter((o) => o.label)
      .sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }, [contacts, companyById]);
  const tags = useMemo(() => uniqueSorted(contacts.flatMap((c) => c.tags ?? [])), [contacts]);

  const filtered = useMemo(() => contacts
    .filter((c) => (!company || c.companyId === company) && (!tag || c.tags?.includes(tag)) && (!pref || c.preference === pref) &&
      matches(q, [fullName(c), c.email, c.phone, c.mobile, c.jobTitle, c.department, c.companyId ? companyById.get(c.companyId)?.name : '']))
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'es')), [contacts, companyById, q, company, tag, pref]);

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  if (!ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Contactos" subtitle={`${num(contacts.length)} contactos`}
        actions={<button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo contacto</button>} />
      <div className="toolbar">
        <SearchInput value={q} onChange={reset(setQ)} placeholder="Buscar por nombre, email, teléfono, empresa…" />
        <FilterSelect label="Empresa" value={company} onChange={reset(setCompany)} options={companies} />
        <FilterSelect label="Etiqueta" value={tag} onChange={reset(setTag)} options={tags.map((t) => ({ value: t, label: t }))} />
        <FilterSelect label="Preferencia" value={pref} onChange={reset(setPref)}
          options={Object.entries(CONTACT_PREFERENCE).map(([value, label]) => ({ value, label }))} />
      </div>
      <div className="card card--flush">
        {filtered.length === 0 ? (
          <EmptyState icon={Users} title={contacts.length ? 'Sin resultados' : 'Aún no hay contactos'}>
            {contacts.length ? 'Prueba con otros filtros.' : 'Crea tu primer contacto.'}
          </EmptyState>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Nombre</th><th>Cargo</th><th>Empresa</th><th>Teléfono</th><th>Email</th><th>Etiquetas</th><th>Últ. actividad</th></tr></thead>
            <tbody>
              {filtered.slice(page * PAGE, page * PAGE + PAGE).map((c) => {
                const co = c.companyId ? companyById.get(c.companyId) : undefined;
                const tel = c.phone || c.mobile;
                return (
                  <tr key={c.id}>
                    <td><Link to={`/contactos/${c.id}`} className="strong-link">{fullName(c)}</Link></td>
                    <td className="muted">{[c.jobTitle, c.department].filter(Boolean).join(' · ')}</td>
                    <td>{co && <Link to={`/empresas/${co.id}`}>{co.name}</Link>}</td>
                    <td className="nowrap">{tel && <a href={`tel:${tel}`}>{tel}</a>}</td>
                    <td className="truncate">{c.email && <a href={`mailto:${c.email}`}>{c.email}</a>}</td>
                    <td><TagList tags={c.tags} max={2} /></td>
                    <td className="muted nowrap">{c.lastActivityAt ? relativeDay(c.lastActivityAt) : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table></div>
        )}
        <Pagination page={page} pageSize={PAGE} total={filtered.length} onPage={setPage} />
      </div>
      {creating && <ContactForm onClose={() => setCreating(false)} />}
    </>
  );
}
