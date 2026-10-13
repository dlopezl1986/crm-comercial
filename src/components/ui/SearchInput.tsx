import { Search, X } from 'lucide-react';

interface Props { value: string; onChange: (v: string) => void; placeholder?: string; autoFocus?: boolean }

export function SearchInput({ value, onChange, placeholder = 'Buscar…', autoFocus }: Props) {
  return (
    <div className="search-input">
      <Search size={16} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
      {value && <button className="search-input__clear" onClick={() => onChange('')} aria-label="Limpiar"><X size={14} /></button>}
    </div>
  );
}
