import { useState } from 'react';

/** Estado simple de formulario: valores + setter por campo. */
export function useForm<T extends Record<string, unknown>>(initial: T) {
  const [values, setValues] = useState<T>(initial);
  const set = <K extends keyof T>(key: K) => (e: { target: { value: string } } | T[K]) => {
    const v = e && typeof e === 'object' && 'target' in (e as object) ? (e as { target: { value: string } }).target.value : e;
    setValues((s) => ({ ...s, [key]: v }));
  };
  return { values, setValues, set };
}

/** Convierte cadenas vacías en undefined (para no guardar campos vacíos). */
export function blankToUndef<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, typeof v === 'string' && !v.trim() ? undefined : typeof v === 'string' ? v.trim() : v]),
  ) as T;
}
