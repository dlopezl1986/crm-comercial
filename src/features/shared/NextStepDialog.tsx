import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { NEXT_STEP_PRESETS } from '@/domain/labels';
import { addDays, fromInputs, toDateInput, toTimeInput, tsToDate } from '@/lib/dates';
import type { Timestamp } from 'firebase/firestore';

interface Props {
  title?: string;
  initialStep?: string;
  initialAt?: Timestamp | null;
  onSave: (step: string | null, at: Timestamp | null) => Promise<void>;
  onClose: () => void;
}

/** Editor del próximo paso: acción + fecha (atajos Hoy / Mañana / +3 días / +1 semana). */
export function NextStepDialog({ title = 'Próximo paso', initialStep = '', initialAt, onSave, onClose }: Props) {
  const [step, setStep] = useState(initialStep);
  const [date, setDate] = useState(toDateInput(initialAt) || toDateInput(new Date()));
  const [time, setTime] = useState(toTimeInput(initialAt) || '');
  const [busy, setBusy] = useState(false);
  const base = tsToDate(initialAt) ?? new Date();
  void base;

  const quick = (days: number) => setDate(toDateInput(addDays(new Date(), days)));
  const save = async (clear = false) => {
    setBusy(true);
    try {
      await onSave(clear ? null : step.trim() || null, clear ? null : fromInputs(date, time));
      onClose();
    } finally { setBusy(false); }
  };

  return (
    <Modal title={title} onClose={onClose} width={520} footer={
      <>
        {initialStep && <button className="btn btn--ghost" onClick={() => save(true)} disabled={busy}>Quitar próximo paso</button>}
        <span style={{ flex: 1 }} />
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={() => save()} disabled={busy || !step.trim() || !date}>
          {busy ? <Spinner size={16} /> : 'Guardar'}
        </button>
      </>
    }>
      <div className="stack">
        <div className="chips">
          {NEXT_STEP_PRESETS.map((p) => (
            <button type="button" key={p} className={`chip ${step === p ? 'chip--on' : ''}`} onClick={() => setStep(p)}>{p}</button>
          ))}
        </div>
        <label className="field"><span>Acción</span>
          <input value={step} onChange={(e) => setStep(e.target.value)} placeholder="¿Qué hay que hacer?" autoFocus />
        </label>
        <div className="row">
          <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Hora (opcional)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <div className="chips">
          <button type="button" className="chip" onClick={() => quick(0)}>Hoy</button>
          <button type="button" className="chip" onClick={() => quick(1)}>Mañana</button>
          <button type="button" className="chip" onClick={() => quick(3)}>+3 días</button>
          <button type="button" className="chip" onClick={() => quick(7)}>+1 semana</button>
          <button type="button" className="chip" onClick={() => quick(14)}>+2 semanas</button>
        </div>
      </div>
    </Modal>
  );
}
