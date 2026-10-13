import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { LOSS_REASONS } from '@/domain/labels';
import type { LossReason } from '@/types/models';

/** Pide el motivo de pérdida (obligatorio) antes de marcar una oportunidad como perdida. */
export function LossDialog({ name, onConfirm, onClose }: {
  name: string; onConfirm: (reason: LossReason, notes: string) => Promise<void>; onClose: () => void;
}) {
  const [reason, setReason] = useState<LossReason | ''>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!reason) return;
    setBusy(true);
    try { await onConfirm(reason, notes.trim()); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal title="Marcar como perdida" onClose={onClose} width={480} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--danger" onClick={run} disabled={busy || !reason}>{busy ? <Spinner size={16} /> : 'Marcar como perdida'}</button>
      </>
    }>
      <div className="stack">
        <p className="muted">¿Por qué se ha perdido <strong>{name}</strong>?</p>
        <div className="chips">
          {(Object.keys(LOSS_REASONS) as LossReason[]).map((r) => (
            <button type="button" key={r} className={`chip ${reason === r ? 'chip--on' : ''}`} onClick={() => setReason(r)}>{LOSS_REASONS[r]}</button>
          ))}
        </div>
        <label className="field"><span>Notas (opcional)</span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
      </div>
    </Modal>
  );
}
