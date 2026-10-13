import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Pencil } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { StageBadge, WhenBadge } from '@/components/ui/Badges';
import { formatDateTime, whenOf } from '@/lib/dates';
import { money } from '@/lib/format';
import type { Opportunity } from '@/types/models';
import type { AgendaItem } from '@/domain/agenda';
import { ACTIVITY_META } from '@/domain/labels';

/** Cabecera de ficha: icono/avatar, título, subtítulo, acciones. */
export function DetailHeader({ avatar, title, subtitle, actions, children }: {
  avatar: ReactNode; title: string; subtitle?: ReactNode; actions?: ReactNode; children?: ReactNode;
}) {
  return (
    <div className="detail-header">
      <div className="detail-header__avatar">{avatar}</div>
      <div className="detail-header__main">
        <h1>{title}</h1>
        {subtitle && <div className="muted">{subtitle}</div>}
        {children}
      </div>
      {actions && <div className="detail-header__actions">{actions}</div>}
    </div>
  );
}

/** Lista compacta de oportunidades. */
export function OpportunityList({ items }: { items: Opportunity[] }) {
  if (!items.length) return <p className="muted small">Sin oportunidades.</p>;
  return (
    <ul className="mini-list">
      {items.map((o) => (
        <li key={o.id}>
          <Link to={`/oportunidades/${o.id}`} className="strong-link">{o.name}</Link>
          <StageBadge stage={o.stage} />
          <span className="mini-list__end">{money(o.value)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Próximos pasos y pendientes de una entidad. */
export function NextStepsCard({ items, onAdd }: { items: AgendaItem[]; onAdd?: () => void }) {
  return (
    <Card title="Próximos pasos" icon={CalendarClock} actions={onAdd && <button className="btn btn--ghost btn--sm" onClick={onAdd}>Añadir</button>}>
      {items.length === 0 ? <p className="muted small">Nada pendiente.</p> : (
        <ul className="mini-list">
          {items.map((i) => {
            const Icon = i.activityType ? ACTIVITY_META[i.activityType].icon : CalendarClock;
            return (
              <li key={i.key}>
                <Icon size={14} className="muted" />
                <Link to={i.link} className="strong-link">{i.title}</Link>
                <WhenBadge when={whenOf(i.at)} />
                <span className="mini-list__end muted small">{formatDateTime(i.at)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function EditButton({ onClick }: { onClick: () => void }) {
  return <button className="btn btn--secondary" onClick={onClick}><Pencil size={15} /> Editar</button>;
}
