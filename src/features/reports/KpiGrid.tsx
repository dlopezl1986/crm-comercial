import { money, num, pct } from '@/lib/format';
import type { Kpis } from '@/domain/stats';

export function KpiGrid({ k, compact }: { k: Kpis; compact?: boolean }) {
  const items: [string, string, string?][] = compact
    ? [
      ['Oportunidades abiertas', num(k.opportunities)],
      ['Valor del pipeline', money(k.pipelineValue), `Ponderado ${money(k.weightedPipeline)}`],
      ['Ganadas', num(k.won), money(k.wonValue)],
      ['Perdidas', num(k.lost)],
      ['Tasa de conversión', pct(k.conversionRate), 'ganadas / cerradas'],
    ]
    : [
      ['Leads', num(k.leads), `${num(k.activeLeads)} activos`],
      ['Contactados', num(k.contacted)],
      ['Oportunidades abiertas', num(k.opportunities)],
      ['Reuniones', num(k.meetings)],
      ['Propuestas', num(k.proposals)],
      ['Ganados', num(k.won)],
      ['Perdidos', num(k.lost)],
      ['Valor del pipeline', money(k.pipelineValue), `Ponderado ${money(k.weightedPipeline)}`],
      ['Valor ganado', money(k.wonValue)],
      ['Tasa de conversión', pct(k.conversionRate), 'ganadas / cerradas'],
    ];
  return (
    <div className={`kpis ${compact ? '' : 'kpis--10'}`}>
      {items.map(([label, value, sub]) => (
        <div key={label} className="kpi">
          <div className="kpi__label">{label}</div>
          <div className="kpi__value">{value}</div>
          {sub && <div className="kpi__sub">{sub}</div>}
        </div>
      ))}
    </div>
  );
}
