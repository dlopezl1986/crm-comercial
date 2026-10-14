import { useEffect, useState } from 'react';
import { useSession } from '@/auth/AuthProvider';
import { useToast } from '@/components/ui/Toast';
import { EMAIL_STATUS, EMAIL_STATUS_KEYS, emailStatusOf, type EmailStatusOrNone } from '@/domain/emailStatus';
import { setEmailStatus } from '@/services/emailStatus';
import { updateItem } from '@/services/repository';
import { formatDate } from '@/lib/dates';
import type { Company } from '@/types/models';

/** Estado del email + comentario, editables en línea (lista de empresas y ficha). */
export function EmailStatusEditor({ company, compact }: { company: Company; compact?: boolean }) {
  const { orgId } = useSession();
  const toast = useToast();
  const status = emailStatusOf(company);
  const [note, setNote] = useState(company.emailNote ?? '');
  useEffect(() => setNote(company.emailNote ?? ''), [company.emailNote]);
  const meta = EMAIL_STATUS[status];

  const change = async (s: EmailStatusOrNone) => {
    await setEmailStatus(orgId, [company.id], s);
    toast(`Email: ${EMAIL_STATUS[s].label}`);
  };
  const saveNote = async (value: string) => {
    if (value.trim() === (company.emailNote ?? '')) return;
    await updateItem<Company>(orgId, 'companies', company.id, { emailNote: value.trim() || undefined });
    toast('Comentario guardado');
  };

  return (
    <div className={`email-status ${compact ? 'email-status--compact' : ''}`}>
      <select className="email-status__select" value={status} onChange={(e) => change(e.target.value as EmailStatusOrNone)}
        style={{ color: meta.color, borderColor: `color-mix(in srgb, ${meta.color} 45%, var(--border))` }} aria-label="Estado del email">
        {EMAIL_STATUS_KEYS.map((k) => <option key={k} value={k}>{EMAIL_STATUS[k].label}</option>)}
      </select>
      {!compact && company.emailSentAt && <span className="muted small">enviado {formatDate(company.emailSentAt)}</span>}
      <input className="email-status__note" value={note} placeholder="Comentario…" onChange={(e) => setNote(e.target.value)}
        onBlur={(e) => saveNote(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} aria-label="Comentario del email" />
    </div>
  );
}
