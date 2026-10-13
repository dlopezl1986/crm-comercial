import { addDoc, Timestamp } from 'firebase/firestore';
import { orgCol } from '@/services/paths';
import { bulkCreate, bulkUpdate, newRef, stamp } from '@/services/repository';
import { digits, norm } from '@/lib/text';
import type { DataState } from '@/data/DataProvider';
import type { PlannedCompany } from './importEngine';

export interface ImportOptions {
  fileName: string;
  source: string;
  extraTags: string[];
  /** Crear lead "Nuevo" por empresa nueva. */
  createLeads: boolean;
  /** Crear lead también para empresas ya existentes que no tengan un lead activo (solicitudes entrantes). */
  leadsForExisting?: boolean;
  /** Próximo paso de los leads creados (p. ej. "Llamar al cliente" hoy). */
  leadNextStep?: string;
}
export interface ImportResult {
  companiesCreated: number; companiesMerged: number; contactsCreated: number; leadsCreated: number; notesCreated: number;
  skippedAlreadyImported: number; batch: string;
}

/** Escribe el plan de importación en Firestore (por lotes) y registra la importación para poder deshacerla. */
export async function executeImport(
  orgId: string, uid: string, plan: PlannedCompany[], d: DataState, opts: ImportOptions,
  onProgress: (msg: string) => void,
): Promise<ImportResult> {
  const batch = `imp_${Date.now().toString(36)}`;
  const now = Timestamp.now();

  // Respuestas ya importadas antes (por su ID externo): no se repiten.
  const imported = new Set(d.activities.map((a) => (a as { externalId?: string }).externalId).filter(Boolean));
  let skippedAlreadyImported = 0;
  const active = plan.map((p) => {
    const rows = p.rows.filter((r) => !(r.externalId && imported.has(r.externalId)));
    skippedAlreadyImported += p.rows.length - rows.length;
    return { ...p, rows };
  }).filter((p) => p.rows.length > 0);

  const companyIdFor = new Map<PlannedCompany, string>();
  const toCreate = active.filter((p) => !p.existing || p.action === 'create');
  const toMerge = active.filter((p) => p.existing && p.action === 'merge');
  const ignored = new Set(active.filter((p) => p.existing && p.action === 'ignore'));

  // 1. Empresas nuevas
  const newCompanies = toCreate.map((p) => {
    const id = newRef(orgId, 'companies').id;
    companyIdFor.set(p, id);
    return { id, ...p.data, name: p.data.name!, tags: [...new Set([...p.tags, ...opts.extraTags])], source: opts.source, importBatch: batch };
  });
  await bulkCreate(orgId, 'companies', uid, newCompanies, (n) => onProgress(`Empresas creadas: ${n} / ${newCompanies.length}`));

  // 2. Fusiones: solo se rellenan campos vacíos y se suman etiquetas (nunca se sobrescribe).
  const merges = toMerge.map((p) => {
    const ex = p.existing!;
    companyIdFor.set(p, ex.id);
    const data: Record<string, unknown> = { tags: [...new Set([...(ex.tags ?? []), ...p.tags, ...opts.extraTags])] };
    for (const [k, v] of Object.entries(p.data)) if (v != null && v !== '' && !(ex as unknown as Record<string, unknown>)[k]) data[k] = v;
    return { id: ex.id, data };
  });
  await bulkUpdate(orgId, 'companies', merges, (n) => onProgress(`Empresas fusionadas: ${n} / ${merges.length}`));

  // 3. Contactos: si ya existe uno con el mismo email/teléfono se reutiliza (no se duplica).
  const contactByEmail = new Map(d.contacts.filter((c) => c.email).map((c) => [norm(c.email), c.id]));
  const contactByPhone = new Map(d.contacts.flatMap((c) => [digits(c.phone), digits(c.mobile)].filter((x) => x.length >= 6).map((x) => [x, c.id] as const)));
  const contacts: Record<string, unknown>[] = [];
  const contactIdFor = new Map<PlannedCompany, string>();
  const rowContact = new Map<object, string>();
  for (const p of active) {
    if (ignored.has(p)) continue;
    for (const r of p.rows) {
      if (!r.contact.firstName) continue;
      const e = norm(r.contact.email), ph = digits(r.contact.phone || r.contact.mobile);
      let id = (e && contactByEmail.get(e)) || (ph.length >= 6 && contactByPhone.get(ph)) || '';
      if (!id) {
        id = newRef(orgId, 'contacts').id;
        contacts.push({ id, ...r.contact, companyId: companyIdFor.get(p) ?? null, tags: opts.extraTags, importBatch: batch });
        if (e) contactByEmail.set(e, id);
        if (ph.length >= 6) contactByPhone.set(ph, id);
      }
      rowContact.set(r, id);
      if (!contactIdFor.has(p)) contactIdFor.set(p, id);
    }
  }
  await bulkCreate(orgId, 'contacts', uid, contacts, (n) => onProgress(`Contactos creados: ${n} / ${contacts.length}`));

  // 4. Leads (empresas nuevas y, si se pide, existentes sin lead activo)
  const activeLead = new Map(d.leads.filter((l) => l.companyId && l.status !== 'converted' && l.status !== 'disqualified').map((l) => [l.companyId!, l.id]));
  const leadIdFor = new Map<PlannedCompany, string>();
  const leads: Record<string, unknown>[] = [];
  if (opts.createLeads) {
    for (const p of active) {
      if (ignored.has(p)) continue;
      const companyId = companyIdFor.get(p)!;
      const isNew = toCreate.includes(p);
      if (!isNew && (!opts.leadsForExisting || activeLead.has(companyId))) { if (activeLead.has(companyId)) leadIdFor.set(p, activeLead.get(companyId)!); continue; }
      const id = newRef(orgId, 'leads').id;
      leadIdFor.set(p, id);
      leads.push({
        id, title: p.data.name, companyId, contactId: contactIdFor.get(p) ?? null, status: 'new', source: opts.source,
        tags: [...new Set([...p.tags, ...opts.extraTags])], importBatch: batch,
        ...(opts.leadNextStep ? { nextStep: opts.leadNextStep, nextStepAt: now } : {}),
      });
    }
  }
  await bulkCreate(orgId, 'leads', uid, leads, (n) => onProgress(`Leads creados: ${n} / ${leads.length}`));

  // 5. Mensajes como notas en el historial
  const notes: Record<string, unknown>[] = [];
  for (const p of active) {
    if (ignored.has(p)) continue;
    for (const r of p.rows) {
      if (!r.message && !r.externalId) continue;
      notes.push({
        type: 'note', title: `Solicitud recibida (${opts.source})`, description: r.message ?? '', dueAt: now, completedAt: now, status: 'done',
        companyId: companyIdFor.get(p) ?? null, contactId: rowContact.get(r) ?? null, leadId: leadIdFor.get(p) ?? null, opportunityId: null,
        externalId: r.externalId ?? null, importBatch: batch,
      });
    }
  }
  await bulkCreate(orgId, 'activities', uid, notes, (n) => onProgress(`Notas creadas: ${n} / ${notes.length}`));

  const result = {
    companiesCreated: newCompanies.length, companiesMerged: merges.length, contactsCreated: contacts.length,
    leadsCreated: leads.length, notesCreated: notes.length, skippedAlreadyImported, batch,
  };
  await addDoc(orgCol(orgId, 'imports'), { fileName: opts.fileName, ...result, ...stamp(uid), updatedAt: Timestamp.now() });
  return result;
}
