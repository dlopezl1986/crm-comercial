import { useMemo } from 'react';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { SECTORS } from '@/domain/sectors';
import type { Company } from '@/types/models';

/** Filtros Sector → Subsector, de selección múltiple (los subsectores se limitan a los sectores elegidos). */
export function SectorFilters({ companies, sectors, subsectors, onSectors, onSubsectors }: {
  companies: Company[]; sectors: string[]; subsectors: string[]; onSectors: (v: string[]) => void; onSubsectors: (v: string[]) => void;
}) {
  const sectorOptions = useMemo(() => {
    const m = new Map<string, number>();
    companies.forEach((c) => c.sector && m.set(c.sector, (m.get(c.sector) ?? 0) + 1));
    return SECTORS.filter((s) => m.has(s)).map((s) => ({ value: s, label: s, count: m.get(s) }));
  }, [companies]);
  const subsectorOptions = useMemo(() => {
    const m = new Map<string, number>();
    companies.filter((c) => !sectors.length || sectors.includes(c.sector ?? '')).forEach((c) => c.subsector && m.set(c.subsector, (m.get(c.subsector) ?? 0) + 1));
    return [...m].sort((a, b) => a[0].localeCompare(b[0], 'es')).map(([value, count]) => ({ value, label: value, count }));
  }, [companies, sectors]);
  const setSectors = (v: string[]) => {
    onSectors(v);
    // Se quitan los subsectores que ya no pertenecen a los sectores elegidos.
    if (v.length) onSubsectors(subsectors.filter((s) => companies.some((c) => c.subsector === s && v.includes(c.sector ?? ''))));
  };
  return (
    <>
      <MultiSelect label="Sector" values={sectors} onChange={setSectors} options={sectorOptions} />
      <MultiSelect label="Subsector" values={subsectors} onChange={onSubsectors} options={subsectorOptions} />
    </>
  );
}

/** "Sector · Subsector" para mostrar. */
export const sectorLabel = (c?: { sector?: string; subsector?: string } | null) =>
  [c?.sector, c?.subsector].filter(Boolean).join(' · ');
