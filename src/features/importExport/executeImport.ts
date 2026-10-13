import { addDoc, Timestamp } from 'firebase/firestore';
import { orgCol } from '@/services/paths';
import { bulkCreate, bulkUpdate, newRef, stamp } from '@/services/repository';
import { digits, norm } from '@/lib/text';
import type { Contact } from '@/types/models';
import type { PlannedCompany } from './importEngine';

export interface ImportOptions { fileName: string; source: string; extraTags: string[]; createLeads: boolean }
export interface ImportResult { companiesCreated: number; companiesMerged: number; contactsCreated: number; leadsCreated: number; batch: string }

/** Escribe el plan de importación en Firestore (por lotes) y registra la importación para poder deshacerla. */
export async function executeImport(
  orgId: string, uid: string, plan: PlannedCompany[], existingContacts: Contact[], opts: ImportOptions,
  onProgress: (msg: string) => void,
): Promise<ImportResult> {
  const batch = `imp_${Date.now().toString(36)}`;
  const companyIdFor = new Map<PlannedCompany, string>();
  const toCreate = plan.filter((p) => !p.existing || p.action === 'create');
  const toMerge = plan.filter((p) => p.existing && p.action === 'merge');

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

  // 3. Contactos (se omiten los que ya existen con el mismo email o teléfono)
  const seenEmail = new Set(existingContacts.map((c) => norm(c.email)).filter(Boolean));
  const seenPhone = new Set(existingContacts.flatMap((c) => [digits(c.phone), digits(c.mobile)]).filter((p) => p.length >= 6));
  const contacts: Record<string, unknown>[] = [];
  for (const p of plan) {
    if (p.existing && p.action === 'ignore') continue;
    for (const r of p.rows) {
      if (!r.contact.firstName) continue;
      const e = norm(r.contact.email), ph = digits(r.contact.phone || r.contact.mobile);
      if ((e && seenEmail.has(e)) || (ph.length >= 6 && seenPhone.has(ph))) continue;
      if (e) seenEmail.add(e);
      if (ph.length >= 6) seenPhone.add(ph);
      contacts.push({ ...r.contact, companyId: companyIdFor.get(p) ?? null, tags: opts.extraTags, importBatch: batch });
    }
  }
  await bulkCreate(orgId, 'contacts', uid, contacts, (n) => onProgress(`Contactos creados: ${n} / ${contacts.length}`));

  // 4. Leads opcionales, uno por empresa nueva
  const leads = opts.createLeads ? newCompanies.map((c) => ({
    title: c.name, companyId: c.id, status: 'new', source: opts.source, tags: c.tags, importBatch: batch,
  })) : [];
  await bulkCreate(orgId, 'leads', uid, leads, (n) => onProgress(`Leads creados: ${n} / ${leads.length}`));

  const result = { companiesCreated: newCompanies.length, companiesMerged: merges.length, contactsCreated: contacts.length, leadsCreated: leads.length, batch };
  await addDoc(orgCol(orgId, 'imports'), { fileName: opts.fileName, ...result, ...stamp(uid), updatedAt: Timestamp.now() });
  return result;
}
