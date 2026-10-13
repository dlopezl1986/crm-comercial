import { useState } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { CompanyPicker, ContactPicker, OpportunityPicker } from '@/components/form/pickers';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { ACTIVITY_META, ACTIVITY_TYPES, CALL_RESULTS } from '@/domain/labels';
import { fromInputs, toDateInput, toTimeInput } from '@/lib/dates';
import { advanceLeadAfterCall, saveActivity, setNextStep, type ActivityInput } from '@/services/crm';
import type { Activity, ActivityType, CallResult } from '@/types/models';
import { AfterCallDialog } from './AfterCallDialog';

export interface ActivityDefaults {
  type?: ActivityType;
  title?: string;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  leadId?: string | null;
  dueAt?: Date;
  status?: Activity['status'];
  /** Al guardar, se considera cumplido el próximo paso de esta oportunidad/lead (se vacía). */
  completes?: { col: 'opportunities' | 'leads'; id: string };
}

interface Props {
  activity?: Activity;
  defaults?: ActivityDefaults;
  onClose: () => void;
}

/**
 * Alta/edición de actividades. Las llamadas piden resultado y, al guardarlas como hechas,
 * se abre el asistente "¿Próximo paso?".
 */
export function ActivityDialog({ activity, defaults = {}, onClose }: Props) {
  const ctx = useSession();
  const toast = useToast();
  const { opportunityById, leadById } = useData();
  const init = activity ?? defaults;
  const initDue = activity?.dueAt ?? (defaults.dueAt ? Timestamp.fromDate(defaults.dueAt) : Timestamp.now());

  const [type, setType] = useState<ActivityType>(init.type ?? 'call');
  const [title, setTitle] = useState(init.title ?? '');
  const [description, setDescription] = useState(activity?.description ?? '');
  const [date, setDate] = useState(toDateInput(initDue));
  const [time, setTime] = useState(toTimeInput(initDue));
  const [status, setStatus] = useState<Activity['status']>(init.status ?? (activity ? activity.status : 'done'));
  const [result, setResult] = useState<CallResult | ''>(activity?.result ?? '');
  const [companyId, setCompanyId] = useState(init.companyId ?? null);
  const [contactId, setContactId] = useState(init.contactId ?? null);
  const [opportunityId, setOpportunityId] = useState(init.opportunityId ?? null);
  const leadId = init.leadId ?? null;
  const [busy, setBusy] = useState(false);
  const [afterCall, setAfterCall] = useState<{ result: CallResult | null } | null>(null);

  // Al elegir oportunidad, completa empresa/contacto si están vacíos.
  const pickOpportunity = (id: string | null) => {
    setOpportunityId(id);
    const o = id ? opportunityById.get(id) : null;
    if (o) { if (!companyId) setCompanyId(o.companyId ?? null); if (!contactId) setContactId(o.contactId ?? null); }
  };

  const save = async () => {
    setBusy(true);
    try {
      const data: ActivityInput = {
        type,
        title: title.trim() || ACTIVITY_META[type].label,
        description: description.trim() || undefined,
        dueAt: fromInputs(date, time) ?? Timestamp.now(),
        status,
        result: type === 'call' && result ? result : null,
        companyId, contactId, opportunityId, leadId,
      };
      await saveActivity(ctx, data, activity?.id);
      if (type === 'call' && status === 'done' && leadId) await advanceLeadAfterCall(ctx, leadById.get(leadId), result || null);
      if (defaults.completes && status === 'done') await setNextStep(ctx, defaults.completes.col, defaults.completes.id, null, null);
      toast(activity ? 'Actividad actualizada' : 'Actividad registrada');
      const comms = type === 'call' || type === 'email' || type === 'meeting' || type === 'demo';
      if (!activity && status === 'done' && (comms || opportunityId || leadId)) {
        setAfterCall({ result: type === 'call' && result ? result : null });
      } else onClose();
    } catch (e) {
      console.error(e);
      toast('No se pudo guardar la actividad', 'error');
    } finally { setBusy(false); }
  };

  if (afterCall) {
    return <AfterCallDialog result={afterCall.result} links={{ companyId, contactId, opportunityId, leadId }} onClose={onClose} />;
  }

  return (
    <Modal title={activity ? 'Editar actividad' : 'Registrar actividad'} onClose={onClose} width={600} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        <div className="type-picker">
          {ACTIVITY_TYPES.map((t) => {
            const M = ACTIVITY_META[t];
            return (
              <button type="button" key={t} className={`type-picker__item ${type === t ? 'active' : ''}`} onClick={() => setType(t)}
                style={{ '--c': M.color } as React.CSSProperties}>
                <M.icon size={16} /> {M.label}
              </button>
            );
          })}
        </div>
        <label className="field"><span>Título</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ACTIVITY_META[type].label} autoFocus />
        </label>
        <div className="row">
          <label className="field"><span>Fecha</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field"><span>Hora</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <label className="field"><span>Estado</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as Activity['status'])}>
              <option value="done">Hecha</option>
              <option value="pending">Pendiente</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </label>
        </div>
        {type === 'call' && (
          <div className="field"><span>Resultado de la llamada</span>
            <div className="chips">
              {(Object.keys(CALL_RESULTS) as CallResult[]).map((r) => (
                <button type="button" key={r} className={`chip ${result === r ? 'chip--on' : ''}`} onClick={() => setResult(result === r ? '' : r)}>{CALL_RESULTS[r]}</button>
              ))}
            </div>
          </div>
        )}
        <label className="field"><span>Descripción / notas</span>
          <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="row">
          <div className="field"><span>Empresa</span><CompanyPicker value={companyId} onChange={setCompanyId} /></div>
          <div className="field"><span>Contacto</span><ContactPicker value={contactId} onChange={setContactId} companyId={companyId} /></div>
        </div>
        <div className="field"><span>Oportunidad</span><OpportunityPicker value={opportunityId} onChange={pickOpportunity} /></div>
      </div>
    </Modal>
  );
}
