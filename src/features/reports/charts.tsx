import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from 'recharts';
import { moneyCompact, money, num } from '@/lib/format';

/** Paleta categórica validada (orden fijo, nunca rotada). Ver styles/charts.css para claro/oscuro. */
export const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`);

export interface Slice { name: string; value: number }

const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5 },
  itemStyle: { color: 'var(--text)' },
  labelStyle: { color: 'var(--text-2)' },
};
const axis = { stroke: 'var(--text-3)', fontSize: 12, tickLine: false, axisLine: false } as const;

/** Donut con leyenda; más de 7 categorías se agrupan en "Otros". */
export function Donut({ data, money: isMoney, height = 240 }: { data: Slice[]; money?: boolean; height?: number }) {
  const sorted = data.filter((d) => d.value > 0);
  const shown = sorted.length > 7 ? [...sorted.slice(0, 6), { name: 'Otros', value: sorted.slice(6).reduce((s, d) => s + d.value, 0) }] : sorted;
  const total = shown.reduce((s, d) => s + d.value, 0);
  if (!total) return <div className="chart-empty">Sin datos todavía</div>;
  return (
    <div className="donut">
      <div className="donut__chart">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={shown} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={1.5} stroke="var(--surface)" strokeWidth={2}>
            {shown.map((_, i) => <Cell key={i} fill={SERIES[i]} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v) => (isMoney ? money(Number(v)) : num(Number(v)))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="donut__center"><strong>{isMoney ? moneyCompact(total) : num(total)}</strong><span>total</span></div>
      </div>
      <ul className="legend">
        {shown.map((d, i) => (
          <li key={d.name}><span className="legend__swatch" style={{ background: SERIES[i] }} />{d.name}<span className="legend__value">{isMoney ? money(d.value) : num(d.value)} · {Math.round((d.value / total) * 100)} %</span></li>
        ))}
      </ul>
    </div>
  );
}

/** Barras de una sola serie (magnitud): un único color. */
export function Bars({ data, money: isMoney, height = 240, color = SERIES[0], label }: {
  data: Slice[]; money?: boolean; height?: number; color?: string; label: string;
}) {
  if (!data.some((d) => d.value > 0)) return <div className="chart-empty">Sin datos todavía</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} width={56} tickFormatter={(v) => (isMoney ? moneyCompact(v) : num(v))} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => [isMoney ? money(Number(v)) : num(Number(v)), label]} />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Varias series en líneas (mismo eje). */
export function Lines({ data, series, height = 240, money: isMoney }: {
  data: Record<string, string | number>[]; series: { key: string; label: string }[]; height?: number; money?: boolean;
}) {
  if (!data.length) return <div className="chart-empty">Sin datos todavía</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} width={56} tickFormatter={(v) => (isMoney ? moneyCompact(v) : num(v))} allowDecimals={false} />
        <Tooltip {...tooltipStyle} formatter={(v) => (isMoney ? money(Number(v)) : num(Number(v)))} />
        <Legend iconType="plainline" wrapperStyle={{ fontSize: 12.5, color: 'var(--text-2)' }} />
        {series.map((s, i) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barras agrupadas (varias series, mismo eje). */
export function GroupedBars({ data, series, height = 240 }: {
  data: Record<string, string | number>[]; series: { key: string; label: string }[]; height?: number;
}) {
  if (!data.length) return <div className="chart-empty">Sin datos todavía</div>;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="name" {...axis} />
        <YAxis {...axis} width={40} allowDecimals={false} />
        <Tooltip {...tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} />
        <Legend wrapperStyle={{ fontSize: 12.5, color: 'var(--text-2)' }} />
        {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES[i]} radius={[4, 4, 0, 0]} maxBarSize={22} />)}
      </BarChart>
    </ResponsiveContainer>
  );
}
