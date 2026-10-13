import { Timestamp } from 'firebase/firestore';

export type When = 'overdue' | 'today' | 'tomorrow' | 'soon' | 'later';

export function tsToDate(ts: Timestamp | Date | undefined | null): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  return typeof ts.toDate === 'function' ? ts.toDate() : null;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
export const daysBetween = (a: Date, b: Date) => Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);

/** Clasifica una fecha respecto a hoy: atrasado, hoy, mañana, próximos 7 días o más adelante. */
export function whenOf(ts: Timestamp | Date | null | undefined, now = new Date()): When | null {
  const d = tsToDate(ts);
  if (!d) return null;
  const diff = daysBetween(now, d);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff <= 7) return 'soon';
  return 'later';
}

export const WHEN_LABEL: Record<When, string> = {
  overdue: 'Atrasado', today: 'Hoy', tomorrow: 'Mañana', soon: 'Próximamente', later: 'Más adelante',
};

export function formatDate(ts: Timestamp | Date | undefined | null) {
  const d = tsToDate(ts);
  return d ? d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
}

export function formatDateTime(ts: Timestamp | Date | undefined | null) {
  const d = tsToDate(ts);
  if (!d) return '—';
  return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatTime(ts: Timestamp | Date | undefined | null) {
  const d = tsToDate(ts);
  return d ? d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';
}

/** "hace 3 días", "en 2 días", "hoy"… */
export function relativeDay(ts: Timestamp | Date | null | undefined, now = new Date()) {
  const d = tsToDate(ts);
  if (!d) return '—';
  const diff = daysBetween(now, d);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'mañana';
  if (diff === -1) return 'ayer';
  return diff > 0 ? `en ${diff} días` : `hace ${-diff} días`;
}

/** Valores para <input type="date"> y <input type="time">. */
export function toDateInput(ts: Timestamp | Date | null | undefined) {
  const d = tsToDate(ts);
  if (!d) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function toTimeInput(ts: Timestamp | Date | null | undefined) {
  const d = tsToDate(ts);
  if (!d) return '';
  return d.toTimeString().slice(0, 5);
}
export function fromInputs(date: string, time = ''): Timestamp | null {
  if (!date) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '09:00').split(':').map(Number);
  return Timestamp.fromDate(new Date(y, m - 1, d, hh, mm));
}
export const tsFromDate = (d: Date) => Timestamp.fromDate(d);
