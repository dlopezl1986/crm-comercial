import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData, type DataState } from '@/data/DataProvider';
import { bulkUpdate, createItem, deleteItem, updateItem } from '@/services/repository';
import { TAG_COLORS } from '@/domain/labels';
import { num } from '@/lib/format';
import type { Tag } from '@/types/models';

const TAGGABLE = ['companies', 'contacts', 'leads', 'opportunities'] as const;

/** Renombra o elimina una etiqueta en todos los registros que la usan. */
async function replaceTag(orgId: string, d: DataState, from: string, to: string | null) {
  for (const col of TAGGABLE) {
    const updates = (d[col] as { id: string; tags?: string[] }[]).filter((x) => x.tags?.includes(from)).map((x) => ({
      id: x.id,
      data: { tags: [...new Set(x.tags!.flatMap((t) => (t === from ? (to ? [to] : []) : [t])))] },
    }));
    if (updates.length) await bulkUpdate(orgId, col, updates);
  }
}

export function TagsSettings() {
  const d = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [editing, setEditing] = useState<{ name: string; tag?: Tag } | 'new' | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    TAGGABLE.forEach((c) => (d[c] as { tags?: string[] }[]).forEach((x) => x.tags?.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1))));
    return m;
  }, [d]);
  const registry = new Map(d.tags.map((t) => [t.name, t]));

  return (
    <>
      <div className="section-head">
        <p className="muted">Etiquetas usadas en empresas, contactos, leads y oportunidades. Renombrar o eliminar aquí afecta a todos los registros.</p>
        <button className="btn btn--primary" onClick={() => setEditing('new')}><Plus size={16} /> Nueva etiqueta</button>
      </div>
      <div className="card card--flush">
        <table className="table">
          <thead><tr><th>Etiqueta</th><th className="num">Registros</th><th></th></tr></thead>
          <tbody>
            {d.allTags.map((name) => {
              const tag = registry.get(name);
              return (
                <tr key={name}>
                  <td><span className="tag" style={tag ? { background: `color-mix(in srgb, ${tag.color} 16%, transparent)`, color: tag.color } : undefined}>{name}</span></td>
                  <td className="num">{num(usage.get(name) ?? 0)}</td>
                  <td className="nowrap" style={{ textAlign: 'right' }}>
                    <button className="icon-btn" onClick={() => setEditing({ name, tag })} aria-label="Editar"><Pencil size={15} /></button>
                    <button className="icon-btn" onClick={() => setRemoving(name)} aria-label="Eliminar"><Trash2 size={15} /></button>
                  </td>
                </tr>
              );
            })}
            {!d.allTags.length && <tr><td colSpan={3} className="muted">Aún no hay etiquetas.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <TagForm initial={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={async (name, color) => {
        const prev = editing === 'new' ? undefined : editing;
        if (prev && prev.name !== name) await replaceTag(orgId, d, prev.name, name);
        if (prev?.tag) await updateItem<Tag>(orgId, 'tags', prev.tag.id, { name, color });
        else await createItem<Tag>(orgId, 'tags', uid, { name, color });
        toast('Etiqueta guardada');
      }} />}
      {removing && <ConfirmDialog title="Eliminar etiqueta" danger confirmLabel="Eliminar" onClose={() => setRemoving(null)} onConfirm={async () => {
        await replaceTag(orgId, d, removing, null);
        const t = registry.get(removing);
        if (t) await deleteItem(orgId, 'tags', t.id);
        toast('Etiqueta eliminada');
      }}>Se quitará <strong>{removing}</strong> de {num(usage.get(removing) ?? 0)} registros.</ConfirmDialog>}
    </>
  );
}

function TagForm({ initial, onSave, onClose }: { initial?: { name: string; tag?: Tag }; onSave: (name: string, color: string) => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [color, setColor] = useState(initial?.tag?.color ?? TAG_COLORS[0]);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={initial ? 'Editar etiqueta' : 'Nueva etiqueta'} onClose={onClose} width={420} footer={
      <><button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn--primary" disabled={busy || !name.trim()} onClick={async () => { setBusy(true); try { await onSave(name.trim(), color); onClose(); } finally { setBusy(false); } }}>
          {busy ? <Spinner size={16} /> : 'Guardar'}</button></>
    }>
      <div className="stack">
        <label className="field"><span>Nombre</span><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></label>
        <div className="field"><span>Color</span>
          <div className="chips">{TAG_COLORS.map((c) => <button key={c} type="button" className={`swatch ${c === color ? 'swatch--on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />)}</div>
        </div>
      </div>
    </Modal>
  );
}
