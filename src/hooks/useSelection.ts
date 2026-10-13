import { useCallback, useState } from 'react';

/** Selección múltiple de filas por id. */
export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = useCallback((id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  }), []);
  const setAll = useCallback((ids: string[], on: boolean) => setSelected(on ? new Set(ids) : new Set()), []);
  const clear = useCallback(() => setSelected(new Set()), []);
  return { selected, toggle, setAll, clear };
}
