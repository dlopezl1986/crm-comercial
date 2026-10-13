import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { TagInput } from '@/components/form/TagInput';
import { useData } from '@/data/DataProvider';

/** Añade o quita etiquetas a varios registros. */
export function BulkTagDialog({ count, onApply, onClose }: {
  count: number; onApply: (add: string[], remove: string[]) => Promise<void>; onClose: () => void;
}) {
  const { allTags } = useData();
  const [add, setAdd] = useState<string[]>([]);
  const [remove, setRemove] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const run = async () => { setBusy(true); try { await onApply(add, remove); onClose(); } finally { setBusy(false); } };
  return (
    <Modal title={`Etiquetas de ${count} registros`} onClose={onClose} width={480} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={run} disabled={busy || (!add.length && !remove.length)}>{busy ? <Spinner size={16} /> : 'Aplicar'}</button>
      </>
    }>
      <div className="stack">
        <label className="field"><span>Añadir</span><TagInput value={add} onChange={setAdd} suggestions={allTags} /></label>
        <label className="field"><span>Quitar</span><TagInput value={remove} onChange={setRemove} suggestions={allTags} /></label>
      </div>
    </Modal>
  );
}

/** Calcula la nueva lista de etiquetas. */
export function applyTags(current: string[] | undefined, add: string[], remove: string[]) {
  const set = new Set(current ?? []);
  add.forEach((t) => set.add(t));
  remove.forEach((t) => set.delete(t));
  return [...set];
}
