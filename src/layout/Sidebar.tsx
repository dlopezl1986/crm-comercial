import { NavLink } from 'react-router-dom';
import { CURRENT_PHASE, NAV_GROUPS } from '@/app/navigation';

export function Sidebar() {
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
            {group.items.map(({ path, label, icon: Icon, phase }) => (
              <NavLink key={path} to={path} end={path === '/'} className="nav-link">
                <Icon size={17} />
                <span>{label}</span>
                {phase > CURRENT_PHASE && <span className="nav-link__soon">F{phase}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
