import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Mail, Pencil, Phone, User } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useData } from '@/data/DataProvider';
import { CompanyForm } from '@/features/companies/CompanyForm';
import { ContactForm } from '@/features/contacts/ContactForm';
import { EmailStatusEditor } from '@/features/companies/EmailStatusCell';
import { effectiveSector } from '@/domain/sectors';
import { asUrl, fullName } from '@/lib/text';

/** Datos de la empresa con botón para editarlos (fichas de lead y oportunidad). */
export function CompanyInfoCard({ companyId }: { companyId?: string | null }) {
  const { companyById } = useData();
  const [editing, setEditing] = useState(false);
  const co = companyId ? companyById.get(companyId) : undefined;
  const sec = co ? effectiveSector(co) : undefined;
  return (
    <Card title="Empresa" icon={Building2} actions={co && <button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Editar empresa</button>}>
      {co ? (
        <dl className="kv kv--compact">
          <dt>Empresa</dt><dd><Link to={`/empresas/${co.id}`}>{co.name}</Link></dd>
          <dt><Mail size={13} /> Email</dt><dd>{co.email ? <a href={`mailto:${co.email}`}>{co.email}</a> : '—'}</dd>
          {co.email && <><dt>Estado email</dt><dd><EmailStatusEditor company={co} compact /></dd></>}
          <dt><Phone size={13} /> Teléfono</dt><dd>{co.phone ? <a href={`tel:${co.phone}`}>{co.phone}</a> : '—'}</dd>
          <dt>Web</dt><dd>{co.website ? <a href={asUrl(co.website)} target="_blank" rel="noreferrer">{co.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : '—'}</dd>
          <dt>Sector</dt><dd>{[sec?.sector, sec?.subsector].filter(Boolean).join(' · ') || '—'}</dd>
          <dt>Ciudad</dt><dd>{co.city || '—'}</dd>
        </dl>
      ) : <p className="muted small">Sin empresa asociada.</p>}
      {editing && co && <CompanyForm company={co} onClose={() => setEditing(false)} />}
    </Card>
  );
}

/** Datos del contacto con botón para editarlos. */
export function ContactInfoCard({ contactId }: { contactId?: string | null }) {
  const { contactById } = useData();
  const [editing, setEditing] = useState(false);
  const ct = contactId ? contactById.get(contactId) : undefined;
  if (!ct) return null;
  return (
    <Card title="Contacto" icon={User} actions={<button className="btn btn--ghost btn--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Editar contacto</button>}>
      <dl className="kv kv--compact">
        <dt>Nombre</dt><dd><Link to={`/contactos/${ct.id}`}>{fullName(ct)}</Link></dd>
        <dt>Cargo</dt><dd>{ct.jobTitle || '—'}</dd>
        <dt><Mail size={13} /> Email</dt><dd>{ct.email ? <a href={`mailto:${ct.email}`}>{ct.email}</a> : '—'}</dd>
        <dt><Phone size={13} /> Teléfono</dt><dd>{(ct.phone || ct.mobile) ? <a href={`tel:${ct.phone || ct.mobile}`}>{ct.phone || ct.mobile}</a> : '—'}</dd>
      </dl>
      {editing && <ContactForm contact={ct} onClose={() => setEditing(false)} />}
    </Card>
  );
}
