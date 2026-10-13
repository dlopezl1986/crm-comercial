import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { ACTIVITY_META, CALL_RESULTS } from '@/domain/labels';
import { formatDateTime, tsToDate } from '@/lib/dates';
import { setActivityStatus } from '@/services/crm';
import { EmptyState } from '@/components/ui/EmptyState';
import { History } from 'lucide-react';
import type { Activity } from '@/types/models';
import { ActivityDialog } from './ActivityDialog';
import { Link } from 'react-router-dom';
import { fullName } from '@/lib/text';

/** Historial cronológico de actividades (más recientes primero; pendientes arriba). */
export function Timeline({ activities, showLinks = true }: { activities: Activity[]; showLinks?: boolean }) {
  const ctx = useSession();
  const { companyById, contactById, opportunityById } = useData();
  const [editing, setEditing] = useState<Activity | null>(null);

  const sorted = [...activities].sort((a, b) => {
    if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
    const da = tsToDate(a.dueAt)?.getTime() ?? 0;
    const db = tsToDate(b.dueAt)?.getTime() ?? 0;
    return a.status === 'pending' ? da - db : db - da;
  });

  if (!sorted.length) return <EmptyState icon={History} title="Sin actividad">Registra llamadas, emails, reuniones o notas.</EmptyState>;

  return (
    <>
      <ol className="timeline">
        {sorted.map((a) => {
          const M = ACTIVITY_META[a.type];
          const company = a.companyId ? companyById.get(a.companyId) : undefined;
          const contact = a.contactId ? contactById.get(a.contactId) : undefined;
          const opp = a.opportunityId ? opportunityById.get(a.opportunityId) : undefined;
          return (
            <li key={a.id} className={`timeline__item timeline__item--${a.status}`}>
              <span className="timeline__icon" style={{ color: M.color, background: `color-mix(in srgb, ${M.color} 14%, transparent)` }}><M.icon size={14} /></span>
              <div className="timeline__body">
                <div className="timeline__head">
                  <strong>{a.title}</strong>
                  {a.status === 'pending' && <span className="badge badge--warn">Pendiente</span>}
                  {a.status === 'cancelled' && <span className="badge">Cancelada</span>}
                  {a.result && <span className="badge badge--info">{CALL_RESULTS[a.result]}</span>}
                  <span className="muted small timeline__date">{formatDateTime(a.dueAt)}</span>
                </div>
                {a.description && <p className="timeline__desc">{a.description}</p>}
                {showLinks && (company || contact || opp) && (
                  <div className="small muted timeline__links">
                    {company && <Link to={`/empresas/${company.id}`}>{company.name}</Link>}
                    {contact && <Link to={`/contactos/${contact.id}`}>{fullName(contact)}</Link>}
                    {opp && <Link to={`/oportunidades/${opp.id}`}>{opp.name}</Link>}
                  </div>
                )}
              </div>
              <div className="timeline__actions">
                {a.status === 'pending' && (
                  <button className="icon-btn" title="Marcar como hecha" onClick={() => setActivityStatus(ctx, a, 'done')}><Check size={16} /></button>
                )}
                <button className="icon-btn" title="Editar" onClick={() => setEditing(a)}><Pencil size={15} /></button>
              </div>
            </li>
          );
        })}
      </ol>
      {editing && <ActivityDialog activity={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
