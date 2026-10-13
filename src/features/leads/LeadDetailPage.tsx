import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRightCircle, Ban, Building2, CalendarClock, CheckCircle2, History, Phone, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TagList } from '@/components/ui/TagList';
import { Badge, WhenBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { deleteItem, updateItem } from '@/services/repository';
import { convertLead, setNextStep } from '@/services/crm';
import { LEAD_STATUS } from '@/domain/labels';
import { guessType } from '@/domain/labels';
import { formatDate, formatDateTime, whenOf } from '@/lib/dates';
import { asUrl, fullName } from '@/lib/text';
import { Timeline } from '@/features/activities/Timeline';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { NextStepDialog } from '@/features/shared/NextStepDialog';
import { OpportunityForm } from '@/features/opportunities/OpportunityForm';
import { CustomFieldsView } from '@/features/customFields/CustomFieldsEditor';
import { DetailHeader, EditButton } from '@/features/shared/DetailParts';
import type { Lead, LeadStatus } from '@/types/models';
import { LeadForm } from './LeadForm';

export function LeadDetailPage() {
  const { id = '' } = useParams();
  const d = useData();
  const ctx = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'call' | 'activity' | 'next' | 'done' | 'convert' | 'disqualify' | null>(null);
  const lead = d.leadById.get(id);
  const activities = useMemo(() => d.activities.filter((a) => a.leadId === id), [d.activities, id]);

  if (!d.ready) return <FullScreenLoader />;
  if (!lead) return <div className="card"><h2>Lead no encontrado</h2><Link to="/leads">Volver a leads</Link></div>;
  const co = lead.companyId ? d.companyById.get(lead.companyId) : undefined;
  const ct = lead.contactId ? d.contactById.get(lead.contactId) : undefined;
  const active = lead.status !== 'converted' && lead.status !== 'disqualified';
  const tel = ct?.phone || ct?.mobile || co?.phone;

  const setStatus = async (status: LeadStatus, extra: Partial<Lead> = {}) => {
    await updateItem<Lead>(ctx.orgId, 'leads', lead.id, { status, ...extra });
    toast(`Estado: ${LEAD_STATUS[status].label}`);
  };
  const remove = async () => { await deleteItem(ctx.orgId, 'leads', lead.id); toast('Lead eliminado'); navigate('/leads'); };

  return (
    <div className="detail">
      <DetailHeader avatar={<Sparkles size={22} />} title={lead.title}
        subtitle={<>{co && <Link to={`/empresas/${co.id}`}>{co.name}</Link>}{ct && <> · <Link to={`/contactos/${ct.id}`}>{fullName(ct)}</Link></>}</>}
        actions={<>
          {active && <button className="btn btn--primary" onClick={() => setDialog('call')}><Phone size={15} /> Registrar llamada</button>}
          {active && <button className="btn btn--success" onClick={() => setDialog('convert')}><ArrowRightCircle size={15} /> Convertir en oportunidad</button>}
          <EditButton onClick={() => setDialog('edit')} />
          <button className="icon-btn" title="Eliminar" onClick={() => setDialog('delete')}><Trash2 size={16} /></button>
        </>}>
        <div className="inline"><Badge color={LEAD_STATUS[lead.status].color}>{LEAD_STATUS[lead.status].label}</Badge><TagList tags={lead.tags} /></div>
      </DetailHeader>

      {active && (
        <div className="status-row">
          {(['new', 'attempting', 'contacted', 'qualified'] as LeadStatus[]).map((s) => (
            <button key={s} className={`chip ${lead.status === s ? 'chip--on' : ''}`} onClick={() => setStatus(s)}>{LEAD_STATUS[s].label}</button>
          ))}
          <button className="chip chip--danger" onClick={() => setDialog('disqualify')}><Ban size={13} /> Descartar</button>
        </div>
      )}
      {lead.status === 'converted' && lead.convertedOpportunityId && (
        <div className="alert alert--ok">Convertido el {formatDate(lead.convertedAt)} → <Link to={`/oportunidades/${lead.convertedOpportunityId}`}>ver oportunidad</Link></div>
      )}
      {lead.status === 'disqualified' && (
        <div className="alert alert--error">Descartado{lead.disqualifyReason ? `: ${lead.disqualifyReason}` : ''}. <button className="link-btn" onClick={() => setStatus('new', { disqualifyReason: undefined })}>Reactivar</button></div>
      )}

      <div className="detail-grid">
        <div className="detail-main">
          {active && (
            <section className={`next-hero ${!lead.nextStep ? 'next-hero--missing' : ''}`}>
              <CalendarClock size={22} />
              <div className="next-hero__main">
                <div className="next-hero__label">Próximo paso</div>
                {lead.nextStep
                  ? <div className="next-hero__step">{lead.nextStep} <WhenBadge when={whenOf(lead.nextStepAt)} /><span className="muted small">{formatDateTime(lead.nextStepAt)}</span></div>
                  : <div className="next-hero__step">Sin próximo paso definido</div>}
              </div>
              {lead.nextStep && <button className="btn btn--primary" onClick={() => setDialog('done')}><CheckCircle2 size={15} /> Hecho</button>}
              <button className="btn btn--secondary" onClick={() => setDialog('next')}>{lead.nextStep ? 'Cambiar' : 'Definir'}</button>
            </section>
          )}
          <Card title="Actividad" icon={History} actions={<button className="btn btn--ghost btn--sm" onClick={() => setDialog('activity')}><Plus size={14} /> Actividad</button>}>
            <Timeline activities={activities} showLinks={false} />
          </Card>
        </div>
        <div className="detail-side">
          <Card title="Empresa" icon={Building2}>
            {co ? (
              <dl className="kv kv--compact">
                <dt>Empresa</dt><dd><Link to={`/empresas/${co.id}`}>{co.name}</Link></dd>
                <dt>Teléfono</dt><dd>{tel ? <a href={`tel:${tel}`}>{tel}</a> : '—'}</dd>
                <dt>Email</dt><dd>{(ct?.email || co.email) ? <a href={`mailto:${ct?.email || co.email}`}>{ct?.email || co.email}</a> : '—'}</dd>
                <dt>Web</dt><dd>{co.website ? <a href={asUrl(co.website)} target="_blank" rel="noreferrer">{co.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a> : '—'}</dd>
                <dt>Sector</dt><dd>{co.sector || '—'}</dd>
                <dt>Subsector</dt><dd>{co.subsector || '—'}</dd>
                <dt>Ciudad</dt><dd>{co.city || '—'}</dd>
              </dl>
            ) : <p className="muted small">Sin empresa asociada.</p>}
          </Card>
          <Card title="Detalles">
            <dl className="kv kv--compact">
              <dt>Fuente</dt><dd>{lead.source || '—'}</dd>
              <dt>Creado</dt><dd>{formatDate(lead.createdAt)}</dd>
              <CustomFieldsView entity="lead" value={lead.custom} />
            </dl>
            {lead.notes && <p className="notes">{lead.notes}</p>}
          </Card>
        </div>
      </div>

      {dialog === 'edit' && <LeadForm lead={lead} onClose={() => setDialog(null)} />}
      {dialog === 'call' && <ActivityDialog defaults={{ type: 'call', title: `Llamada a ${lead.title}`, leadId: lead.id, companyId: lead.companyId ?? null, contactId: lead.contactId ?? null, completes: lead.nextStep ? { col: 'leads', id: lead.id } : undefined }} onClose={() => setDialog(null)} />}
      {dialog === 'activity' && <ActivityDialog defaults={{ leadId: lead.id, companyId: lead.companyId ?? null, contactId: lead.contactId ?? null }} onClose={() => setDialog(null)} />}
      {dialog === 'done' && <ActivityDialog defaults={{ type: guessType(lead.nextStep), title: lead.nextStep, leadId: lead.id, companyId: lead.companyId ?? null, contactId: lead.contactId ?? null, status: 'done', completes: { col: 'leads', id: lead.id } }} onClose={() => setDialog(null)} />}
      {dialog === 'next' && <NextStepDialog initialStep={lead.nextStep} initialAt={lead.nextStepAt}
        onSave={async (s, at) => { await setNextStep(ctx, 'leads', lead.id, s, at); toast('Próximo paso guardado'); }} onClose={() => setDialog(null)} />}
      {dialog === 'convert' && <OpportunityForm title="Convertir lead en oportunidad"
        defaults={{ name: `DocuWare · ${lead.title}`, companyId: lead.companyId ?? null, contactId: lead.contactId ?? null, stage: 'interested', leadId: lead.id }}
        onSubmit={(data) => convertLead(ctx, lead, data)} onClose={() => setDialog(null)} />}
      {dialog === 'disqualify' && <DisqualifyDialog onClose={() => setDialog(null)} onConfirm={(reason) => setStatus('disqualified', { disqualifyReason: reason, nextStep: undefined, nextStepAt: null })} />}
      {dialog === 'delete' && <ConfirmDialog title="Eliminar lead" danger confirmLabel="Eliminar" onConfirm={remove} onClose={() => setDialog(null)}>
        ¿Eliminar el lead <strong>{lead.title}</strong>? La empresa y las actividades se conservan.</ConfirmDialog>}
    </div>
  );
}

const DISQUALIFY = ['No interesado', 'Ya tiene proveedor', 'No es público objetivo', 'Datos incorrectos', 'No responde', 'Otro'];

function DisqualifyDialog({ onConfirm, onClose }: { onConfirm: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  return (
    <ConfirmDialog title="Descartar lead" danger confirmLabel="Descartar" onClose={onClose} onConfirm={() => onConfirm(reason)}>
      <div className="chips" style={{ marginTop: 4 }}>
        {DISQUALIFY.map((r) => <button key={r} type="button" className={`chip ${reason === r ? 'chip--on' : ''}`} onClick={() => setReason(r)}>{r}</button>)}
      </div>
    </ConfirmDialog>
  );
}
