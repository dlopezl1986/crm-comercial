import { useMemo } from 'react';
import { useData } from '@/data/DataProvider';
import { fullName } from '@/lib/text';
import { EntityPicker } from './EntityPicker';

interface P { value: string | null | undefined; onChange: (id: string | null) => void; disabled?: boolean }

export function CompanyPicker(p: P) {
  const { companies } = useData();
  const options = useMemo(
    () => companies.map((c) => ({ id: c.id, label: c.name, sub: [c.city, c.sector].filter(Boolean).join(' · ') }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es')),
    [companies],
  );
  return <EntityPicker {...p} options={options} placeholder="Sin empresa" />;
}

/** Contactos; si se indica empresa, muestra primero los de esa empresa. */
export function ContactPicker({ companyId, ...p }: P & { companyId?: string | null }) {
  const { contacts, companyById } = useData();
  const options = useMemo(() => {
    const list = contacts.map((c) => ({
      id: c.id, label: fullName(c), sub: [c.jobTitle, c.companyId ? companyById.get(c.companyId)?.name : ''].filter(Boolean).join(' · '),
      own: !!companyId && c.companyId === companyId,
    }));
    return list.sort((a, b) => Number(b.own) - Number(a.own) || a.label.localeCompare(b.label, 'es'));
  }, [contacts, companyById, companyId]);
  return <EntityPicker {...p} options={options} placeholder="Sin contacto" />;
}

export function OpportunityPicker(p: P) {
  const { opportunities, companyById } = useData();
  const options = useMemo(
    () => opportunities.map((o) => ({ id: o.id, label: o.name, sub: o.companyId ? companyById.get(o.companyId)?.name : '' })),
    [opportunities, companyById],
  );
  return <EntityPicker {...p} options={options} placeholder="Sin oportunidad" />;
}
