/**
 * Procesado de correos recibidos (rebotes, bajas, respuestas automáticas y respuestas reales)
 * a partir del Excel que genera el flujo "Registrar respuestas" o de texto pegado.
 */
import { Timestamp } from 'firebase/firestore';
import { bulkCreate, bulkUpdate } from '@/services/repository';
import { norm } from '@/lib/text';
import type { DataState } from '@/data/DataProvider';
import type { Company, EmailStatus } from '@/types/models';

import { classify, domainOf, emailsIn, GENERIC, mailKey, MAIL_KIND, type MailKind, type MailRow } from './mailClassify';
export { MAIL_KIND, type MailKind, type MailRow } from './mailClassify';

export interface MailMatch { key: string; kind: MailKind; row: MailRow; company?: Company; matchedEmail?: string; by?: 'email' | 'dominio' }

/** Empareja cada correo con la(s) empresa(s) a las que afecta. */
export function matchMails(d: DataState, rows: MailRow[], ownEmails: string[]): MailMatch[] {
  const byEmail = new Map<string, Company>();
  const byDomain = new Map<string, Company[]>();
  d.companies.forEach((c) => {
    const e = norm(c.email).trim();
    if (!e) return;
    byEmail.set(e, c);
    const dom = domainOf(e);
    if (dom && !GENERIC.has(dom)) byDomain.set(dom, [...(byDomain.get(dom) ?? []), c]);
  });
  const own = new Set(ownEmails.map((e) => e.toLowerCase()));
  const out: MailMatch[] = [];
  for (const row of rows) {
    const kind = classify(row);
    const key = mailKey(row);
    if (kind === 'bounce') {
      // En un rebote, las direcciones fallidas aparecen en el texto del aviso.
      const found = emailsIn(`${row.subject} ${row.text}`).filter((e) => !own.has(e) && byEmail.has(e));
      if (!found.length) out.push({ key, kind, row });
      found.forEach((e, i) => out.push({ key: `${key}#${i}`, kind, row, company: byEmail.get(e), matchedEmail: e, by: 'email' }));
      continue;
    }
    const from = emailsIn(row.from)[0];
    let company = from ? byEmail.get(from) : undefined;
    let by: MailMatch['by'] = company ? 'email' : undefined;
    if (!company && from) {
      const same = byDomain.get(domainOf(from)) ?? [];
      if (same.length === 1) { company = same[0]; by = 'dominio'; }
      else if (same.length > 1) { company = same.find((c) => c.campaignIds?.length) ?? same[0]; by = 'dominio'; }
    }
    out.push({ key, kind, row, company, matchedEmail: from, by });
  }
  return out;
}

/** Prioridad de estados: un estado "más informativo" no se pisa con uno menor. */
const RANK: Record<string, number> = { none: 0, sent: 1, delivered: 2, error: 3, replied: 4, bounced: 5, optout: 6 };

export async function applyMails(orgId: string, uid: string, d: DataState, matches: MailMatch[]) {
  const done = new Set(d.activities.map((a) => (a as { externalId?: string }).externalId).filter(Boolean));
  const fresh = matches.filter((m) => m.company && !done.has(m.key));
  const now = Timestamp.now();
  const updates = new Map<string, { status: EmailStatus; note?: string }>();
  for (const m of fresh) {
    const target = MAIL_KIND[m.kind].status;
    const current = updates.get(m.company!.id)?.status ?? m.company!.emailStatus ?? 'none';
    // Un rebote/baja siempre se aplica; el resto solo si mejora el estado actual.
    if (m.kind === 'bounce' || m.kind === 'optout' || RANK[target] >= RANK[current]) {
      updates.set(m.company!.id, { status: target, note: m.kind === 'bounce' ? 'Rebote: dirección inexistente o errónea' : undefined });
    }
  }
  await bulkUpdate(orgId, 'companies', [...updates].map(([id, u]) => ({
    id, data: {
      emailStatus: u.status, emailStatusAt: now, emailOptOut: u.status === 'optout', ...(u.status === 'optout' ? { emailOptOutAt: now } : {}),
      ...(u.note ? { emailNote: u.note } : {}), ...(u.status === 'replied' ? { lastActivityAt: now } : {}),
    },
  })));
  const leadByCompany = new Map(d.leads.filter((l) => l.companyId && l.status !== 'converted').map((l) => [l.companyId!, l.id]));
  await bulkCreate(orgId, 'activities', uid, fresh.map((m) => ({
    type: 'email', status: 'done', dueAt: now, completedAt: now,
    title: `${MAIL_KIND[m.kind].label}${m.row.subject ? ` · ${m.row.subject}` : ''}`.slice(0, 180),
    description: [m.row.from && `De: ${m.row.from}`, m.row.date && `Fecha: ${m.row.date}`, (m.row.text ?? '').slice(0, 1500)].filter(Boolean).join('\n'),
    companyId: m.company!.id, leadId: leadByCompany.get(m.company!.id) ?? null, contactId: null, opportunityId: null, externalId: m.key,
  })));
  return { companies: updates.size, skipped: matches.filter((m) => m.company && done.has(m.key)).length, unmatched: matches.filter((m) => !m.company).length };
}

/** Lee el Excel/CSV del flujo (columnas Fecha, De, Asunto, Texto; admite variantes). */
export async function readMailFile(file: File): Promise<MailRow[]> {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '', raw: false });
  const pick = (r: Record<string, unknown>, names: string[]) => {
    const k = Object.keys(r).find((h) => names.includes(norm(h).replace(/[^a-z]/g, '')));
    return k ? String(r[k] ?? '') : '';
  };
  return rows.map((r) => ({
    date: pick(r, ['fecha', 'date', 'recibido', 'hora']),
    from: pick(r, ['de', 'from', 'remitente']),
    subject: pick(r, ['asunto', 'subject']),
    text: pick(r, ['texto', 'cuerpo', 'body', 'mensaje', 'text', 'preview']),
  })).filter((r) => r.from || r.subject || r.text);
}
