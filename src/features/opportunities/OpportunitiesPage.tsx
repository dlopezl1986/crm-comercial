import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { KanbanSquare, List, Plus } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { StageBadge, WhenBadge } from '@/components/ui/Badges';
import { FullScreenLoader } from '@/components/ui/Spinner';
import { useData } from '@/data/DataProvider';
import { usePersistentState } from '@/hooks/usePersistentState';
import { LOSS_REASONS, isOpenStage } from '@/domain/labels';
import { formatDate, whenOf } from '@/lib/dates';
import { money, num } from '@/lib/format';
import { OpportunityForm } from './OpportunityForm';
import { PipelineBoard } from './PipelineBoard';
import { useOpportunityFilters } from './useOpportunityFilters';
import { OpportunityFiltersBar } from './OpportunityFiltersBar';

export function OpportunitiesPage() {
  const { opportunities, companyById, serviceById, ready } = useData();
  const [view, setView] = usePersistentState<'board' | 'list'>('opps.view', 'board');
  const [creating, setCreating] = useState(false);
  const filters = useOpportunityFilters();
  const items = filters.filtered;

  const totals = useMemo(() => {
    const open = items.filter((o) => isOpenStage(o.stage));
    return { open: open.length, value: open.reduce((s, o) => s + (o.value ?? 0), 0), weighted: open.reduce((s, o) => s + (o.weightedValue ?? 0), 0) };
  }, [items]);

  if (!ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Oportunidades"
        subtitle={`${num(totals.open)} abiertas · Pipeline ${money(totals.value)} · Ponderado ${money(totals.weighted)}`}
        actions={<>
          <div className="segmented">
            <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><KanbanSquare size={15} /> Pipeline</button>
            <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={15} /> Lista</button>
          </div>
          <button className="btn btn--primary" onClick={() => setCreating(true)}><Plus size={16} /> Nueva oportunidad</button>
        </>} />
      <OpportunityFiltersBar filters={filters} showLoss={view === 'list'} />

      {opportunities.length === 0 ? (
        <div className="card"><EmptyState icon={KanbanSquare} title="Aún no hay oportunidades">Crea una o convierte un lead.</EmptyState></div>
      ) : view === 'board' ? <PipelineBoard items={items} /> : (
        <div className="card card--flush">
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Oportunidad</th><th>Empresa</th><th>Estado</th><th className="num">Valor</th><th className="num">Prob.</th><th className="num">Ponderado</th><th>Cierre previsto</th><th>Próximo paso</th><th>Servicios / motivo</th></tr></thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td><Link to={`/oportunidades/${o.id}`} className="strong-link">{o.name}</Link></td>
                  <td>{o.companyId && <Link to={`/empresas/${o.companyId}`}>{companyById.get(o.companyId)?.name}</Link>}</td>
                  <td><StageBadge stage={o.stage} /></td>
                  <td className="num">{money(o.value)}</td>
                  <td className="num">{o.probability != null ? `${o.probability} %` : '—'}</td>
                  <td className="num">{money(o.weightedValue)}</td>
                  <td className="nowrap">{o.expectedCloseAt ? formatDate(o.expectedCloseAt) : '—'}</td>
                  <td>{o.nextStep ? <span className="inline">{o.nextStep} <WhenBadge when={whenOf(o.nextStepAt)} /></span> : isOpenStage(o.stage) ? <span className="danger small">Sin próximo paso</span> : ''}</td>
                  <td className="muted small">{o.stage === 'lost' && o.lossReason ? `Motivo: ${LOSS_REASONS[o.lossReason]}` : o.serviceIds?.map((id) => serviceById.get(id)?.name).filter(Boolean).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {!items.length && <EmptyState icon={List} title="Sin resultados">Prueba con otros filtros.</EmptyState>}
        </div>
      )}
      {creating && <OpportunityForm onClose={() => setCreating(false)} />}
    </>
  );
}
