import { NavLink } from 'react-router-dom';
import { NAV_GROUPS } from '@/app/navigation';
import { useData } from '@/data/DataProvider';
import { buildAgenda } from '@/domain/agenda';
import { useMemo } from 'react';

export function Sidebar() {
  const d = useData();
  // Contador de lo que toca hoy o está atrasado, visible desde cualquier pantalla.
  const due = useMemo(() => buildAgenda(d).filter((i) => i.when === 'overdue' || i.when === 'today').length, [d]);
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="./favicon.svg" alt="" width={28} height={28} />
        <span>CRM Comercial</span>
      </div>
      <nav className="sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="nav-group">
            <div className="nav-group__label">{group.label}</div>
            {group.items.map(({ path, label, icon: Icon }) => (
              <NavLink key={path} to={path} end={path === '/'} className="nav-link">
                <Icon size={17} />
                <span>{label}</span>
                {path === '/' && due > 0 && <span className="nav-link__count">{due}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
