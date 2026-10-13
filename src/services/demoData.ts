/**
 * Datos de demostración, claramente separados de los reales: todos llevan `isDemo: true`
 * y la etiqueta "Demo", y se eliminan de golpe desde Configuración.
 */
import { Timestamp } from 'firebase/firestore';
import { bulkCreate, bulkUpdate, newRef } from './repository';
import type { DataState } from '@/data/DataProvider';
import type { ActivityType, CallResult, LossReason, OpportunityStage } from '@/types/models';
import { STAGE_META } from '@/domain/labels';

const day = (n: number, h = 10) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return Timestamp.fromDate(d); };

const COMPANIES = [
  ['Logística Mediterránea SL', 'Transporte y logística', 'Barcelona'], ['Clínica Dental Sonrisa', 'Salud', 'Sabadell'],
  ['Universitat Tecnològica', 'Educación', 'Terrassa'], ['Metalúrgica Vallès SA', 'Industria', 'Granollers'],
  ['Asesoría Fiscal Puig', 'Servicios profesionales', 'Barcelona'], ['Hotel Costa Brava', 'Hostelería', 'Girona'],
  ['Farmacéutica Lab Nova', 'Farmacia', 'Sant Cugat del Vallès'], ['Constructora Rius', 'Construcción', 'Mataró'],
  ['Seguros Llevant', 'Seguros', 'Badalona'], ['Distribuciones Ebro', 'Distribución', 'Lleida'],
  ['Ayuntamiento de Vilafranca', 'Administración pública', 'Vilafranca del Penedès'], ['Textil Manresa SL', 'Industria', 'Manresa'],
] as const;
const PEOPLE = [['Laura', 'García', 'Directora financiera'], ['Marc', 'Puig', 'Responsable IT'], ['Núria', 'Soler', 'Gerente'],
  ['Jordi', 'Vidal', 'Director de operaciones'], ['Anna', 'Ferrer', 'Responsable de administración'], ['Pau', 'Roca', 'CEO']];

type OppSeed = [number, OpportunityStage, number | null, number, string | null, number | null, LossReason?];
const OPPS: OppSeed[] = [
  // [empresa, etapa, valor, días desde alta, próximo paso, días hasta próximo paso, motivo pérdida]
  [0, 'proposal', 8500, 20, 'Enviar presupuesto', 0], [1, 'meeting', 4200, 10, 'Hacer demo', 1],
  [2, 'negotiation', 18000, 45, 'Llamar al cliente', -2], [3, 'interested', 6000, 8, 'Concertar reunión', 0],
  [4, 'contacted', null, 5, 'Hacer seguimiento', 3], [5, 'to_contact', 3500, 2, 'Llamar al cliente', 0],
  [6, 'won', 12500, 70, null, null], [7, 'won', 7800, 40, null, null], [8, 'lost', 5000, 60, null, null, 'price'],
  [9, 'lost', 9000, 50, null, null, 'competition'], [10, 'meeting', 22000, 30, null, null], [11, 'new', 2500, 1, 'Enviar email', 5],
  [3, 'postponed', 4000, 90, null, null], [0, 'lost', 3000, 120, null, null, 'has_provider'],
];

export async function loadDemoData(orgId: string, uid: string, serviceIds: string[]) {
  const base = { isDemo: true, tags: ['Demo'] };
  const companyIds = COMPANIES.map(() => newRef(orgId, 'companies').id);
  await bulkCreate(orgId, 'companies', uid, COMPANIES.map(([name, sector, city], i) => ({
    id: companyIds[i], name, sector, city, phone: `93 ${String(400 + i * 37).padStart(3, '0')} ${String(10 + i).padStart(2, '0')} ${String(20 + i * 3).slice(-2)}`,
    email: `info@${name.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '').slice(0, 14)}.es`, ...base, lastActivityAt: day(-(i % 10)),
  })));
  const contactIds = companyIds.map(() => newRef(orgId, 'contacts').id);
  await bulkCreate(orgId, 'contacts', uid, companyIds.map((cid, i) => {
    const [firstName, lastName, jobTitle] = PEOPLE[i % PEOPLE.length];
    return { id: contactIds[i], firstName, lastName, jobTitle, companyId: cid, email: `${firstName.toLowerCase()}@demo.es`, phone: `6${String(10000000 + i * 1234567).slice(0, 8)}`, ...base };
  }));
  await bulkCreate(orgId, 'leads', uid, [8, 9, 10, 11].map((i, k) => ({
    title: COMPANIES[i][0], companyId: companyIds[i], status: (['new', 'attempting', 'contacted', 'qualified'] as const)[k], source: 'Demo',
    nextStep: k < 3 ? 'Llamar al cliente' : 'Concertar reunión', nextStepAt: day(k - 1, 11), ...base,
  })));
  const oppIds = OPPS.map(() => newRef(orgId, 'opportunities').id);
  await bulkCreate(orgId, 'opportunities', uid, OPPS.map(([ci, stage, value, ago, step, inDays, loss], i) => {
    const closed = stage === 'won' || stage === 'lost';
    const probability = STAGE_META[stage].probability;
    return {
      id: oppIds[i], name: `DocuWare · ${COMPANIES[ci][0]}`, companyId: companyIds[ci], contactId: contactIds[ci],
      serviceIds: serviceIds.slice(i % 3, (i % 3) + 2), stage, value, probability, weightedValue: value != null ? Math.round(value * probability / 100) : null,
      expectedCloseAt: closed ? null : day(15 + i * 3), nextStep: step, nextStepAt: inDays != null ? day(inDays, 9 + (i % 6)) : null,
      stageChangedAt: day(-Math.floor(ago / 2)), stageHistory: stage === 'new' ? [{ from: null, to: 'new', at: day(-ago) }] : [{ from: null, to: 'new', at: day(-ago) }, { from: 'new', to: stage, at: day(-Math.floor(ago / 2)) }],
      closedAt: closed ? day(-Math.floor(ago / 3)) : null, lossReason: loss ?? null,
      lastActivityAt: day(i === 10 ? -25 : -(i % 7)), ...base,
    };
  }));
  const acts: Record<string, unknown>[] = [];
  const types: ActivityType[] = ['call', 'email', 'call', 'meeting', 'call', 'demo', 'follow_up', 'call'];
  const results: CallResult[] = ['no_answer', 'decision_maker', 'interested', 'wants_meeting', 'call_later', 'wants_quote'];
  for (let i = 0; i < 40; i++) {
    const t = types[i % types.length];
    const oi = i % OPPS.length;
    const ago = -(i % 45);
    acts.push({
      type: t, title: `${{ call: 'Llamada', email: 'Email', meeting: 'Reunión', demo: 'Demo', follow_up: 'Seguimiento', task: 'Tarea', note: 'Nota' }[t]} · ${COMPANIES[OPPS[oi][0]][0]}`,
      dueAt: day(ago, 9 + (i % 8)), status: 'done', completedAt: day(ago, 9 + (i % 8)), result: t === 'call' ? results[i % results.length] : null,
      companyId: companyIds[OPPS[oi][0]], contactId: contactIds[OPPS[oi][0]], opportunityId: oppIds[oi], ...base,
    });
  }
  [[1, 'meeting', 'Reunión de presentación', 1, 12], [3, 'demo', 'Demo DocuWare Cloud', 2, 10], [4, 'task', 'Preparar propuesta', 0, 16], [0, 'call', 'Llamada de cierre', -1, 11]]
    .forEach(([ci, type, title, inDays, h]) => acts.push({
      type, title, dueAt: day(inDays as number, h as number), status: 'pending', companyId: companyIds[ci as number], contactId: contactIds[ci as number], ...base,
    }));
  await bulkCreate(orgId, 'activities', uid, acts);
}

export function demoCount(d: DataState) {
  return [d.companies, d.contacts, d.leads, d.opportunities, d.activities].reduce((s, xs) => s + xs.filter((x) => x.isDemo).length, 0);
}

/** Elimina (borrado lógico) todos los registros de demostración. */
export async function clearDemoData(orgId: string, d: DataState) {
  const cols = { companies: d.companies, contacts: d.contacts, leads: d.leads, opportunities: d.opportunities, activities: d.activities } as const;
  for (const [name, items] of Object.entries(cols)) {
    const ids = items.filter((x) => x.isDemo).map((x) => ({ id: x.id, data: { deleted: true } }));
    if (ids.length) await bulkUpdate(orgId, name as keyof typeof cols, ids);
  }
}
