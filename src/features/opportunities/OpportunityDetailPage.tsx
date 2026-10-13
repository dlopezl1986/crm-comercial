import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, CheckCircle2, History, KanbanSquare, Phone, Plus, Trash2, Trophy, XCircle, GitCommitHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { TagList } from '@/components/ui/TagList';
import { StageBadge, WhenBadge } from '@/components/ui/Badges';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { deleteItem } from '@/services/repository';
import { changeStage, setNextStep } from '@/services/crm';
import { LOSS_REASONS, STAGE_META, guessType, isOpenStage } from '@/domain/labels';
import { PIPELINE_STAGES, type OpportunityStage } from '@/types/models';
import { daysBetween, formatDate, formatDateTime, relativeDay, tsToDate, whenOf } from '@/lib/dates';
import { money } from '@/lib/format';
import { fullName } from '@/lib/text';
import { Timeline } from '@/features/activities/Timeline';
import { ActivityDialog } from '@/features/activities/ActivityDialog';
import { NextStepDialog } from '@/features/shared/NextStepDialog';
import { CustomFieldsView } from '@/features/customFields/CustomFieldsEditor';
import { DetailHeader, EditButton } from '@/features/shared/DetailParts';
import { OpportunityForm } from './OpportunityForm';
import { LossDialog } from './LossDialog';

export function OpportunityDetailPage() {
  const { id = '' } = useParams();
  const data = useData();
  const ctx = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'activity' | 'call' | 'next' | 'lost' | 'done' | null>(null);
  const o = data.opportunityById.get(id);

  const activities = useMemo(
    () => data.activities.filter((a) => a.opportunityId === id || (o?.leadId && a.leadId === o.leadId)),
    [data.activities, id, o?.leadId],
  );

  if (!data.ready) return <FullScreenLoader />;
  if (!o) return <div className="card"><h2>Oportunidad no encontrada</h2><Link to="/oportunidades">Volver</Link></div>;

  const company = o.companyId ? data.companyById.get(o.companyId) : undefined;
  const contact = o.contactId ? data.contactById.get(o.contactId) : undefined;
  const open = isOpenStage(o.stage);
  const last = tsToDate(o.lastActivityAt ?? o.updatedAt);
  const idle = last ? daysBetween(last, new Date()) : 0;
  const stale = open && idle > ctx.org.settings.staleDays;
  const stageIdx = PIPELINE_STAGES.indexOf(o.stage as never);

  const move = async (to: OpportunityStage) => {
    if (to === 'lost') { setDialog('lost'); return; }
    await changeStage(ctx, o, to);
    toast(`Estado: ${STAGE_META[to].label}`);
  };
  const remove = async () => { await deleteItem(ctx.orgId, 'opportunities', o.id); toast('Oportunidad eliminada'); navigate('/oportunidades'); };

  return (
    <div className="detail">
      <DetailHeader
        avatar={<KanbanSquare size={22} />}
        title={o.name}
        subtitle={<>
          {company && <Link to={`/empresas/${company.id}`}>{company.name}</Link>}
          {contact && <> · <Link to={`/contactos/${contact.id}`}>{fullName(contact)}</Link></>}
        </>}
        actions={<>
          {open && <button className="btn btn--success" onClick={() => move('won')}><Trophy size={15} /> Ganada</button>}
          {open && <button className="btn btn--secondary" onClick={() => setDialog('lost')}><XCircle size={15} /> Perdida</button>}
          <EditButton onClick={() => setDialog('edit')} />
          <button className="icon-btn" title="Eliminar" onClick={() => setDialog('delete')}><Trash2 size={16} /></button>
        </>}
      >
        <div className="inline"><StageBadge stage={o.stage} /><TagList tags={o.tags} /></div>
      </DetailHeader>

      <div className="stepper">
        {PIPELINE_STAGES.map((s, i) => (
          <button key={s} className={`stepper__step ${i < stageIdx ? 'done' : ''} ${s === o.stage ? 'current' : ''}`}
            style={{ '--c': STAGE_META[s].color } as React.CSSProperties} onClick={() => move(s)} title={`Mover a ${STAGE_META[s].label}`}>
            {STAGE_META[s].label}
          </button>
        ))}
      </div>

      {stale && <div className="alert alert--warn">Lleva {idle} días sin actividad (umbral: {ctx.org.settings.staleDays} días).</div>}
      {o.stage === 'lost' && <div className="alert alert--error">Perdida{o.lossReason ? ` · Motivo: ${LOSS_REASONS[o.lossReason]}` : ''}{o.lossNotes ? ` — ${o.lossNotes}` : ''}</div>}

      <div className="kpis kpis--4">
        <div className="kpi"><div className="kpi__label">Valor</div><div className="kpi__value">{money(o.value)}</div></div>
        <div className="kpi"><div className="kpi__label">Probabilidad</div><div className="kpi__value">{o.probability != null ? `${o.probability} %` : '—'}</div></div>
        <div className="kpi"><div className="kpi__label">Valor ponderado</div><div className="kpi__value">{money(o.weightedValue)}</div></div>
        <div className="kpi"><div className="kpi__label">Cierre previsto</div><div className="kpi__value kpi__value--sm">{o.expectedCloseAt ? formatDate(o.expectedCloseAt) : '—'}</div></div>
      </div>

      <div className="detail-grid">
        <div className="detail-main">
          {open && (
            <section className={`next-hero ${!o.nextStep ? 'next-hero--missing' : ''}`}>
              <CalendarClock size={22} />
              <div className="next-hero__main">
                <div className="next-hero__label">Próximo paso</div>
                {o.nextStep ? (
                  <div className="next-hero__step">{o.nextStep} <WhenBadge when={whenOf(o.nextStepAt)} />
                    <span className="muted small">{formatDateTime(o.nextStepAt)}</span></div>
                ) : <div className="next-hero__step">Sin próximo paso definido</div>}
              </div>
              {o.nextStep && <button className="btn btn--primary" onClick={() => setDialog('done')}><CheckCircle2 size={15} /> Hecho</button>}
              <button className="btn btn--secondary" onClick={() => setDialog('next')}>{o.nextStep ? 'Cambiar' : 'Definir'}</button>
            </section>
          )}

          <Card title="Actividad" icon={History}
            actions={<div className="inline">
              <button className="btn btn--ghost btn--sm" onClick={() => setDialog('call')}><Phone size={14} /> Llamada</button>
              <button className="btn btn--ghost btn--sm" onClick={() => setDialog('activity')}><Plus size={14} /> Actividad</button>
            </div>}>
            <Timeline activities={activities} showLinks={false} />
          </Card>
        </div>

        <div className="detail-side">
          <Card title="Detalles">
            <dl className="kv kv--compact">
              <dt>Servicios</dt><dd>{o.serviceIds?.length ? o.serviceIds.map((s) => data.serviceById.get(s)?.name).filter(Boolean).join(', ') : '—'}</dd>
              <dt>Responsable</dt><dd>Yo</dd>
              <dt>Últ. actividad</dt><dd>{relativeDay(o.lastActivityAt ?? o.updatedAt)}</dd>
              <dt>Creada</dt><dd>{formatDate(o.createdAt)}</dd>
              {o.closedAt && <><dt>Cerrada</dt><dd>{formatDate(o.closedAt)}</dd></>}
              {o.leadId && <><dt>Lead origen</dt><dd><Link to={`/leads/${o.leadId}`}>Ver lead</Link></dd></>}
              <CustomFieldsView entity="opportunity" value={o.custom} />
            </dl>
            {o.notes && <p className="notes">{o.notes}</p>}
          </Card>
          <Card title="Historial" icon={GitCommitHorizontal}>
            <ol className="history">
              {[...(o.stageHistory ?? [])].reverse().map((h, i) => (
                <li key={i}><span className="dot" style={{ background: STAGE_META[h.to].color }} />
                  <span>{h.from ? <>{STAGE_META[h.from].label} → </> : 'Creada en '}<strong>{STAGE_META[h.to].label}</strong></span>
                  <span className="muted small">{formatDateTime(h.at)}</span></li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {dialog === 'edit' && <OpportunityForm opportunity={o} onClose={() => setDialog(null)} />}
      {dialog === 'next' && <NextStepDialog initialStep={o.nextStep} initialAt={o.nextStepAt}
        onSave={async (s, at) => { await setNextStep(ctx, 'opportunities', o.id, s, at); toast('Próximo paso guardado'); }} onClose={() => setDialog(null)} />}
      {dialog === 'done' && <ActivityDialog defaults={{ type: guessType(o.nextStep), title: o.nextStep, opportunityId: o.id, companyId: o.companyId, contactId: o.contactId, status: 'done', completes: { col: 'opportunities', id: o.id } }} onClose={() => setDialog(null)} />}
      {dialog === 'call' && <ActivityDialog defaults={{ type: 'call', title: `Llamada · ${o.name}`, opportunityId: o.id, companyId: o.companyId, contactId: o.contactId }} onClose={() => setDialog(null)} />}
      {dialog === 'activity' && <ActivityDialog defaults={{ opportunityId: o.id, companyId: o.companyId, contactId: o.contactId }} onClose={() => setDialog(null)} />}
      {dialog === 'lost' && <LossDialog name={o.name} onClose={() => setDialog(null)}
        onConfirm={async (reason, notes) => { await changeStage(ctx, o, 'lost', { lossReason: reason, lossNotes: notes }); toast('Marcada como perdida'); }} />}
      {dialog === 'delete' && (
        <ConfirmDialog title="Eliminar oportunidad" danger confirmLabel="Eliminar" onConfirm={remove} onClose={() => setDialog(null)}>
          ¿Eliminar <strong>{o.name}</strong>? Sus actividades se conservan.
        </ConfirmDialog>
      )}
    </div>
  );
}
