import { useMemo } from 'react';
import { FilterSelect } from '@/components/ui/Select';
import { SECTORS } from '@/domain/sectors';
import { uniqueSorted } from '@/lib/text';
import type { Company } from '@/types/models';

/** Filtros Sector → Subsector (los subsectores se limitan al sector elegido). */
export function SectorFilters({ companies, sector, subsector, onSector, onSubsector }: {
  companies: Company[]; sector: string; subsector: string; onSector: (v: string) => void; onSubsector: (v: string) => void;
}) {
  const sectors = useMemo(() => {
    const present = new Set(companies.map((c) => c.sector));
    return SECTORS.filter((s) => present.has(s));
  }, [companies]);
  const subsectors = useMemo(
    () => uniqueSorted(companies.filter((c) => !sector || c.sector === sector).map((c) => c.subsector)),
    [companies, sector],
  );
  return (
    <>
      <FilterSelect label="Sector" value={sector} onChange={(v) => { onSector(v); onSubsector(''); }} options={sectors.map((s) => ({ value: s, label: s }))} />
      <FilterSelect label="Subsector" value={subsector} onChange={onSubsector} options={subsectors.map((s) => ({ value: s, label: s }))} />
    </>
  );
}

/** "Sector · Subsector" para mostrar. */
export const sectorLabel = (c?: { sector?: string; subsector?: string } | null) =>
  [c?.sector, c?.subsector].filter(Boolean).join(' · ');
