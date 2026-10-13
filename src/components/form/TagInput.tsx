import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface Props { value: string[]; onChange: (tags: string[]) => void; suggestions?: string[] }

/** Etiquetas libres: Enter o coma para añadir; sugiere las ya usadas. */
export function TagInput({ value, onChange, suggestions = [] }: Props) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div className="tag-input">
      {value.map((t) => (
        <span key={t} className="tag">
          {t}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`Quitar ${t}`}><X size={12} /></button>
        </span>
      ))}
      <input
        list="tag-suggestions" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
        onBlur={() => text && add(text)} placeholder={value.length ? '' : 'Añadir etiqueta…'}
      />
      <datalist id="tag-suggestions">
        {suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}
      </datalist>
    </div>
  );
}
