import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  icon?: LucideIcon;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Card({ title, icon: Icon, subtitle, actions, className = '', children }: Props) {
  return (
    <section className={`card ${className}`}>
      <header className="card__head">
        <div className="card__title">
          {Icon && <Icon size={16} />}
          <h2>{title}</h2>
          {subtitle && <span className="card__subtitle">{subtitle}</span>}
        </div>
        {actions}
      </header>
      {children}
    </section>
  );
}
