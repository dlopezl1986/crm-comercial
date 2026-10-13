import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Field, TextArea } from '@/components/form/Field';
import { TagInput } from '@/components/form/TagInput';
import { CompanyPicker, ContactPicker } from '@/components/form/pickers';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { saveOpportunity, type OpportunityInput } from '@/services/crm';
import { ALL_STAGES, LOSS_REASONS, NEXT_STEP_PRESETS, STAGE_META, isOpenStage } from '@/domain/labels';
import { CustomFieldsEditor } from '@/features/customFields/CustomFieldsEditor';
import { fromInputs, toDateInput, toTimeInput } from '@/lib/dates';
import { money, weighted } from '@/lib/format';
import type { LossReason, Opportunity, OpportunityStage } from '@/types/models';

interface Props {
  opportunity?: Opportunity;
  defaults?: Partial<Pick<Opportunity, 'companyId' | 'contactId' | 'name' | 'stage' | 'leadId'>>;
  onClose: () => void;
  /** Si se indica, en vez de guardar se entrega el resultado (conversión de lead). */
  onSubmit?: (data: OpportunityInput) => Promise<string>;
  title?: string;
}

const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')));

export function OpportunityForm({ opportunity: o, defaults = {}, onClose, onSubmit, title }: Props) {
  const ctx = useSession();
  const { services, allTags, companyById } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(o?.name ?? defaults.name ?? '');
  const [companyId, setCompanyId] = useState(o?.companyId ?? defaults.companyId ?? null);
  const [contactId, setContactId] = useState(o?.contactId ?? defaults.contactId ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>(o?.serviceIds ?? []);
  const [stage, setStage] = useState<OpportunityStage>(o?.stage ?? defaults.stage ?? 'new');
  const [value, setValue] = useState(o?.value != null ? String(o.value) : '');
  const [probability, setProbability] = useState(o?.probability != null ? String(o.probability) : String(STAGE_META[o?.stage ?? defaults.stage ?? 'new'].probability));
  const [closeDate, setCloseDate] = useState(toDateInput(o?.expectedCloseAt));
  const [nextStep, setNextStep] = useState(o?.nextStep ?? '');
  const [nextDate, setNextDate] = useState(toDateInput(o?.nextStepAt));
  const [nextTime, setNextTime] = useState(toTimeInput(o?.nextStepAt));
  const [lossReason, setLossReason] = useState<LossReason | ''>(o?.lossReason ?? '');
  const [lossNotes, setLossNotes] = useState(o?.lossNotes ?? '');
  const [notes, setNotes] = useState(o?.notes ?? '');
  const [tags, setTags] = useState<string[]>(o?.tags ?? []);
  const [custom, setCustom] = useState<Record<string, unknown>>(o?.custom ?? {});
  const [busy, setBusy] = useState(false);

  const w = weighted(numOrNull(value), numOrNull(probability));
  const changeStage = (s: OpportunityStage) => {
    setStage(s);
    // Sugerir la probabilidad típica de la etapa si el usuario no la había tocado.
    if (!o || probability === String(STAGE_META[stage].probability)) setProbability(String(STAGE_META[s].probability));
  };
  const toggleService = (id: string) => setServiceIds((xs) => xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  const valid = name.trim() && (stage !== 'lost' || lossReason);

  const save = async () => {
    if (!valid) return;
    setBusy(true);
    const data: OpportunityInput = {
      name: name.trim(), companyId, contactId, serviceIds, stage,
      value: numOrNull(value), probability: numOrNull(probability),
      expectedCloseAt: fromInputs(closeDate),
      nextStep: isOpenStage(stage) ? nextStep.trim() || undefined : undefined,
      nextStepAt: isOpenStage(stage) && nextStep.trim() ? fromInputs(nextDate || toDateInput(new Date()), nextTime) : null,
      lossReason: stage === 'lost' ? (lossReason as LossReason) : null,
      lossNotes: stage === 'lost' ? lossNotes.trim() : undefined,
      notes: notes.trim() || undefined, tags, custom,
      leadId: o?.leadId ?? defaults.leadId ?? null,
    };
    try {
      const id = onSubmit ? await onSubmit(data) : await saveOpportunity(ctx, data, o);
      toast(o ? 'Oportunidad actualizada' : 'Oportunidad creada');
      onClose();
      if (!o) navigate(`/oportunidades/${id}`);
    } catch (e) { console.error(e); toast('No se pudo guardar la oportunidad', 'error'); setBusy(false); }
  };

  const activeServices = services.filter((s) => s.active || serviceIds.includes(s.id));

  return (
    <Modal title={title ?? (o ? 'Editar oportunidad' : 'Nueva oportunidad')} onClose={onClose} width={760} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !valid}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        <div className="form-grid">
          <Field label="Nombre de la oportunidad *" wide>
            <input value={name} autoFocus onChange={(e) => setName(e.target.value)}
              placeholder={companyId ? `DocuWare para ${companyById.get(companyId)?.name ?? ''}` : 'Ej.: DocuWare Cloud para…'} />
          </Field>
          <Field label="Empresa"><CompanyPicker value={companyId} onChange={setCompanyId} /></Field>
          <Field label="Contacto principal"><ContactPicker value={contactId} onChange={setContactId} companyId={companyId} /></Field>
          <Field label="Estado">
            <select value={stage} onChange={(e) => changeStage(e.target.value as OpportunityStage)}>
              {ALL_STAGES.map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </select>
          </Field>
          <Field label="Fecha prevista de cierre"><input type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} /></Field>
          <Field label="Valor (€, opcional)"><input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder="8500" /></Field>
          <Field label="Probabilidad (%)"><input type="number" min={0} max={100} value={probability} onChange={(e) => setProbability(e.target.value)} /></Field>
          <div className="field field--wide"><span>Valor ponderado</span><div className="readonly-value">{w != null ? money(w) : 'Se calcula al indicar valor y probabilidad'}</div></div>
        </div>

        {stage === 'lost' && (
          <div className="form-grid">
            <Field label="Motivo de pérdida *">
              <select value={lossReason} onChange={(e) => setLossReason(e.target.value as LossReason)}>
                <option value="">Selecciona…</option>
                {(Object.keys(LOSS_REASONS) as LossReason[]).map((r) => <option key={r} value={r}>{LOSS_REASONS[r]}</option>)}
              </select>
            </Field>
            <Field label="Notas de la pérdida"><input value={lossNotes} onChange={(e) => setLossNotes(e.target.value)} /></Field>
          </div>
        )}

        <div className="field"><span>Servicios</span>
          <div className="chips">
            {activeServices.map((s) => (
              <button type="button" key={s.id} className={`chip ${serviceIds.includes(s.id) ? 'chip--on' : ''}`} onClick={() => toggleService(s.id)}>{s.name}</button>
            ))}
          </div>
        </div>

        {isOpenStage(stage) && (
          <div className="next-step-box">
            <div className="form-grid">
              <Field label="Próximo paso" wide>
                <input value={nextStep} onChange={(e) => setNextStep(e.target.value)} list="next-presets" placeholder="Ej.: Llamar al cliente" />
                <datalist id="next-presets">{NEXT_STEP_PRESETS.map((p) => <option key={p} value={p} />)}</datalist>
              </Field>
              <Field label="Fecha del próximo paso"><input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
              <Field label="Hora"><input type="time" value={nextTime} onChange={(e) => setNextTime(e.target.value)} /></Field>
            </div>
          </div>
        )}

        <div className="form-grid">
          <Field label="Etiquetas" wide><TagInput value={tags} onChange={setTags} suggestions={allTags} /></Field>
          <TextArea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <CustomFieldsEditor entity="opportunity" value={custom} onChange={setCustom} />
      </div>
    </Modal>
  );
}
