import { useMemo } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { computeKpis } from '@/domain/stats';
import { activityByWeek, funnel, lossReasons, pipelineFlow, pipelineValueEvolution, salesByMonth, stageDistribution } from '@/domain/reportData';
import { addDays } from '@/lib/dates';
import { KpiGrid } from './KpiGrid';
import { Bars, Donut, GroupedBars, Lines } from './charts';

const RANGES = { all: 'Todo', '30': 'Últimos 30 días', '90': 'Últimos 90 días', '365': 'Último año' } as const;

export function ReportsPage() {
  const d = useData();
  const [range, setRange] = usePersistentState<keyof typeof RANGES>('reports.range', 'all');
  const from = range === 'all' ? undefined : addDays(new Date(), -Number(range));
  const k = useMemo(() => computeKpis(d, from), [d, range]); // eslint-disable-line react-hooks/exhaustive-deps
  const charts = useMemo(() => ({
    stages: stageDistribution(d), losses: lossReasons(d), sales: salesByMonth(d), flow: pipelineFlow(d),
    value: pipelineValueEvolution(d), activity: activityByWeek(d),
  }), [d]);

  if (!d.ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Informes" subtitle="¿Cómo estoy vendiendo?" actions={
        <div className="segmented">
          {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((r) => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>{RANGES[r]}</button>
          ))}
        </div>
      } />
      <div className="reports">
        <KpiGrid k={k} />
        <div className="reports__grid">
          <Card title="Oportunidades por estado"><Donut data={charts.stages} /></Card>
          <Card title="Motivos de pérdida"><Donut data={charts.losses} /></Card>
          <Card title="Ventas por mes" subtitle="Valor ganado, últimos 12 meses"><Bars data={charts.sales} money label="Ventas" /></Card>
          <Card title="Embudo de conversión"><Bars data={funnel(k)} label="Registros" color="var(--series-7)" /></Card>
          <Card title="Evolución del pipeline" subtitle="Oportunidades por mes">
            <GroupedBars data={charts.flow} series={[{ key: 'creadas', label: 'Creadas' }, { key: 'ganadas', label: 'Ganadas' }, { key: 'perdidas', label: 'Perdidas' }]} />
          </Card>
          <Card title="Valor del pipeline abierto" subtitle="A final de cada mes">
            <Lines data={charts.value} series={[{ key: 'pipeline', label: 'Pipeline abierto' }]} money />
          </Card>
          <Card title="Actividad comercial" subtitle="Actividades hechas por semana" className="reports__wide">
            <Lines data={charts.activity} series={[{ key: 'llamadas', label: 'Llamadas' }, { key: 'emails', label: 'Emails' }, { key: 'reuniones', label: 'Reuniones y demos' }]} />
          </Card>
        </div>
      </div>
    </>
  );
}
