import { useState, type ReactNode } from 'react';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel = 'Confirmar', danger, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await onConfirm(); onClose(); } finally { setBusy(false); }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      width={440}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={run} disabled={busy}>
            {busy ? <Spinner size={16} /> : confirmLabel}
          </button>
        </>
      }
    >
      <div className="muted">{children}</div>
    </Modal>
  );
}
