import type { Company, EmailStatus } from '@/types/models';

export type EmailStatusOrNone = EmailStatus | 'none';

export const EMAIL_STATUS: Record<EmailStatusOrNone, { label: string; color: string }> = {
  none: { label: 'Sin enviar', color: '#94a3b8' },
  sent: { label: 'Enviado', color: '#0ea5e9' },
  replied: { label: 'Respondido', color: '#10b981' },
  bounced: { label: 'Email incorrecto / rebotado', color: '#ef4444' },
  error: { label: 'Error de envío', color: '#f59e0b' },
  optout: { label: 'Baja', color: '#78716c' },
};
export const EMAIL_STATUS_KEYS = Object.keys(EMAIL_STATUS) as EmailStatusOrNone[];

/** Estado efectivo (las empresas de campañas anteriores sin estado cuentan como "Enviado"). */
export function emailStatusOf(c: Pick<Company, 'emailStatus' | 'emailOptOut' | 'campaignIds'>): EmailStatusOrNone {
  if (c.emailOptOut) return 'optout';
  if (c.emailStatus) return c.emailStatus;
  return c.campaignIds?.length ? 'sent' : 'none';
}

/** Estados que excluyen a la empresa de cualquier campaña. */
export const BLOCKED_STATUSES: EmailStatusOrNone[] = ['bounced', 'error', 'optout'];
export const isEmailBlocked = (c: Pick<Company, 'emailStatus' | 'emailOptOut' | 'campaignIds'>) => BLOCKED_STATUSES.includes(emailStatusOf(c));
