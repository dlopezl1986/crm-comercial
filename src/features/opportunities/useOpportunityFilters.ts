import { useMemo } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { useData } from '@/data/DataProvider';
import { matches, fullName } from '@/lib/text';
import { whenOf } from '@/lib/dates';
import { isOpenStage } from '@/domain/labels';

export interface OppFilters {
  q: string; service: string; tag: string; next: string; minValue: string; minProb: string; loss: string; stage: string; company: string;
}
const EMPTY: OppFilters = { q: '', service: '', tag: '', next: '', minValue: '', minProb: '', loss: '', stage: '', company: '' };

/** Filtros compartidos por el kanban y la lista de oportunidades. */
export function useOpportunityFilters() {
  const d = useData();
  const [f, setF] = usePersistentState<OppFilters>('opps.filters', EMPTY);
  const set = (k: keyof OppFilters) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const active = Object.values(f).some(Boolean);

  const filtered = useMemo(() => d.opportunities.filter((o) => {
    if (f.service && !o.serviceIds?.includes(f.service)) return false;
    if (f.tag && !o.tags?.includes(f.tag)) return false;
    if (f.stage && o.stage !== f.stage) return false;
    if (f.company && o.companyId !== f.company) return false;
    if (f.loss && o.lossReason !== f.loss) return false;
    if (f.minValue && (o.value ?? 0) < Number(f.minValue)) return false;
    if (f.minProb && (o.probability ?? 0) < Number(f.minProb)) return false;
    if (f.next) {
      const w = whenOf(o.nextStepAt);
      if (f.next === 'none' && (!isOpenStage(o.stage) || o.nextStep)) return false;
      if (f.next === 'overdue' && w !== 'overdue') return false;
      if (f.next === 'today' && w !== 'today') return false;
      if (f.next === 'week' && !(w === 'today' || w === 'tomorrow' || w === 'soon')) return false;
    }
    const company = o.companyId ? d.companyById.get(o.companyId)?.name : '';
    const contact = o.contactId ? d.contactById.get(o.contactId) : undefined;
    return matches(f.q, [o.name, company, contact ? fullName(contact) : '', o.nextStep, o.notes]);
  }), [d, f]);

  return { f, set, filtered, active, clear: () => setF(EMPTY) };
}
