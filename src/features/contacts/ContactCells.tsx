import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { fullName } from '@/lib/text';
import { tsToDate } from '@/lib/dates';
import type { Contact } from '@/types/models';
import { ContactForm } from './ContactForm';

/** Contactos de cada empresa, del más antiguo al más reciente. */
export function useContactsByCompany() {
  const { contacts } = useData();
  return useMemo(() => {
    const m = new Map<string, Contact[]>();
    contacts.forEach((c) => c.companyId && m.set(c.companyId, [...(m.get(c.companyId) ?? []), c]));
    m.forEach((xs) => xs.sort((a, b) => (tsToDate(a.createdAt)?.getTime() ?? 0) - (tsToDate(b.createdAt)?.getTime() ?? 0)));
    return m;
  }, [contacts]);
}

/**
 * Dos celdas de tabla: nombre del contacto principal y su teléfono.
 * Principal = el indicado (lead/oportunidad) o, si no hay, el primero de la empresa.
 */
export function ContactCells({ companyId, contactId, byCompany }: {
  companyId?: string | null; contactId?: string | null; byCompany: Map<string, Contact[]>;
}) {
  const { contactById } = useData();
  const [adding, setAdding] = useState(false);
  const list = companyId ? byCompany.get(companyId) ?? [] : [];
  const main = (contactId ? contactById.get(contactId) : undefined) ?? list[0];
  const more = list.filter((c) => c.id !== main?.id).length;
  const tel = main?.phone || main?.mobile;
  return (
    <>
      <td className="nowrap">
        {main ? (
          <>
            <Link to={`/contactos/${main.id}`}>{fullName(main)}</Link>
            {more > 0 && <span className="muted small"> +{more}</span>}
            {main.jobTitle && <div className="muted small truncate">{main.jobTitle}</div>}
          </>
        ) : companyId ? (
          <button className="link-btn small" onClick={() => setAdding(true)}><Plus size={12} /> Añadir</button>
        ) : <span className="muted">—</span>}
        {adding && companyId && <ContactForm defaults={{ companyId }} stay onClose={() => setAdding(false)} />}
      </td>
      <td className="nowrap">{tel ? <a href={`tel:${tel}`}>{tel}</a> : <span className="muted">—</span>}</td>
    </>
  );
}
