import type { Company, EmailStatus } from '@/types/models';
import { daysBetween, tsToDate } from '@/lib/dates';

export type EmailStatusOrNone = EmailStatus | 'none';

export const EMAIL_STATUS: Record<EmailStatusOrNone, { label: string; color: string }> = {
  none: { label: 'Sin enviar', color: '#94a3b8' },
  sent: { label: 'Enviado (pendiente de confirmar)', color: '#0ea5e9' },
  delivered: { label: 'Recibido, sin respuesta', color: '#6366f1' },
  replied: { label: 'Respondido', color: '#10b981' },
  bounced: { label: 'Email incorrecto / rebotado', color: '#ef4444' },
  error: { label: 'Error de envío', color: '#f59e0b' },
  optout: { label: 'Baja', color: '#78716c' },
};
export const EMAIL_STATUS_KEYS = Object.keys(EMAIL_STATUS) as EmailStatusOrNone[];

/** Días tras el envío sin rebote para considerar que el email se ha recibido. */
export const DELIVERY_GRACE_DAYS = 3;

type StatusFields = Pick<Company, 'emailStatus' | 'emailOptOut' | 'campaignIds' | 'emailSentAt'>;

/**
 * Estado efectivo:
 * - las empresas de campañas anteriores sin estado cuentan como "Enviado";
 * - un "Enviado" sin rebote pasados DELIVERY_GRACE_DAYS días pasa a "Recibido, sin respuesta".
 */
export function emailStatusOf(c: StatusFields, now = new Date()): EmailStatusOrNone {
  if (c.emailOptOut) return 'optout';
  const s: EmailStatusOrNone = c.emailStatus ?? (c.campaignIds?.length ? 'sent' : 'none');
  if (s === 'sent') {
    const sent = tsToDate(c.emailSentAt);
    if (sent && daysBetween(sent, now) >= DELIVERY_GRACE_DAYS) return 'delivered';
  }
  return s;
}

/** Estados que excluyen a la empresa de cualquier campaña. */
export const BLOCKED_STATUSES: EmailStatusOrNone[] = ['bounced', 'error', 'optout'];
export const isEmailBlocked = (c: StatusFields) => BLOCKED_STATUSES.includes(emailStatusOf(c));
/** Estados que indican que ya recibió (o se le envió) un email. */
export const CONTACTED_STATUSES: EmailStatusOrNone[] = ['sent', 'delivered', 'replied'];
