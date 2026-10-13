import { useState } from 'react';
import { Database, FlaskConical, Undo2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { bulkUpdate, updateItem } from '@/services/repository';
import { clearDemoData, demoCount, loadDemoData } from '@/services/demoData';
import { formatDateTime } from '@/lib/dates';
import { num } from '@/lib/format';
import type { ImportRecord } from '@/types/models';
import { RegroupBanner } from './RegroupSectors';

export function DataSettings() {
  const d = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'clear' | ImportRecord | null>(null);
  const demo = demoCount(d);

  const load = async () => {
    setBusy(true);
    try { await loadDemoData(orgId, uid, d.services.map((s) => s.id)); toast('Datos de demostración cargados'); }
    catch (e) { console.error(e); toast('No se pudieron cargar', 'error'); } finally { setBusy(false); }
  };

  const undo = async (imp: ImportRecord) => {
    for (const col of ['companies', 'contacts', 'leads', 'activities'] as const) {
      const ids = (d[col] as { id: string; importBatch?: string }[]).filter((x) => x.importBatch === imp.batch).map((x) => ({ id: x.id, data: { deleted: true } }));
      if (ids.length) await bulkUpdate(orgId, col, ids);
    }
    await updateItem<ImportRecord>(orgId, 'imports', imp.id, { undone: true });
    toast('Importación deshecha');
  };

  return (
    <div className="settings">
      <RegroupBanner />
      <Card title="Datos de demostración" icon={FlaskConical}>
        <p className="muted">Empresas, oportunidades y actividades ficticias para probar el dashboard, el pipeline, los gráficos y el calendario.
          Van marcadas como demo y con la etiqueta <span className="tag">Demo</span>; se eliminan todas de golpe sin tocar tus datos reales.</p>
        <div className="inline">
          {demo === 0
            ? <button className="btn btn--primary" onClick={load} disabled={busy}>{busy ? <Spinner size={16} /> : 'Cargar datos de demostración'}</button>
            : <button className="btn btn--danger" onClick={() => setConfirm('clear')}>Eliminar {num(demo)} registros de demostración</button>}
        </div>
      </Card>
      <Card title="Importaciones" icon={Database}>
        {!d.imports.length ? <p className="muted small">Aún no has importado nada.</p> : (
          <table className="table table--compact">
            <thead><tr><th>Archivo</th><th>Fecha</th><th className="num">Empresas</th><th className="num">Fusionadas</th><th className="num">Contactos</th><th className="num">Leads</th><th></th></tr></thead>
            <tbody>{[...d.imports].sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)).map((i) => (
              <tr key={i.id} className={i.undone ? 'row--muted' : ''}>
                <td>{i.fileName}</td><td className="nowrap">{formatDateTime(i.createdAt)}</td>
                <td className="num">{num(i.companiesCreated)}</td><td className="num">{num(i.companiesMerged)}</td>
                <td className="num">{num(i.contactsCreated)}</td><td className="num">{num(i.leadsCreated)}</td>
                <td>{i.undone ? <span className="muted small">Deshecha</span> : <button className="btn btn--ghost btn--sm" onClick={() => setConfirm(i)}><Undo2 size={14} /> Deshacer</button>}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
      {confirm === 'clear' && <ConfirmDialog title="Eliminar datos de demostración" danger confirmLabel="Eliminar" onClose={() => setConfirm(null)}
        onConfirm={async () => { await clearDemoData(orgId, d); toast('Datos de demostración eliminados'); }}>
        Se eliminarán {num(demo)} registros marcados como demo. Tus datos reales no se tocan.</ConfirmDialog>}
      {confirm && confirm !== 'clear' && <ConfirmDialog title="Deshacer importación" danger confirmLabel="Deshacer" onClose={() => setConfirm(null)}
        onConfirm={() => undo(confirm)}>
        Se eliminarán las empresas, contactos, leads y notas creados por <strong>{confirm.fileName}</strong> (también si los has editado después).
        Las fusiones con empresas existentes se mantienen.</ConfirmDialog>}
    </div>
  );
}
