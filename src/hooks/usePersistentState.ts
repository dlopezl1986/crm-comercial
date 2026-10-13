import { useEffect, useState } from 'react';

/** Estado que se recuerda durante la sesión del navegador (filtros, vista elegida…). */
export function usePersistentState<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    try { const s = sessionStorage.getItem(key); return s ? (JSON.parse(s) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { sessionStorage.setItem(key, JSON.stringify(v)); } catch { /* ignorar */ } }, [key, v]);
  return [v, setV] as const;
}
