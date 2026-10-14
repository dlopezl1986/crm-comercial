import { Timestamp } from 'firebase/firestore';
import { bulkUpdate } from './repository';
import type { EmailStatusOrNone } from '@/domain/emailStatus';

/** Cambia el estado del email de varias empresas (y la marca de baja, que va ligada). */
export function setEmailStatus(orgId: string, ids: string[], status: EmailStatusOrNone, note?: string) {
  const now = Timestamp.now();
  return bulkUpdate(orgId, 'companies', ids.map((id) => ({
    id,
    data: {
      emailStatus: status === 'none' ? null : status,
      emailOptOut: status === 'optout',
      emailOptOutAt: status === 'optout' ? now : null,
      emailStatusAt: now,
      ...(note !== undefined ? { emailNote: note } : {}),
    },
  })));
}
