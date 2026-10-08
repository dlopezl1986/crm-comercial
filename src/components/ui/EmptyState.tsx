import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon size={20} /></div>
      <div className="empty__title">{title}</div>
      {children && <div className="empty__text">{children}</div>}
    </div>
  );
}
