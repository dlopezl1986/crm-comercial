import { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { bulkUpdate } from '@/services/repository';
import { resolveSector, SECTORS } from '@/domain/sectors';
import { num } from '@/lib/format';
import type { Company } from '@/types/models';

/** Empresas cuyo sector aún es una categoría detallada (anteriores a la agrupación). */
export function pendingRegroup(companies: Company[]) {
  return companies
    .map((c) => ({ c, r: resolveSector(c.sector, c.subsector) }))
    .filter(({ c, r }) => (c.sector || c.subsector) && (r.sector !== c.sector || (r.subsector ?? undefined) !== (c.subsector ?? undefined)));
}

function RegroupDialog({ onClose }: { onClose: () => void }) {
  const { companies } = useData();
  const { orgId } = useSession();
  const toast = useToast();
  const pending = useMemo(() => pendingRegroup(companies), [companies]);
  const bySector = useMemo(() => {
    const m = new Map<string, number>();
    pending.forEach(({ r }) => m.set(r.sector ?? 'Otros', (m.get(r.sector ?? 'Otros') ?? 0) + 1));
    return SECTORS.filter((s) => m.has(s)).map((s) => [s, m.get(s)!] as const);
  }, [pending]);
  return (
    <ConfirmDialog title="Agrupar sectores" confirmLabel={`Agrupar ${num(pending.length)} empresas`} onClose={onClose}
      onConfirm={async () => {
        await bulkUpdate(orgId, 'companies', pending.map(({ c, r }) => ({ id: c.id, data: { sector: r.sector, subsector: r.subsector } })));
        toast(`${num(pending.length)} empresas agrupadas por sector`);
      }}>
      <p>La categoría actual de cada empresa pasa a ser su <strong>subsector</strong> y se le asigna un <strong>sector</strong>:</p>
      <ul className="regroup-list">{bySector.map(([s, n]) => <li key={s}><span>{s}</span><strong>{num(n)}</strong></li>)}</ul>
    </ConfirmDialog>
  );
}

/** Aviso con botón cuando hay empresas sin agrupar. */
export function RegroupBanner() {
  const { companies, ready } = useData();
  const [open, setOpen] = useState(false);
  const n = useMemo(() => (ready ? pendingRegroup(companies).length : 0), [companies, ready]);
  if (!n) return null;
  return (
    <>
      <div className="alert alert--warn regroup-banner">
        <Layers size={16} /> {num(n)} empresas tienen su categoría como sector. Agrúpalas en sectores y subsectores para filtrar mejor.
        <button className="btn btn--primary btn--sm" onClick={() => setOpen(true)}>Agrupar sectores</button>
      </div>
      {open && <RegroupDialog onClose={() => setOpen(false)} />}
    </>
  );
}
