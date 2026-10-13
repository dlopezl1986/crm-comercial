import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Building2, KanbanSquare, Search, Sparkles, User } from 'lucide-react';
import { useData } from '@/data/DataProvider';
import { fullName, matches } from '@/lib/text';

interface Hit { key: string; label: string; sub: string; link: string; icon: typeof Search; group: string }

/** Búsqueda global (Ctrl/⌘ + K): empresas, personas, emails, teléfonos, leads y oportunidades. */
export function GlobalSearch() {
  const d = useData();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  // Al cambiar de pantalla se cierra el desplegable.
  useEffect(() => { setOpen(false); }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ref.current?.focus(); setOpen(true); }
    };
    const onDoc = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDoc);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDoc); };
  }, []);

  const hits = useMemo<Hit[]>(() => {
    if (q.trim().length < 2) return [];
    const out: Hit[] = [];
    const take = <T,>(xs: T[], n: number, f: (x: T) => Hit | null) => { for (const x of xs) { if (out.length >= 40 || n <= 0) break; const h = f(x); if (h) { out.push(h); n--; } } };
    take(d.companies, 8, (c) => matches(q, [c.name, c.cif, c.email, c.phone, c.website]) ? { key: `c${c.id}`, label: c.name, sub: [c.city, c.phone, c.email].filter(Boolean).join(' · '), link: `/empresas/${c.id}`, icon: Building2, group: 'Empresas' } : null);
    take(d.contacts, 8, (c) => matches(q, [fullName(c), c.email, c.phone, c.mobile]) ? { key: `p${c.id}`, label: fullName(c), sub: [c.companyId ? d.companyById.get(c.companyId)?.name : '', c.email, c.phone || c.mobile].filter(Boolean).join(' · '), link: `/contactos/${c.id}`, icon: User, group: 'Personas' } : null);
    take(d.opportunities, 6, (o) => matches(q, [o.name, o.companyId ? d.companyById.get(o.companyId)?.name : '']) ? { key: `o${o.id}`, label: o.name, sub: o.companyId ? d.companyById.get(o.companyId)?.name ?? '' : '', link: `/oportunidades/${o.id}`, icon: KanbanSquare, group: 'Oportunidades' } : null);
    take(d.leads, 6, (l) => matches(q, [l.title]) ? { key: `l${l.id}`, label: l.title, sub: 'Lead', link: `/leads/${l.id}`, icon: Sparkles, group: 'Leads' } : null);
    return out;
  }, [q, d]);

  const go = (h: Hit) => { navigate(h.link); setOpen(false); setQ(''); ref.current?.blur(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && hits[active]) go(hits[active]);
    else if (e.key === 'Escape') { setOpen(false); ref.current?.blur(); }
  };

  let lastGroup = '';
  return (
    <div className="gsearch" ref={box}>
      <Search size={16} className="gsearch__icon" />
      <input ref={ref} value={q} placeholder="Buscar empresas, personas, email, teléfono, oportunidades…"
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }} onFocus={() => setOpen(true)} onKeyDown={onKeyDown} />
      <kbd className="gsearch__kbd">⌘K</kbd>
      {open && q.trim().length >= 2 && (
        <div className="gsearch__menu">
          {!hits.length && <div className="gsearch__empty muted small">Sin resultados para "{q}"</div>}
          {hits.map((h, i) => {
            const header = h.group !== lastGroup ? (lastGroup = h.group) : null;
            return (
              <div key={h.key}>
                {header && <div className="gsearch__group">{header}</div>}
                <button className={`gsearch__hit ${i === active ? 'active' : ''}`} onMouseEnter={() => setActive(i)} onClick={() => go(h)}>
                  <h.icon size={15} />
                  <span className="gsearch__label">{h.label}</span>
                  <span className="gsearch__sub truncate">{h.sub}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
