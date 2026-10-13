import { tsToDate } from '@/lib/dates';
import type { DataState } from '@/data/DataProvider';
import { isOpenStage } from './labels';

/** KPIs del CRM (dashboard e informes). `from` limita las altas/cierres a partir de esa fecha. */
export function computeKpis(d: DataState, from?: Date) {
  const inRange = (ts: unknown) => !from || ((tsToDate(ts as never)?.getTime() ?? 0) >= from.getTime());
  const opps = d.opportunities;
  const open = opps.filter((o) => isOpenStage(o.stage));
  const won = opps.filter((o) => o.stage === 'won' && inRange(o.closedAt));
  const lost = opps.filter((o) => (o.stage === 'lost' || o.stage === 'not_interested') && inRange(o.closedAt));
  const reached = new Set(['contacted', 'interested', 'meeting', 'proposal', 'negotiation', 'won']);
  const everReached = (stages: string[]) => opps.filter((o) =>
    stages.includes(o.stage) || (o.stageHistory ?? []).some((h) => stages.includes(h.to))).length;
  const closed = won.length + lost.length;
  return {
    leads: d.leads.filter((l) => inRange(l.createdAt)).length,
    activeLeads: d.leads.filter((l) => l.status !== 'converted' && l.status !== 'disqualified').length,
    contacted: everReached([...reached]),
    opportunities: open.length,
    meetings: everReached(['meeting']),
    proposals: everReached(['proposal']),
    won: won.length,
    lost: lost.length,
    pipelineValue: open.reduce((s, o) => s + (o.value ?? 0), 0),
    weightedPipeline: open.reduce((s, o) => s + (o.weightedValue ?? 0), 0),
    wonValue: won.reduce((s, o) => s + (o.value ?? 0), 0),
    conversionRate: closed ? (won.length / closed) * 100 : null,
    leadConversion: d.leads.length ? (d.leads.filter((l) => l.status === 'converted').length / d.leads.length) * 100 : null,
  };
}

export type Kpis = ReturnType<typeof computeKpis>;
