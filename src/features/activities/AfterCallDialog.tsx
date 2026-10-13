import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { CALL_RESULTS } from '@/domain/labels';
import { addDays, fromInputs, toDateInput } from '@/lib/dates';
import { changeStage, saveActivity, setNextStep } from '@/services/crm';
import { updateItem } from '@/services/repository';
import type { ActivityType, CallResult, LossReason } from '@/types/models';
import { LossDialog } from '@/features/opportunities/LossDialog';

interface Links { companyId: string | null; contactId: string | null; opportunityId: string | null; leadId: string | null }

type Choice = { key: string; label: string; step: string; type: ActivityType; days: number };

const CHOICES: Choice[] = [
  { key: 'call', label: 'Llamar de nuevo', step: 'Llamar al cliente', type: 'call', days: 2 },
  { key: 'email', label: 'Enviar email', step: 'Enviar email', type: 'email', days: 0 },
  { key: 'meeting', label: 'Concertar reunión', step: 'Concertar reunión', type: 'meeting', days: 1 },
  { key: 'quote', label: 'Enviar presupuesto', step: 'Enviar presupuesto', type: 'task', days: 1 },
  { key: 'demo', label: 'Hacer demo', step: 'Hacer demo', type: 'demo', days: 3 },
  { key: 'follow', label: 'Hacer seguimiento', step: 'Hacer seguimiento', type: 'follow_up', days: 7 },
];

/** Sugerencia según el resultado de la llamada. */
const SUGGEST: Partial<Record<CallResult, string>> = {
  no_answer: 'call', reception: 'call', call_later: 'call', interested: 'email',
  wants_meeting: 'meeting', wants_quote: 'quote', decision_maker: 'follow',
};

/**
 * "Llamada realizada. ¿Próximo paso?"
 * - Con oportunidad o lead: guarda el próximo paso en ella (aparece en Próximos pasos).
 * - Sin ellas: crea una actividad pendiente en la agenda.
 * - "Marcar como perdido": pide motivo (oportunidad) o descarta el lead.
 */
export function AfterCallDialog({ result, links, onClose }: { result: CallResult | null; links: Links; onClose: () => void }) {
  const ctx = useSession();
  const toast = useToast();
  const { opportunityById, leadById, companyById } = useData();
  const opp = links.opportunityId ? opportunityById.get(links.opportunityId) : undefined;
  const lead = links.leadId ? leadById.get(links.leadId) : undefined;
  const suggested = result ? SUGGEST[result] : undefined;
  const [choice, setChoice] = useState<Choice | null>(CHOICES.find((c) => c.key === suggested) ?? null);
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(toDateInput(addDays(new Date(), choice?.days ?? 1)));
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const [losing, setLosing] = useState(false);

  const target = opp ? `la oportunidad "${opp.name}"` : lead ? `el lead "${lead.title}"`
    : links.companyId ? companyById.get(links.companyId)?.name ?? 'la empresa' : 'la agenda';

  const pick = (c: Choice) => { setChoice(c); setCustom(''); setDate(toDateInput(addDays(new Date(), c.days))); };

  const save = async () => {
    const step = custom.trim() || choice?.step;
    if (!step) return;
    setBusy(true);
    try {
      const at = fromInputs(date, time) ?? Timestamp.now();
      if (opp) await setNextStep(ctx, 'opportunities', opp.id, step, at);
      else if (lead) await setNextStep(ctx, 'leads', lead.id, step, at);
      else {
        await saveActivity(ctx, {
          type: choice?.type ?? 'task', title: step, dueAt: at, status: 'pending',
          companyId: links.companyId, contactId: links.contactId, opportunityId: null, leadId: null,
        });
      }
      toast('Próximo paso guardado');
      onClose();
    } catch (e) { console.error(e); toast('No se pudo guardar', 'error'); } finally { setBusy(false); }
  };

  const markLost = async (reason: LossReason, notes: string) => {
    if (opp) await changeStage(ctx, opp, 'lost', { lossReason: reason, lossNotes: notes });
    toast('Marcada como perdida');
    onClose();
  };
  const disqualifyLead = async () => {
    if (!lead) return;
    await updateItem(ctx.orgId, 'leads', lead.id, { status: 'disqualified', nextStep: null, nextStepAt: null });
    toast('Lead descartado');
    onClose();
  };

  if (losing && opp) return <LossDialog name={opp.name} onConfirm={markLost} onClose={() => setLosing(false)} />;

  return (
    <Modal title="Actividad registrada. ¿Próximo paso?" onClose={onClose} width={560} footer={
      <>
        <button className="btn btn--ghost" onClick={onClose} disabled={busy}>Sin próximo paso</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn--primary" onClick={save} disabled={busy || !(custom.trim() || choice) || !date}>
          {busy ? <Spinner size={16} /> : 'Guardar próximo paso'}
        </button>
      </>
    }>
      <div className="stack">
        {result && <p className="muted">Resultado: <strong>{CALL_RESULTS[result]}</strong>. Se guardará en {target}.</p>}
        {!result && <p className="muted">Se guardará en {target}.</p>}
        <div className="chips">
          {CHOICES.map((c) => (
            <button key={c.key} type="button" className={`chip ${choice?.key === c.key && !custom ? 'chip--on' : ''}`} onClick={() => pick(c)}>{c.label}</button>
          ))}
          {opp && <button type="button" className="chip chip--danger" onClick={() => setLosing(true)}>Marcar como perdido</button>}
          {lead && !opp && <button type="button" className="chip chip--danger" onClick={disqualifyLead}>Descartar lead</button>}
        </div>
        <label className="field"><span>Otro</span>
          <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Escribe otro próximo paso…" />
        </label>
        <div className="row">
          <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Hora (opcional)</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
      </div>
    </Modal>
  );
}
