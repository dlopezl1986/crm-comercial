import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { History, KanbanSquare, Link2, Mail, Phone, Plus, Smartphone, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TagList } from '@/components/ui/TagList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { deleteItem } from '@/services/repository';
import { buildAgenda } from '@/domain/agenda';
import { CONTACT_PREFERENCE } from '@/domain/labels';
import { asUrl, fullName, initials } from '@/lib/text';
import { formatDate } from '@/lib/dates';
import { Timeline } from '@/features/activities/Timeline';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { OpportunityForm } from '@/features/opportunities/OpportunityForm';
import { CustomFieldsView } from '@/features/customFields/CustomFieldsEditor';
import { DetailHeader, EditButton, NextStepsCard, OpportunityList } from '@/features/shared/DetailParts';
import { ContactForm } from './ContactForm';

export function ContactDetailPage() {
  const { id = '' } = useParams();
  const data = useData();
  const { orgId } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'activity' | 'call' | 'opp' | null>(null);
  const contact = data.contactById.get(id);

  const related = useMemo(() => ({
    opps: data.opportunities.filter((o) => o.contactId === id),
    activities: data.activities.filter((a) => a.contactId === id),
    agenda: buildAgenda(data).filter((i) =>
      (i.kind === 'opportunity' && data.opportunityById.get(i.id)?.contactId === id) ||
      (i.kind === 'lead' && data.leadById.get(i.id)?.contactId === id) ||
      (i.kind === 'activity' && i.activity?.contactId === id)),
  }), [data, id]);

  if (!data.ready) return <FullScreenLoader />;
  if (!contact) return <div className="card"><h2>Contacto no encontrado</h2><Link to="/contactos">Volver a contactos</Link></div>;
  const company = contact.companyId ? data.companyById.get(contact.companyId) : undefined;
  const name = fullName(contact);

  const remove = async () => {
    await deleteItem(orgId, 'contacts', contact.id);
    toast('Contacto eliminado');
    navigate('/contactos');
  };

  return (
    <div className="detail">
      <DetailHeader
        avatar={<span className="avatar avatar--lg">{initials(name)}</span>}
        title={name}
        subtitle={<>{[contact.jobTitle, contact.department].filter(Boolean).join(' · ')}{company && <> · <Link to={`/empresas/${company.id}`}>{company.name}</Link></>}</>}
        actions={<>
          <button className="btn btn--primary" onClick={() => setDialog('call')}><Phone size={15} /> Registrar llamada</button>
          <button className="btn btn--secondary" onClick={() => setDialog('activity')}><Plus size={15} /> Actividad</button>
          <EditButton onClick={() => setDialog('edit')} />
          <button className="icon-btn" title="Eliminar" onClick={() => setDialog('delete')}><Trash2 size={16} /></button>
        </>}
      ><TagList tags={contact.tags} /></DetailHeader>

      <div className="detail-grid">
        <div className="detail-side">
          <Card title="Datos">
            <dl className="kv kv--compact">
              <dt><Mail size={13} /> Email</dt><dd>{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : '—'}</dd>
              <dt><Phone size={13} /> Teléfono</dt><dd>{contact.phone ? <a href={`tel:${contact.phone}`}>{contact.phone}</a> : '—'}</dd>
              <dt><Smartphone size={13} /> Móvil</dt><dd>{contact.mobile ? <a href={`tel:${contact.mobile}`}>{contact.mobile}</a> : '—'}</dd>
              <dt><Link2 size={13} /> LinkedIn</dt><dd>{contact.linkedin ? <a href={asUrl(contact.linkedin)} target="_blank" rel="noreferrer">Ver perfil</a> : '—'}</dd>
              <dt>Preferencia</dt><dd>{contact.preference ? CONTACT_PREFERENCE[contact.preference] : '—'}</dd>
              <CustomFieldsView entity="contact" value={contact.custom} />
              <dt>Alta</dt><dd>{formatDate(contact.createdAt)}</dd>
            </dl>
            {contact.notes && <p className="notes">{contact.notes}</p>}
          </Card>
        </div>
        <div className="detail-main">
          <NextStepsCard items={related.agenda} />
          <Card title="Oportunidades" icon={KanbanSquare} subtitle={String(related.opps.length)}
            actions={<button className="btn btn--ghost btn--sm" onClick={() => setDialog('opp')}><Plus size={14} /> Nueva</button>}>
            <OpportunityList items={related.opps} />
          </Card>
          <Card title="Actividad" icon={History}><Timeline activities={related.activities} /></Card>
        </div>
      </div>

      {dialog === 'edit' && <ContactForm contact={contact} onClose={() => setDialog(null)} />}
      {dialog === 'opp' && <OpportunityForm defaults={{ companyId: contact.companyId ?? null, contactId: contact.id }} onClose={() => setDialog(null)} />}
      {dialog === 'activity' && <ActivityDialog defaults={{ contactId: contact.id, companyId: contact.companyId ?? null }} onClose={() => setDialog(null)} />}
      {dialog === 'call' && <ActivityDialog defaults={{ type: 'call', title: `Llamada a ${name}`, contactId: contact.id, companyId: contact.companyId ?? null, opportunityId: related.opps.length === 1 ? related.opps[0].id : null }} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog title="Eliminar contacto" danger confirmLabel="Eliminar" onConfirm={remove} onClose={() => setDialog(null)}>
          ¿Eliminar a <strong>{name}</strong>? Sus actividades y oportunidades se conservan.
        </ConfirmDialog>
      )}
    </div>
  );
}
