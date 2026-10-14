import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Globe, Mail, MapPin, Phone, Plus, Trash2, Users, KanbanSquare, History, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TagList } from '@/components/ui/TagList';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { deleteItem, createItem } from '@/services/repository';
import { EmailStatusEditor } from './EmailStatusCell';
import { buildAgenda } from '@/domain/agenda';
import { asUrl, fullName } from '@/lib/text';
import { formatDate } from '@/lib/dates';
import { LEAD_STATUS } from '@/domain/labels';
import { Badge } from '@/components/ui/Badges';
import { Timeline } from '@/features/activities/Timeline';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { ContactForm } from '@/features/contacts/ContactForm';
import { OpportunityForm } from '@/features/opportunities/OpportunityForm';
import { CustomFieldsView } from '@/features/customFields/CustomFieldsEditor';
import { CompanyForm } from './CompanyForm';
import { DetailHeader, EditButton, NextStepsCard, OpportunityList } from '@/features/shared/DetailParts';
import type { Lead } from '@/types/models';

export function CompanyDetailPage() {
  const { id = '' } = useParams();
  const data = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'contact' | 'opp' | 'activity' | 'call' | null>(null);
  const company = data.companyById.get(id);

  const related = useMemo(() => ({
    contacts: data.contacts.filter((c) => c.companyId === id),
    opps: data.opportunities.filter((o) => o.companyId === id),
    leads: data.leads.filter((l) => l.companyId === id),
    activities: data.activities.filter((a) => a.companyId === id),
    agenda: buildAgenda(data).filter((i) =>
      (i.kind === 'opportunity' && data.opportunityById.get(i.id)?.companyId === id) ||
      (i.kind === 'lead' && data.leadById.get(i.id)?.companyId === id) ||
      (i.kind === 'activity' && i.activity?.companyId === id)),
  }), [data, id]);

  if (!data.ready) return <FullScreenLoader />;
  if (!company) return <div className="card"><h2>Empresa no encontrada</h2><Link to="/empresas">Volver a empresas</Link></div>;

  const remove = async () => {
    await deleteItem(orgId, 'companies', company.id);
    toast('Empresa eliminada');
    navigate('/empresas');
  };
  const createLead = async () => {
    const leadId = await createItem<Lead>(orgId, 'leads', uid, {
      title: company.name, companyId: company.id, status: 'new', source: company.source ?? 'Empresas', tags: company.tags ?? [],
    });
    toast('Lead creado');
    navigate(`/leads/${leadId}`);
  };

  return (
    <div className="detail">
      <DetailHeader
        avatar={<Building2 size={22} />}
        title={company.name}
        subtitle={[company.sector, company.subsector, company.city].filter(Boolean).join(' · ')}
        actions={<>
          <button className="btn btn--primary" onClick={() => setDialog('call')}><Phone size={15} /> Registrar llamada</button>
          <button className="btn btn--secondary" onClick={() => setDialog('activity')}><Plus size={15} /> Actividad</button>
          <EditButton onClick={() => setDialog('edit')} />
          <button className="icon-btn" title="Eliminar" onClick={() => setDialog('delete')}><Trash2 size={16} /></button>
        </>}
      >
        <TagList tags={company.tags} />
      </DetailHeader>

      <div className="detail-grid">
        <div className="detail-side">
          <Card title="Datos">
            <dl className="kv kv--compact">
              <dt>CIF</dt><dd>{company.cif || '—'}</dd>
              <dt><Phone size={13} /> Teléfono</dt><dd>{company.phone ? <a href={`tel:${company.phone}`}>{company.phone}</a> : '—'}</dd>
              <dt><Mail size={13} /> Email</dt><dd>{company.email ? <a href={`mailto:${company.email}`}>{company.email}</a> : '—'}</dd>
              <dt><Globe size={13} /> Web</dt><dd>{company.website ? <a href={asUrl(company.website)} target="_blank" rel="noreferrer">{company.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : '—'}</dd>
              <dt><MapPin size={13} /> Dirección</dt><dd>{[company.address, company.province].filter(Boolean).join(', ') || company.city || '—'}</dd>
              {company.rating != null && <><dt>Valoración</dt><dd>★ {company.rating}</dd></>}
              {company.source && <><dt>Origen</dt><dd>{company.source}</dd></>}
              <dt>Estado email</dt><dd><EmailStatusEditor company={company} /></dd>
              {!!company.campaignIds?.length && <><dt>Campañas</dt><dd>{company.campaignIds.map((id) => data.campaigns.find((c) => c.id === id)?.name).filter(Boolean).join(', ')}</dd></>}
              <CustomFieldsView entity="company" value={company.custom} />
              <dt>Alta</dt><dd>{formatDate(company.createdAt)}</dd>
            </dl>
            {company.notes && <p className="notes">{company.notes}</p>}
          </Card>

          <Card title="Contactos" icon={Users} subtitle={String(related.contacts.length)}
            actions={<button className="btn btn--ghost btn--sm" onClick={() => setDialog('contact')}><Plus size={14} /> Añadir</button>}>
            {related.contacts.length === 0 ? <p className="muted small">Sin contactos.</p> : (
              <ul className="mini-list">
                {related.contacts.map((c) => (
                  <li key={c.id}>
                    <Link to={`/contactos/${c.id}`} className="strong-link">{fullName(c)}</Link>
                    <span className="muted small">{c.jobTitle}</span>
                    <span className="mini-list__end small">{c.phone || c.mobile || c.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="detail-main">
          <NextStepsCard items={related.agenda} />

          <Card title="Oportunidades" icon={KanbanSquare} subtitle={String(related.opps.length)}
            actions={<button className="btn btn--ghost btn--sm" onClick={() => setDialog('opp')}><Plus size={14} /> Nueva</button>}>
            <OpportunityList items={related.opps} />
            {related.leads.length > 0 ? (
              <ul className="mini-list">
                {related.leads.map((l) => (
                  <li key={l.id}><Sparkles size={14} className="muted" /><Link to={`/leads/${l.id}`}>Lead: {l.title}</Link>
                    <Badge color={LEAD_STATUS[l.status].color}>{LEAD_STATUS[l.status].label}</Badge></li>
                ))}
              </ul>
            ) : <button className="btn btn--ghost btn--sm" style={{ alignSelf: 'flex-start' }} onClick={createLead}><Sparkles size={14} /> Crear lead</button>}
          </Card>

          <Card title="Actividad" icon={History}>
            <Timeline activities={related.activities} showLinks={false} />
          </Card>
        </div>
      </div>

      {dialog === 'edit' && <CompanyForm company={company} onClose={() => setDialog(null)} />}
      {dialog === 'contact' && <ContactForm defaults={{ companyId: company.id }} onClose={() => setDialog(null)} stay />}
      {dialog === 'opp' && <OpportunityForm defaults={{ companyId: company.id }} onClose={() => setDialog(null)} />}
      {dialog === 'activity' && <ActivityDialog defaults={{ companyId: company.id }} onClose={() => setDialog(null)} />}
      {dialog === 'call' && <ActivityDialog defaults={{ type: 'call', title: `Llamada a ${company.name}`, companyId: company.id, leadId: related.leads.find((l) => l.status !== 'converted' && l.status !== 'disqualified')?.id ?? null, opportunityId: related.opps.length === 1 ? related.opps[0].id : null }} onClose={() => setDialog(null)} />}
      {dialog === 'delete' && (
        <ConfirmDialog title="Eliminar empresa" danger confirmLabel="Eliminar" onConfirm={remove} onClose={() => setDialog(null)}>
          ¿Eliminar <strong>{company.name}</strong>? Sus contactos, oportunidades y actividades se conservan sin empresa asociada.
        </ConfirmDialog>
      )}
    </div>
  );
}
