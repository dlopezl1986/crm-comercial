/**
 * Operaciones de negocio que tocan varios documentos a la vez (en un único batch atómico).
 * Las pantallas llaman a estas funciones en lugar de escribir en Firestore directamente.
 */
import { arrayUnion, doc, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { fb } from '@/lib/firebase';
import { orgCol } from './paths';
import { stamp } from './repository';
import { settle } from './commit';
import { STAGE_META } from '@/domain/labels';
import { weighted } from '@/lib/format';
import type { Activity, CallResult, Lead, LeadStatus, LossReason, Opportunity, OpportunityStage } from '@/types/models';

type Ctx = { orgId: string; uid: string };

function cleanForWrite(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
}

/** Marca "última actividad" en las entidades relacionadas con una actividad. */
function touchRelated(batch: ReturnType<typeof writeBatch>, orgId: string, a: Partial<Activity>) {
  const now = Timestamp.now();
  if (a.companyId) batch.update(doc(orgCol(orgId, 'companies'), a.companyId), { lastActivityAt: now, updatedAt: now });
  if (a.contactId) batch.update(doc(orgCol(orgId, 'contacts'), a.contactId), { lastActivityAt: now, updatedAt: now });
  if (a.opportunityId) batch.update(doc(orgCol(orgId, 'opportunities'), a.opportunityId), { lastActivityAt: now, updatedAt: now });
  if (a.leadId) batch.update(doc(orgCol(orgId, 'leads'), a.leadId), { lastActivityAt: now, updatedAt: now });
}

export type ActivityInput = Omit<Activity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerId'>;

/** Crea una actividad. Si está hecha, actualiza la última actividad de lo relacionado. */
export async function saveActivity({ orgId, uid }: Ctx, data: ActivityInput, id?: string) {
  const batch = writeBatch(fb().db);
  const ref = id ? doc(orgCol(orgId, 'activities'), id) : doc(orgCol(orgId, 'activities'));
  const payload = cleanForWrite({
    ...data,
    completedAt: data.status === 'done' ? (data.completedAt ?? Timestamp.now()) : null,
  });
  if (id) batch.update(ref, { ...payload, updatedAt: Timestamp.now() });
  else batch.set(ref, { ...payload, ...stamp(uid) });
  if (data.status === 'done') touchRelated(batch, orgId, data);
  await settle(batch.commit());
  return ref.id;
}

export async function setActivityStatus({ orgId }: Ctx, a: Activity, status: Activity['status']) {
  const batch = writeBatch(fb().db);
  batch.update(doc(orgCol(orgId, 'activities'), a.id), {
    status, completedAt: status === 'done' ? serverTimestamp() : null, updatedAt: Timestamp.now(),
  });
  if (status === 'done') touchRelated(batch, orgId, a);
  await settle(batch.commit());
}

/** Próximo paso de una oportunidad o lead. */
export async function setNextStep(
  { orgId }: Ctx, col: 'opportunities' | 'leads', id: string, nextStep: string | null, nextStepAt: Timestamp | null,
) {
  const batch = writeBatch(fb().db);
  batch.update(doc(orgCol(orgId, col), id), { nextStep: nextStep || null, nextStepAt, updatedAt: Timestamp.now() });
  await settle(batch.commit());
}

export interface StageExtra { lossReason?: LossReason; lossNotes?: string }

/** Cambio de etapa: guarda historial, fecha de cierre, motivo de pérdida y probabilidad por defecto. */
export async function changeStage({ orgId }: Ctx, opp: Opportunity, to: OpportunityStage, extra: StageExtra = {}) {
  if (opp.stage === to) return;
  const now = Timestamp.now();
  const closing = to === 'won' || to === 'lost' || to === 'not_interested';
  // Si la probabilidad era la típica de la etapa anterior (no personalizada), pasa a la típica de la nueva.
  const custom = opp.probability != null && opp.probability !== STAGE_META[opp.stage].probability;
  const probability = to === 'won' ? 100 : to === 'lost' || to === 'not_interested' ? 0 : custom ? opp.probability! : STAGE_META[to].probability;
  const batch = writeBatch(fb().db);
  batch.update(doc(orgCol(orgId, 'opportunities'), opp.id), cleanForWrite({
    stage: to,
    stageChangedAt: now,
    stageHistory: arrayUnion({ from: opp.stage, to, at: now }),
    probability,
    weightedValue: weighted(opp.value, probability),
    closedAt: closing ? now : null,
    lossReason: to === 'lost' ? extra.lossReason ?? 'other' : null,
    lossNotes: to === 'lost' ? extra.lossNotes ?? '' : null,
    // Una oportunidad cerrada ya no tiene próximo paso pendiente.
    ...(closing ? { nextStep: null, nextStepAt: null } : {}),
    lastActivityAt: now,
    updatedAt: Timestamp.now(),
  }));
  await settle(batch.commit());
}

export type OpportunityInput = Omit<Opportunity, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerId'>;

export async function saveOpportunity({ orgId, uid }: Ctx, data: OpportunityInput, existing?: Opportunity) {
  const ref = existing ? doc(orgCol(orgId, 'opportunities'), existing.id) : doc(orgCol(orgId, 'opportunities'));
  const payload = cleanForWrite({ ...data, weightedValue: weighted(data.value, data.probability) });
  const batch = writeBatch(fb().db);
  if (existing) {
    // El cambio de etapa desde el formulario pasa por la misma lógica que el kanban.
    const { stage: _s, ...rest } = payload as Record<string, unknown>;
    void _s;
    batch.update(ref, { ...rest, updatedAt: Timestamp.now() });
    await settle(batch.commit());
    if (data.stage !== existing.stage) {
      await changeStage({ orgId, uid }, { ...existing, ...(data as Opportunity) , stage: existing.stage }, data.stage, {
        lossReason: data.lossReason ?? undefined, lossNotes: data.lossNotes,
      });
    }
  } else {
    const now = Timestamp.now();
    batch.set(ref, {
      ...payload, stageChangedAt: now, stageHistory: [{ from: null, to: data.stage, at: now }],
      lastActivityAt: now, ...stamp(uid),
    });
    await settle(batch.commit());
  }
  return ref.id;
}

/** Convierte un lead en oportunidad (crea la oportunidad y marca el lead como convertido). */
export async function convertLead({ orgId, uid }: Ctx, lead: Lead, opp: OpportunityInput) {
  const batch = writeBatch(fb().db);
  const oppRef = doc(orgCol(orgId, 'opportunities'));
  const now = Timestamp.now();
  batch.set(oppRef, {
    ...cleanForWrite({ ...opp, weightedValue: weighted(opp.value, opp.probability), leadId: lead.id }),
    stageChangedAt: now, stageHistory: [{ from: null, to: opp.stage, at: now }], lastActivityAt: now,
    ...stamp(uid),
  });
  batch.update(doc(orgCol(orgId, 'leads'), lead.id), {
    status: 'converted', convertedOpportunityId: oppRef.id, convertedAt: now,
    nextStep: null, nextStepAt: null, updatedAt: Timestamp.now(),
  });
  // Las actividades del lead pasan a verse también en la oportunidad.
  await settle(batch.commit());
  return oppRef.id;
}

const LEAD_ORDER: LeadStatus[] = ['new', 'attempting', 'contacted', 'qualified'];

/** Tras una llamada a un lead, avanza su estado según el resultado (nunca lo hace retroceder). */
export async function advanceLeadAfterCall({ orgId }: Ctx, lead: Lead | undefined, result: CallResult | null) {
  if (!lead || !LEAD_ORDER.includes(lead.status)) return;
  const target: LeadStatus | null =
    result === 'interested' || result === 'wants_meeting' || result === 'wants_quote' ? 'qualified'
      : result === 'decision_maker' || result === 'call_later' || result === 'not_interested' ? 'contacted'
        : 'attempting';
  if (LEAD_ORDER.indexOf(target) <= LEAD_ORDER.indexOf(lead.status)) return;
  const batch = writeBatch(fb().db);
  batch.update(doc(orgCol(orgId, 'leads'), lead.id), { status: target, updatedAt: Timestamp.now() });
  await settle(batch.commit());
}
