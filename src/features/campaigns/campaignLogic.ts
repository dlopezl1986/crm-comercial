import { Timestamp } from 'firebase/firestore';
import { bulkCreate, bulkUpdate, updateItem } from '@/services/repository';
import { setEmailStatus } from '@/services/emailStatus';
import { norm } from '@/lib/text';
import type { DataState } from '@/data/DataProvider';
import type { Campaign, Company } from '@/types/models';
import { CONTACTED_STATUSES, emailStatusOf, isEmailBlocked } from '@/domain/emailStatus';
import { effectiveSector } from '@/domain/sectors';

const EMAIL_RE = /^[^\s@;,]+@[^\s@;,]+\.[^\s@;,]+$/;
export const validEmail = (e?: string) => !!e && EMAIL_RE.test(e.trim());

/** Empresas del segmento con email válido y sin baja. */
export type Segment = Pick<Campaign, 'segmentTags' | 'segmentSector' | 'segmentSectors' | 'segmentSubsectors' | 'excludeContacted'> & { id?: string };

/** Sectores del segmento (compatibilidad con campañas de un solo sector). */
export const segmentSectorsOf = (c: Segment) => c.segmentSectors?.length ? c.segmentSectors : c.segmentSector ? [c.segmentSector] : [];

/** ¿Ya recibió un email de OTRA campaña (o está marcada como enviada/respondida a mano)? */
export function contactedElsewhere(co: Company, campaignId?: string) {
  if (campaignId && co.campaignIds?.includes(campaignId)) return false;
  return !!co.campaignIds?.length || CONTACTED_STATUSES.includes(emailStatusOf(co));
}

/** Empresas del segmento con email válido, sin baja/rebote y (por defecto) no contactadas por otra campaña. */
export function segment(d: DataState, c: Segment) {
  const sectors = segmentSectorsOf(c);
  const subs = c.segmentSubsectors ?? [];
  const exclude = c.excludeContacted !== false;
  return d.companies.filter((co) => {
    if (!validEmail(co.email) || isEmailBlocked(co)) return false;
    if (c.segmentTags.length && !c.segmentTags.some((t) => co.tags?.includes(t))) return false;
    if (exclude && contactedElsewhere(co, c.id)) return false;
    if (!sectors.length && !subs.length) return true;
    const eff = effectiveSector(co);
    return (!sectors.length || sectors.includes(eff.sector ?? '')) && (!subs.length || subs.includes(eff.subsector ?? ''));
  });
}

/** Descripción corta del segmento. */
export function segmentLabel(c: Segment) {
  const parts = [c.segmentTags.join(', '), segmentSectorsOf(c).join(', '), (c.segmentSubsectors ?? []).join(', ')].filter(Boolean);
  return (parts.join(' · ') || 'Todas las empresas') + (c.excludeContacted !== false ? ' · sin contactadas antes' : '');
}

export interface CampaignStatus {
  eligible: number;
  sent: Company[];
  pending: Company[];
  optOuts: number;
  /** Siguiente lote: sin duplicar emails (cadenas que comparten dirección reciben un único correo). */
  nextBatch: Company[];
}

export function campaignStatus(d: DataState, c: Campaign): CampaignStatus {
  const all = segment(d, c);
  const sent = all.filter((co) => co.campaignIds?.includes(c.id));
  const sentEmails = new Set(sent.map((co) => norm(co.email)));
  const pending = all.filter((co) => !co.campaignIds?.includes(c.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const nextBatch: Company[] = [];
  const batchEmails = new Set<string>();
  for (const co of pending) {
    const e = norm(co.email);
    if (sentEmails.has(e)) continue; // ya recibió este email con otra empresa de la misma dirección
    if (batchEmails.has(e)) { nextBatch.push(co); continue; } // mismo email en el lote: se marcan juntas
    if (batchEmails.size >= c.batchSize) break;
    batchEmails.add(e);
    nextBatch.push(co);
  }
  const optOuts = d.companies.filter((co) => isEmailBlocked(co)).length;
  return { eligible: all.length, sent, pending, optOuts, nextBatch };
}

/** Lista de emails únicos del lote, separados por ";" (para pegar en Power Automate). */
export const batchEmails = (batch: Company[]) => [...new Set(batch.map((co) => co.email!.trim().toLowerCase()))];

/** Marca el lote como enviado: etiqueta la campaña en cada empresa y registra la actividad "email". */
export async function markBatchSent(orgId: string, uid: string, d: DataState, c: Campaign, batch: Company[], onProgress?: (n: number) => void) {
  const now = Timestamp.now();
  // Empresas con el mismo email que ya han recibido esta campaña también cuentan como enviadas.
  const emails = new Set(batch.map((co) => norm(co.email)));
  const affected = segment(d, c).filter((co) => emails.has(norm(co.email)) && !co.campaignIds?.includes(c.id));
  await bulkUpdate(orgId, 'companies', affected.map((co) => ({
    id: co.id, data: {
      campaignIds: [...(co.campaignIds ?? []), c.id], lastActivityAt: now, emailSentAt: now, emailStatusAt: now,
      // No se pisa un estado más informativo (respondido, rebotado…).
      ...(!co.emailStatus || co.emailStatus === 'sent' ? { emailStatus: 'sent' } : {}),
    },
  })), onProgress);
  const leadByCompany = new Map(d.leads.filter((l) => l.companyId && l.status !== 'converted').map((l) => [l.companyId!, l.id]));
  await bulkCreate(orgId, 'activities', uid, affected.map((co) => ({
    type: 'email', title: `Email campaña: ${c.name}`, description: c.subject, dueAt: now, completedAt: now, status: 'done',
    companyId: co.id, leadId: leadByCompany.get(co.id) ?? null, contactId: null, opportunityId: null,
  })));
  await updateItem<Campaign>(orgId, 'campaigns', c.id, { sentCount: c.sentCount + affected.length, lastBatchAt: now });
  return affected.length;
}

/** Marca con un estado (baja, rebotado…) todas las empresas con alguno de estos emails. */
export async function markOptOuts(orgId: string, d: DataState, raw: string, status: 'optout' | 'bounced' = 'optout') {
  const emails = new Set(raw.split(/[\s,;<>()"']+/).map((e) => norm(e)).filter(validEmail));
  const companies = d.companies.filter((co) => emails.has(norm(co.email)) && co.emailStatus !== status && !(status === 'optout' && co.emailOptOut));
  await setEmailStatus(orgId, companies.map((co) => co.id), status);
  const found = new Set([...d.companies, ...d.contacts].map((x) => norm(x.email)).filter((e) => emails.has(e)));
  return { requested: emails.size, companies: companies.length, notFound: [...emails].filter((e) => !found.has(e)) };
}

/** HTML del email (imagen enlazada al formulario + enlace de texto + pie legal). */
export function emailHtml(c: Pick<Campaign, 'linkUrl' | 'imageUrl' | 'footer' | 'subject'>) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const footer = esc(c.footer).replace(/\n/g, '<br>');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;">
<tr><td align="center" style="padding:16px 8px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="padding:0 0 6px;font-size:10px;line-height:14px;color:#9ca3af;">Publicidad · Syscomputers</td></tr>
<tr><td><a href="${esc(c.linkUrl)}" target="_blank"><img src="${esc(c.imageUrl)}" width="600" alt="Digitaliza tu documentación de transporte – Quiero más información" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></a></td></tr>
<tr><td align="center" style="padding:20px 0 8px;"><a href="${esc(c.linkUrl)}" target="_blank" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:12px 28px;border-radius:6px;">Quiero más información</a></td></tr>
<tr><td style="padding:16px 0 0;font-size:11px;line-height:16px;color:#6b7280;border-top:1px solid #e5e7eb;">${footer}</td></tr>
</table></td></tr></table>`.replace(/\n/g, '');
}
