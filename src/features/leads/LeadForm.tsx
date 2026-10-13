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
import { createItem, updateItem } from '@/services/repository';
import { LEAD_STATUS } from '@/domain/labels';
import { CustomFieldsEditor } from '@/features/customFields/CustomFieldsEditor';
import { fromInputs, toDateInput } from '@/lib/dates';
import type { Lead, LeadStatus } from '@/types/models';

export function LeadForm({ lead, defaults, onClose }: { lead?: Lead; defaults?: { companyId?: string; contactId?: string }; onClose: () => void }) {
  const { orgId, uid } = useSession();
  const { allTags, companyById } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [title, setTitle] = useState(lead?.title ?? '');
  const [companyId, setCompanyId] = useState(lead?.companyId ?? defaults?.companyId ?? null);
  const [contactId, setContactId] = useState(lead?.contactId ?? defaults?.contactId ?? null);
  const [status, setStatus] = useState<LeadStatus>(lead?.status ?? 'new');
  const [source, setSource] = useState(lead?.source ?? '');
  const [nextStep, setNextStep] = useState(lead?.nextStep ?? '');
  const [nextDate, setNextDate] = useState(toDateInput(lead?.nextStepAt));
  const [notes, setNotes] = useState(lead?.notes ?? '');
  const [tags, setTags] = useState<string[]>(lead?.tags ?? []);
  const [custom, setCustom] = useState<Record<string, unknown>>(lead?.custom ?? {});
  const [busy, setBusy] = useState(false);
  const effectiveTitle = title.trim() || (companyId ? companyById.get(companyId)?.name ?? '' : '');

  const save = async () => {
    if (!effectiveTitle) return;
    setBusy(true);
    const data = {
      title: effectiveTitle, companyId, contactId, status, source: source.trim() || undefined,
      nextStep: nextStep.trim() || undefined, nextStepAt: nextStep.trim() ? fromInputs(nextDate || toDateInput(new Date())) : null,
      notes: notes.trim() || undefined, tags, custom,
    };
    try {
      if (lead) { await updateItem<Lead>(orgId, 'leads', lead.id, data); toast('Lead actualizado'); onClose(); }
      else { const id = await createItem<Lead>(orgId, 'leads', uid, data); toast('Lead creado'); onClose(); navigate(`/leads/${id}`); }
    } catch (e) { console.error(e); toast('No se pudo guardar el lead', 'error'); setBusy(false); }
  };

  return (
    <Modal title={lead ? 'Editar lead' : 'Nuevo lead'} onClose={onClose} width={680} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !effectiveTitle}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        <div className="form-grid">
          <Field label="Empresa"><CompanyPicker value={companyId} onChange={setCompanyId} /></Field>
          <Field label="Contacto"><ContactPicker value={contactId} onChange={setContactId} companyId={companyId} /></Field>
          <Field label="Título" wide><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={effectiveTitle || 'Nombre del lead'} autoFocus /></Field>
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus)}>
              {(Object.keys(LEAD_STATUS) as LeadStatus[]).filter((s) => s !== 'converted' || status === 'converted')
                .map((s) => <option key={s} value={s}>{LEAD_STATUS[s].label}</option>)}
            </select>
          </Field>
          <Field label="Fuente"><input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Prospección, web, referido…" /></Field>
          <Field label="Próximo paso"><input value={nextStep} onChange={(e) => setNextStep(e.target.value)} placeholder="Llamar al cliente" /></Field>
          <Field label="Fecha próximo paso"><input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} /></Field>
          <Field label="Etiquetas" wide><TagInput value={tags} onChange={setTags} suggestions={allTags} /></Field>
          <TextArea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <CustomFieldsEditor entity="lead" value={custom} onChange={setCustom} />
      </div>
    </Modal>
  );
}
