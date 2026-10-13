const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const eurCompact = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number | null | undefined) => (n == null ? '—' : eur.format(n));
export const moneyCompact = (n: number) => eurCompact.format(n);
export const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)} %`);
export const num = (n: number) => n.toLocaleString('es-ES');

/** Valor ponderado = valor × probabilidad. Sin valor o sin probabilidad → null. */
export function weighted(value?: number | null, probability?: number | null) {
  return value != null && probability != null ? Math.round((value * probability) / 100) : null;
}
