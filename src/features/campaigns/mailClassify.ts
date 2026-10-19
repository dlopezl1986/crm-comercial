/** Clasificación de correos recibidos (función pura, sin dependencias de Firebase). */
import { norm } from '@/lib/text';
import type { EmailStatus } from '@/types/models';

export type MailKind = 'bounce' | 'optout' | 'autoreply' | 'reply';
export const MAIL_KIND: Record<MailKind, { label: string; status: EmailStatus; color: string }> = {
  bounce: { label: 'Rebote / no existe', status: 'bounced', color: '#ef4444' },
  optout: { label: 'Baja', status: 'optout', color: '#78716c' },
  autoreply: { label: 'Respuesta automática (recibido)', status: 'delivered', color: '#6366f1' },
  reply: { label: 'Respuesta', status: 'replied', color: '#10b981' },
};

export interface MailRow { date?: string; from?: string; subject?: string; text?: string }

export const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BOUNCE_FROM = /postmaster|mailer-daemon|microsoftexchange|mail delivery|no-?reply.*(bounce|delivery)/i;
const BOUNCE_SUBJECT = /no se puede entregar|no se pudo entregar|undeliverable|undelivered|delivery (status|failure|has failed)|returned mail|error de entrega|mensaje no entregado|failure notice|no entregado|delivery notification|devuelto/i;
const AUTO_SUBJECT = /respuesta autom[aá]tica|automatic reply|auto(matic)?[- ]?reply|fuera de la oficina|out of (the )?office|ausencia|vacaciones|resposta autom|absence/i;
const OPTOUT_TEXT = /\b(baja|darme de baja|dadme de baja|no deseo recibir|unsubscribe|elimin(ar|en) mi (correo|email)|no me (env[ií]e|escrib))/i;
/** Dominios genéricos: no sirven para identificar a la empresa por dominio. */
export const GENERIC = new Set(['gmail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'yahoo.com', 'yahoo.es', 'live.com', 'icloud.com', 'msn.com', 'telefonica.net', 'movistar.es', 'protonmail.com']);

export const emailsIn = (s?: string) => [...new Set((s ?? '').match(EMAIL_RE)?.map((e) => e.toLowerCase().replace(/\.$/, '')) ?? [])];
export const domainOf = (e?: string) => (e ?? '').toLowerCase().split('@')[1] ?? '';

export function classify(row: MailRow): MailKind {
  const from = row.from ?? '', subject = row.subject ?? '', text = row.text ?? '';
  if (BOUNCE_FROM.test(from) || BOUNCE_SUBJECT.test(subject)) return 'bounce';
  if (AUTO_SUBJECT.test(subject)) return 'autoreply';
  // La palabra BAJA suele ir al principio de la respuesta (antes del correo citado).
  if (OPTOUT_TEXT.test(subject) || OPTOUT_TEXT.test(text.slice(0, 300))) return 'optout';
  return 'reply';
}

/** Clave estable de un correo, para no procesarlo dos veces. */
export const mailKey = (r: MailRow) => `mail:${norm(`${r.date}|${r.from}|${r.subject}`).replace(/\s+/g, ' ').slice(0, 200)}`;

