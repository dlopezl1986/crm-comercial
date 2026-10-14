import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { matches } from '@/lib/text';

export interface MultiOption { value: string; label: string; count?: number }

interface Props {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  options: MultiOption[];
}

/** Filtro de selección múltiple: casillas + buscador. Vacío = sin filtrar. */
export function MultiSelect({ label, values, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const visible = useMemo(() => options.filter((o) => matches(q, [o.label])), [options, q]);
  const toggle = (v: string) => onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  const summary = values.length === 0 ? label
    : values.length === 1 ? (options.find((o) => o.value === values[0])?.label ?? values[0])
      : `${label} (${values.length})`;

  return (
    <div className="multi" ref={ref}>
      <button type="button" className={`filter-select multi__btn ${values.length ? 'filter-select--on' : ''}`} onClick={() => setOpen((o) => !o)} title={label}>
        <span className="truncate">{summary}</span>
        {values.length
          ? <X size={13} onClick={(e) => { e.stopPropagation(); onChange([]); }} aria-label={`Quitar filtro ${label}`} />
          : <ChevronDown size={13} />}
      </button>
      {open && (
        <div className="multi__menu">
          {options.length > 8 && <input className="picker__search" autoFocus placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="multi__list">
            {visible.map((o) => (
              <label key={o.value} className="multi__item">
                <input type="checkbox" checked={values.includes(o.value)} onChange={() => toggle(o.value)} />
                <span className="multi__label">{o.label}</span>
                {o.count != null && <span className="muted small">{o.count.toLocaleString('es-ES')}</span>}
              </label>
            ))}
            {!visible.length && <div className="muted small" style={{ padding: 8 }}>Sin resultados</div>}
          </div>
          {values.length > 0 && <button type="button" className="btn btn--ghost btn--sm multi__clear" onClick={() => onChange([])}>Limpiar selección</button>}
        </div>
      )}
    </div>
  );
}

/** Lee un filtro guardado que antes era texto y ahora es lista. */
export const asList = (v: unknown): string[] => (Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : []);
