import type { Timestamp } from 'firebase/firestore';
import { daysBetween, tsToDate, whenOf, type When } from '@/lib/dates';
import { fullName } from '@/lib/text';
import type { DataState } from '@/data/DataProvider';
import type { Activity, ActivityType, Opportunity } from '@/types/models';
import { isOpenStage } from './labels';

/** Un elemento de "qué tengo que hacer": próximo paso de oportunidad/lead o actividad pendiente. */
export interface AgendaItem {
  key: string;
  kind: 'opportunity' | 'lead' | 'activity';
  id: string;
  title: string;
  subtitle: string;
  at: Date;
  when: When;
  link: string;
  activityType?: ActivityType;
  activity?: Activity;
  opportunity?: Opportunity;
}

function subtitleFor(d: DataState, companyId?: string | null, contactId?: string | null) {
  const company = companyId ? d.companyById.get(companyId)?.name : undefined;
  const contact = contactId ? d.contactById.get(contactId) : undefined;
  return [company, contact ? fullName(contact) : undefined].filter(Boolean).join(' · ');
}

/** Todos los próximos pasos y actividades pendientes con fecha, ordenados por fecha. */
export function buildAgenda(d: DataState, now = new Date()): AgendaItem[] {
  const items: AgendaItem[] = [];
  for (const o of d.opportunities) {
    if (!isOpenStage(o.stage) || !o.nextStep || !o.nextStepAt) continue;
    const at = tsToDate(o.nextStepAt)!;
    items.push({
      key: `o-${o.id}`, kind: 'opportunity', id: o.id, title: o.nextStep,
      subtitle: [o.name, subtitleFor(d, o.companyId, o.contactId)].filter(Boolean).join(' · '),
      at, when: whenOf(at, now)!, link: `/oportunidades/${o.id}`, opportunity: o,
    });
  }
  for (const l of d.leads) {
    if (l.status === 'converted' || l.status === 'disqualified' || !l.nextStep || !l.nextStepAt) continue;
    const at = tsToDate(l.nextStepAt)!;
    items.push({
      key: `l-${l.id}`, kind: 'lead', id: l.id, title: l.nextStep,
      subtitle: [l.title, subtitleFor(d, l.companyId, l.contactId)].filter(Boolean).join(' · '),
      at, when: whenOf(at, now)!, link: `/leads/${l.id}`,
    });
  }
  for (const a of d.activities) {
    if (a.status !== 'pending') continue;
    const at = tsToDate(a.dueAt)!;
    const opp = a.opportunityId ? d.opportunityById.get(a.opportunityId) : undefined;
    items.push({
      key: `a-${a.id}`, kind: 'activity', id: a.id, title: a.title,
      subtitle: [opp?.name, subtitleFor(d, a.companyId, a.contactId)].filter(Boolean).join(' · '),
      at, when: whenOf(at, now)!, link: opp ? `/oportunidades/${opp.id}` : a.companyId ? `/empresas/${a.companyId}` : '/actividades',
      activityType: a.type, activity: a,
    });
  }
  return items.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Oportunidades abiertas sin actividad desde hace más de `staleDays` días. */
export function staleOpportunities(d: DataState, staleDays: number, now = new Date()) {
  return d.opportunities
    .filter((o) => isOpenStage(o.stage))
    .map((o) => {
      const last = tsToDate((o.lastActivityAt ?? o.updatedAt ?? o.createdAt) as Timestamp);
      return { opp: o, days: last ? daysBetween(last, now) : 0 };
    })
    .filter((x) => x.days > staleDays)
    .sort((a, b) => b.days - a.days);
}

/** Oportunidades abiertas sin próximo paso definido. */
export function withoutNextStep(d: DataState) {
  return d.opportunities.filter((o) => isOpenStage(o.stage) && !o.nextStep);
}
