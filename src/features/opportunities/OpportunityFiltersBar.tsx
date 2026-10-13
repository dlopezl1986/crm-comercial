import { X } from 'lucide-react';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterSelect } from '@/components/ui/Select';
import { useData } from '@/data/DataProvider';
import { LOSS_REASONS } from '@/domain/labels';
import type { useOpportunityFilters } from './useOpportunityFilters';

export function OpportunityFiltersBar({ filters, showLoss }: { filters: ReturnType<typeof useOpportunityFilters>; showLoss?: boolean }) {
  const { services, allTags } = useData();
  const { f, set, active, clear } = filters;
  return (
    <div className="toolbar">
      <SearchInput value={f.q} onChange={set('q')} placeholder="Buscar oportunidad, empresa, contacto…" />
      <FilterSelect label="Servicio" value={f.service} onChange={set('service')} options={services.map((s) => ({ value: s.id, label: s.name }))} />
      <FilterSelect label="Etiqueta" value={f.tag} onChange={set('tag')} options={allTags.map((t) => ({ value: t, label: t }))} />
      <FilterSelect label="Próximo paso" value={f.next} onChange={set('next')} options={[
        { value: 'overdue', label: 'Atrasado' }, { value: 'today', label: 'Hoy' },
        { value: 'week', label: 'Próximos 7 días' }, { value: 'none', label: 'Sin próximo paso' },
      ]} />
      <FilterSelect label="Valor mín." value={f.minValue} onChange={set('minValue')} options={[1000, 5000, 10000, 25000, 50000].map((v) => ({ value: String(v), label: `≥ ${v.toLocaleString('es-ES')} €` }))} />
      <FilterSelect label="Probabilidad" value={f.minProb} onChange={set('minProb')} options={[25, 50, 75].map((v) => ({ value: String(v), label: `≥ ${v} %` }))} />
      {showLoss && <FilterSelect label="Motivo de pérdida" value={f.loss} onChange={set('loss')} options={Object.entries(LOSS_REASONS).map(([value, label]) => ({ value, label }))} />}
      {active && <button className="btn btn--ghost btn--sm" onClick={clear}><X size={14} /> Limpiar</button>}
    </div>
  );
}
