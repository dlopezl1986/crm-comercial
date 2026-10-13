import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { Field, TextArea, TextField } from '@/components/form/Field';
import { TagInput } from '@/components/form/TagInput';
import { CompanyPicker } from '@/components/form/pickers';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { createItem, updateItem } from '@/services/repository';
import { CONTACT_PREFERENCE } from '@/domain/labels';
import { CustomFieldsEditor } from '@/features/customFields/CustomFieldsEditor';
import { digits, fullName, norm, uniqueSorted } from '@/lib/text';
import type { Contact, ContactPreference } from '@/types/models';

const EMPTY = { firstName: '', lastName: '', jobTitle: '', department: '', email: '', phone: '', mobile: '', linkedin: '', notes: '' };
type Values = typeof EMPTY;

interface Props { contact?: Contact; defaults?: { companyId?: string }; onClose: () => void; stay?: boolean }

export function ContactForm({ contact, defaults, onClose, stay }: Props) {
  const { orgId, uid } = useSession();
  const { contacts, allTags } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState<Values>(() => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (contact as never)?.[k] ?? ''])) }));
  const [companyId, setCompanyId] = useState<string | null>(contact?.companyId ?? defaults?.companyId ?? null);
  const [preference, setPreference] = useState<ContactPreference | ''>(contact?.preference ?? '');
  const [tags, setTags] = useState<string[]>(contact?.tags ?? []);
  const [custom, setCustom] = useState<Record<string, unknown>>(contact?.custom ?? {});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const jobTitles = useMemo(() => uniqueSorted(contacts.map((c) => c.jobTitle)), [contacts]);
  const departments = useMemo(() => uniqueSorted(contacts.map((c) => c.department)), [contacts]);
  const dups = useMemo(() => {
    const email = norm(v.email), phone = digits(v.phone || v.mobile);
    return contacts.filter((c) => c.id !== contact?.id && (
      (email && norm(c.email) === email) || (phone.length >= 6 && (digits(c.phone) === phone || digits(c.mobile) === phone)))).slice(0, 3);
  }, [contacts, v.email, v.phone, v.mobile, contact?.id]);

  const save = async () => {
    if (!v.firstName.trim()) return;
    setBusy(true);
    const data = {
      ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || undefined])),
      firstName: v.firstName.trim(), companyId, preference: preference || undefined, tags, custom,
    } as Omit<Contact, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerId'>;
    try {
      if (contact) {
        await updateItem<Contact>(orgId, 'contacts', contact.id, data);
        toast('Contacto actualizado');
        onClose();
      } else {
        const id = await createItem<Contact>(orgId, 'contacts', uid, data);
        toast('Contacto creado');
        onClose();
        if (!stay) navigate(`/contactos/${id}`);
      }
    } catch (e) { console.error(e); toast('No se pudo guardar el contacto', 'error'); setBusy(false); }
  };

  return (
    <Modal title={contact ? 'Editar contacto' : 'Nuevo contacto'} onClose={onClose} width={720} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !v.firstName.trim()}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        {dups.length > 0 && <div className="alert alert--warn"><AlertTriangle size={16} /> Posible duplicado: {dups.map(fullName).join(', ')}</div>}
        <div className="form-grid">
          <TextField label="Nombre *" value={v.firstName} onChange={set('firstName')} autoFocus />
          <TextField label="Apellidos" value={v.lastName} onChange={set('lastName')} />
          <Field label="Empresa" wide><CompanyPicker value={companyId} onChange={setCompanyId} /></Field>
          <TextField label="Cargo" value={v.jobTitle} onChange={set('jobTitle')} options={jobTitles} />
          <TextField label="Departamento" value={v.department} onChange={set('department')} options={departments} />
          <TextField label="Email" type="email" value={v.email} onChange={set('email')} />
          <TextField label="Teléfono" value={v.phone} onChange={set('phone')} />
          <TextField label="Móvil" value={v.mobile} onChange={set('mobile')} />
          <TextField label="LinkedIn" value={v.linkedin} onChange={set('linkedin')} />
          <Field label="Preferencia de contacto">
            <select value={preference} onChange={(e) => setPreference(e.target.value as ContactPreference)}>
              <option value="">—</option>
              {(Object.keys(CONTACT_PREFERENCE) as ContactPreference[]).map((p) => <option key={p} value={p}>{CONTACT_PREFERENCE[p]}</option>)}
            </select>
          </Field>
          <Field label="Etiquetas" wide><TagInput value={tags} onChange={setTags} suggestions={allTags} /></Field>
          <TextArea label="Notas" value={v.notes} onChange={set('notes')} />
        </div>
        <CustomFieldsEditor entity="contact" value={custom} onChange={setCustom} />
      </div>
    </Modal>
  );
}
