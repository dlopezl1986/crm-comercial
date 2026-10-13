/** Normaliza para búsquedas: minúsculas y sin acentos. */
export function norm(s: string | undefined | null) {
  return (s ?? '').toLocaleLowerCase('es').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Teléfono solo con dígitos (y +), para buscar ignorando espacios y guiones. */
export function digits(s: string | undefined | null) {
  return (s ?? '').replace(/[^\d+]/g, '');
}

/** ¿Algún campo contiene todas las palabras de la búsqueda? */
export function matches(q: string, fields: (string | undefined | null)[]) {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = fields.map(norm).join(' ');
  const hayDigits = fields.map(digits).join(' ');
  return words.every((w) => hay.includes(w) || (/^\+?\d{3,}$/.test(w) && hayDigits.includes(w)));
}

export function fullName(c: { firstName: string; lastName?: string }) {
  return [c.firstName, c.lastName].filter(Boolean).join(' ');
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
}

/** Añade https:// si falta, para enlaces. */
export function asUrl(s: string) {
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function uniqueSorted(values: (string | undefined)[]) {
  return [...new Set(values.map((v) => v?.trim()).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, 'es'));
}
