import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner, FullScreenLoader } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { bulkUpdate, createItem, deleteItem, updateItem } from '@/services/repository';
import { money, num } from '@/lib/format';
import type { Service } from '@/types/models';

export function ServicesPage() {
  const { services, opportunities, ready } = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [editing, setEditing] = useState<Service | 'new' | null>(null);
  const [removing, setRemoving] = useState<Service | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, { count: number; won: number }>();
    opportunities.forEach((o) => o.serviceIds?.forEach((s) => {
      const u = m.get(s) ?? { count: 0, won: 0 };
      u.count++;
      if (o.stage === 'won') u.won += o.value ?? 0;
      m.set(s, u);
    }));
    return m;
  }, [opportunities]);

  const move = async (i: number, dir: -1 | 1) => {
    const a = services[i], b = services[i + dir];
    if (!a || !b) return;
    await bulkUpdate(orgId, 'services', [{ id: a.id, data: { order: b.order } }, { id: b.id, data: { order: a.order } }]);
  };

  if (!ready) return <FullScreenLoader />;

  return (
    <>
      <PageHeader title="Servicios" subtitle="Catálogo de servicios y productos que ofreces"
        actions={<button className="btn btn--primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo servicio</button>} />
      <div className="card card--flush">
        {!services.length ? <EmptyState icon={Package} title="Sin servicios">Crea tu catálogo.</EmptyState> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th></th><th>Servicio</th><th>Descripción</th><th className="num">Precio orientativo</th><th className="num">Oportunidades</th><th className="num">Ganado</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              {services.map((s, i) => (
                <tr key={s.id} className={s.active ? '' : 'row--muted'}>
                  <td className="nowrap">
                    <button className="icon-btn icon-btn--sm" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Subir"><ArrowUp size={14} /></button>
                    <button className="icon-btn icon-btn--sm" disabled={i === services.length - 1} onClick={() => move(i, 1)} aria-label="Bajar"><ArrowDown size={14} /></button>
                  </td>
                  <td className="strong">{s.name}</td>
                  <td className="muted">{s.description}</td>
                  <td className="num">{money(s.price)}</td>
                  <td className="num">{num(usage.get(s.id)?.count ?? 0)}</td>
                  <td className="num">{money(usage.get(s.id)?.won ?? 0)}</td>
                  <td>
                    <label className="switch">
                      <input type="checkbox" checked={s.active} onChange={(e) => updateItem<Service>(orgId, 'services', s.id, { active: e.target.checked })} />
                      <span>{s.active ? 'Activo' : 'Inactivo'}</span>
                    </label>
                  </td>
                  <td className="nowrap">
                    <button className="icon-btn" onClick={() => setEditing(s)} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="icon-btn" onClick={() => setRemoving(s)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {editing && <ServiceForm service={editing === 'new' ? undefined : editing} nextOrder={services.length} onClose={() => setEditing(null)}
        onSave={async (data) => {
          if (editing === 'new') await createItem<Service>(orgId, 'services', uid, data);
          else await updateItem<Service>(orgId, 'services', editing.id, data);
          toast('Servicio guardado');
        }} />}
      {removing && (
        <ConfirmDialog title="Eliminar servicio" danger confirmLabel="Eliminar" onClose={() => setRemoving(null)}
          onConfirm={async () => { await deleteItem(orgId, 'services', removing.id); toast('Servicio eliminado'); }}>
          ¿Eliminar <strong>{removing.name}</strong>? {usage.get(removing.id)?.count ? 'Está en uso: mejor desactívalo para conservar el histórico.' : ''}
        </ConfirmDialog>
      )}
    </>
  );
}

function ServiceForm({ service, nextOrder, onSave, onClose }: {
  service?: Service; nextOrder: number; onClose: () => void;
  onSave: (d: Pick<Service, 'name' | 'description' | 'price' | 'active' | 'order'>) => Promise<void>;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [price, setPrice] = useState(service?.price != null ? String(service.price) : '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined, price: price.trim() ? Number(price.replace(',', '.')) : null, active: service?.active ?? true, order: service?.order ?? nextOrder });
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Modal title={service ? 'Editar servicio' : 'Nuevo servicio'} onClose={onClose} width={480} footer={
      <><button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !name.trim()}>{busy ? <Spinner size={16} /> : 'Guardar'}</button></>
    }>
      <div className="stack">
        <label className="field"><span>Nombre *</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <label className="field"><span>Descripción</span><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        <label className="field"><span>Precio orientativo (€, opcional)</span><input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
