import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { matches } from '@/lib/text';

export interface PickOption { id: string; label: string; sub?: string }

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  options: PickOption[];
  placeholder?: string;
  disabled?: boolean;
}

/** Selector con búsqueda, pensado para listas largas (miles de empresas). Muestra hasta 50 coincidencias. */
export function EntityPicker({ value, onChange, options, placeholder = 'Seleccionar…', disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const filtered = useMemo(
    () => options.filter((o) => matches(q, [o.label, o.sub])).slice(0, 50),
    [options, q],
  );

  return (
    <div className={`picker ${disabled ? 'picker--disabled' : ''}`} ref={ref}>
      <button type="button" className="picker__control" onClick={() => !disabled && setOpen((o) => !o)} disabled={disabled}>
        <span className={selected ? '' : 'muted'}>{selected?.label ?? placeholder}</span>
        {selected && !disabled
          ? <X size={14} onClick={(e) => { e.stopPropagation(); onChange(null); }} />
          : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="picker__menu">
          <input autoFocus className="picker__search" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="picker__list">
            {filtered.map((o) => (
              <button type="button" key={o.id} className={`picker__item ${o.id === value ? 'active' : ''}`}
                onClick={() => { onChange(o.id); setOpen(false); setQ(''); }}>
                <span>{o.label}</span>
                {o.sub && <span className="muted small">{o.sub}</span>}
              </button>
            ))}
            {!filtered.length && <div className="picker__empty muted small">Sin resultados</div>}
          </div>
        </div>
      )}
    </div>
  );
}
