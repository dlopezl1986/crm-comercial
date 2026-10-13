import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { TextField, TextArea, Field } from '@/components/form/Field';
import { TagInput } from '@/components/form/TagInput';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { createItem, updateItem } from '@/services/repository';
import { CustomFieldsEditor } from '@/features/customFields/CustomFieldsEditor';
import { digits, norm, uniqueSorted } from '@/lib/text';
import type { Company } from '@/types/models';

const EMPTY = { name: '', cif: '', sector: '', city: '', province: '', address: '', email: '', phone: '', website: '', notes: '' };
type Values = typeof EMPTY;

/** Posibles duplicados de una empresa por CIF, email, teléfono o nombre. */
export function findCompanyDuplicates(companies: Company[], v: Partial<Values>, exceptId?: string) {
  const name = norm(v.name), email = norm(v.email), phone = digits(v.phone), cif = norm(v.cif).replace(/\W/g, '');
  return companies.filter((c) => c.id !== exceptId && (
    (cif && norm(c.cif).replace(/\W/g, '') === cif) ||
    (email && norm(c.email) === email) ||
    (phone.length >= 6 && digits(c.phone) === phone) ||
    (name && norm(c.name) === name)
  ));
}

export function CompanyForm({ company, onClose }: { company?: Company; onClose: () => void }) {
  const { orgId, uid } = useSession();
  const { companies, allTags } = useData();
  const toast = useToast();
  const navigate = useNavigate();
  const [v, setV] = useState<Values>(() => ({ ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (company as never)?.[k] ?? ''])) }));
  const [tags, setTags] = useState<string[]>(company?.tags ?? []);
  const [custom, setCustom] = useState<Record<string, unknown>>(company?.custom ?? {});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Values) => (e: { target: { value: string } }) => setV((s) => ({ ...s, [k]: e.target.value }));

  const sectors = useMemo(() => uniqueSorted(companies.map((c) => c.sector)), [companies]);
  const cities = useMemo(() => uniqueSorted(companies.map((c) => c.city)), [companies]);
  const dups = useMemo(() => findCompanyDuplicates(companies, v, company?.id).slice(0, 3), [companies, v, company?.id]);

  const save = async () => {
    if (!v.name.trim()) return;
    setBusy(true);
    const data = {
      ...Object.fromEntries(Object.entries(v).map(([k, x]) => [k, x.trim() || undefined])),
      name: v.name.trim(), tags, custom,
    } as Omit<Company, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'ownerId'>;
    try {
      if (company) {
        await updateItem<Company>(orgId, 'companies', company.id, data);
        toast('Empresa actualizada');
        onClose();
      } else {
        const id = await createItem<Company>(orgId, 'companies', uid, data);
        toast('Empresa creada');
        onClose();
        navigate(`/empresas/${id}`);
      }
    } catch (e) { console.error(e); toast('No se pudo guardar la empresa', 'error'); setBusy(false); }
  };

  return (
    <Modal title={company ? 'Editar empresa' : 'Nueva empresa'} onClose={onClose} width={720} footer={
      <>
        <button className="btn btn--secondary" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !v.name.trim()}>{busy ? <Spinner size={16} /> : 'Guardar'}</button>
      </>
    }>
      <div className="stack">
        {dups.length > 0 && (
          <div className="alert alert--warn"><AlertTriangle size={16} /> Posible duplicado: {dups.map((d) => d.name).join(', ')}</div>
        )}
        <div className="form-grid">
          <TextField label="Nombre *" value={v.name} onChange={set('name')} autoFocus wide />
          <TextField label="CIF" value={v.cif} onChange={set('cif')} />
          <TextField label="Sector" value={v.sector} onChange={set('sector')} options={sectors} />
          <TextField label="Email" type="email" value={v.email} onChange={set('email')} />
          <TextField label="Teléfono" value={v.phone} onChange={set('phone')} />
          <TextField label="Web" value={v.website} onChange={set('website')} />
          <TextField label="Ciudad" value={v.city} onChange={set('city')} options={cities} />
          <TextField label="Provincia" value={v.province} onChange={set('province')} />
          <TextField label="Dirección" value={v.address} onChange={set('address')} wide />
          <Field label="Etiquetas" wide><TagInput value={tags} onChange={setTags} suggestions={allTags} /></Field>
          <TextArea label="Notas" value={v.notes} onChange={set('notes')} />
        </div>
        <CustomFieldsEditor entity="company" value={custom} onChange={setCustom} />
      </div>
    </Modal>
  );
}
