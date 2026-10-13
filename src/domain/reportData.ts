import { addDays, startOfDay, tsToDate } from '@/lib/dates';
import type { DataState } from '@/data/DataProvider';
import type { OpportunityStage } from '@/types/models';
import { LOSS_REASONS, isOpenStage } from './labels';
import type { Kpis } from './stats';

/** Agrupación de etapas para gráficos circulares (≤ 7 categorías). */
const STAGE_GROUPS: { name: string; stages: OpportunityStage[] }[] = [
  { name: 'Nuevas', stages: ['new', 'to_contact'] },
  { name: 'Contactadas', stages: ['contacted', 'no_response', 'postponed'] },
  { name: 'Interesadas', stages: ['interested'] },
  { name: 'Reunión / Demo', stages: ['meeting'] },
  { name: 'Propuesta / Negociación', stages: ['proposal', 'negotiation'] },
  { name: 'Ganadas', stages: ['won'] },
  { name: 'Perdidas', stages: ['lost', 'not_interested'] },
];

export function stageDistribution(d: DataState) {
  return STAGE_GROUPS.map((g) => ({ name: g.name, value: d.opportunities.filter((o) => g.stages.includes(o.stage)).length }));
}

export function lossReasons(d: DataState) {
  const counts = new Map<string, number>();
  d.opportunities.filter((o) => o.stage === 'lost').forEach((o) => {
    const k = LOSS_REASONS[o.lossReason ?? 'other'];
    counts.set(k, (counts.get(k) ?? 0) + 1);
  });
  return [...counts].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

const monthKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
function lastMonths(n: number) {
  const now = new Date();
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1));
}
const monthLabel = (d: Date) => d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '') + (d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : '');

/** Ventas (valor ganado) por mes de cierre, últimos `n` meses. */
export function salesByMonth(d: DataState, n = 12) {
  const months = lastMonths(n);
  const sums = new Map(months.map((m) => [monthKey(m), 0]));
  d.opportunities.filter((o) => o.stage === 'won').forEach((o) => {
    const c = tsToDate(o.closedAt);
    if (c && sums.has(monthKey(c))) sums.set(monthKey(c), sums.get(monthKey(c))! + (o.value ?? 0));
  });
  return months.map((m) => ({ name: monthLabel(m), value: sums.get(monthKey(m)) ?? 0 }));
}

/** Evolución mensual: oportunidades creadas, ganadas y perdidas. */
export function pipelineFlow(d: DataState, n = 6) {
  const months = lastMonths(n);
  const rows = months.map((m) => ({ name: monthLabel(m), key: monthKey(m), creadas: 0, ganadas: 0, perdidas: 0 }));
  const idx = new Map(rows.map((r, i) => [r.key, i]));
  d.opportunities.forEach((o) => {
    const c = tsToDate(o.createdAt);
    if (c && idx.has(monthKey(c))) rows[idx.get(monthKey(c))!].creadas++;
    const cl = tsToDate(o.closedAt);
    if (cl && idx.has(monthKey(cl))) {
      if (o.stage === 'won') rows[idx.get(monthKey(cl))!].ganadas++;
      if (o.stage === 'lost' || o.stage === 'not_interested') rows[idx.get(monthKey(cl))!].perdidas++;
    }
  });
  return rows.map(({ key: _k, ...r }) => r);
}

/** Valor del pipeline abierto al final de cada mes (reconstruido con fechas de alta y cierre). */
export function pipelineValueEvolution(d: DataState, n = 6) {
  return lastMonths(n).map((m) => {
    const end = new Date(m.getFullYear(), m.getMonth() + 1, 1).getTime();
    const value = d.opportunities.reduce((s, o) => {
      const c = tsToDate(o.createdAt)?.getTime() ?? 0;
      const cl = tsToDate(o.closedAt)?.getTime();
      // Abierta a fin de mes: creada antes y (sin cerrar todavía, o cerrada después).
      const openAtEnd = c < end && (cl == null ? isOpenStage(o.stage) : cl >= end);
      return openAtEnd ? s + (o.value ?? 0) : s;
    }, 0);
    return { name: monthLabel(m), pipeline: value };
  });
}

/** Actividades hechas por semana (llamadas, emails, reuniones+demos), últimas `n` semanas. */
export function activityByWeek(d: DataState, n = 8) {
  const today = startOfDay(new Date());
  const monday = addDays(today, -((today.getDay() + 6) % 7));
  const weeks = Array.from({ length: n }, (_, i) => addDays(monday, -7 * (n - 1 - i)));
  const rows = weeks.map((w) => ({ name: w.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', ''), llamadas: 0, emails: 0, reuniones: 0 }));
  d.activities.filter((a) => a.status === 'done').forEach((a) => {
    const t = tsToDate(a.completedAt ?? a.dueAt);
    if (!t) return;
    const i = Math.floor((startOfDay(t).getTime() - weeks[0].getTime()) / (7 * 86400000));
    if (i < 0 || i >= n) return;
    if (a.type === 'call') rows[i].llamadas++;
    else if (a.type === 'email') rows[i].emails++;
    else if (a.type === 'meeting' || a.type === 'demo') rows[i].reuniones++;
  });
  return rows;
}

/** Embudo de conversión. */
export function funnel(k: Kpis) {
  return [
    { name: 'Leads', value: k.leads },
    { name: 'Contactados', value: k.contacted },
    { name: 'Reuniones', value: k.meetings },
    { name: 'Propuestas', value: k.proposals },
    { name: 'Ganados', value: k.won },
  ];
}
