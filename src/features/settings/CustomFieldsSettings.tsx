import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/Toast';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { createItem, deleteItem, updateItem } from '@/services/repository';
import type { CustomFieldDef, CustomFieldEntity, CustomFieldType } from '@/types/models';

const ENTITIES: Record<CustomFieldEntity, string> = { company: 'Empresa', contact: 'Contacto', lead: 'Lead', opportunity: 'Oportunidad' };
const TYPES: Record<CustomFieldType, string> = { text: 'Texto', number: 'Número', date: 'Fecha', select: 'Lista de opciones', boolean: 'Sí / No' };

export function CustomFieldsSettings() {
  const { customFields } = useData();
  const { orgId, uid } = useSession();
  const toast = useToast();
  const [editing, setEditing] = useState<CustomFieldDef | 'new' | null>(null);
  const [removing, setRemoving] = useState<CustomFieldDef | null>(null);

  return (
    <>
      <div className="section-head">
        <p className="muted">Campos propios que aparecen en los formularios y fichas (p. ej. Nº de empleados, ERP utilizado, Competidor, Fuente del lead).</p>
        <button className="btn btn--primary" onClick={() => setEditing('new')}><Plus size={16} /> Nuevo campo</button>
      </div>
      <div className="card card--flush">
        <table className="table">
          <thead><tr><th>Campo</th><th>Entidad</th><th>Tipo</th><th></th></tr></thead>
          <tbody>
            {customFields.map((f) => (
              <tr key={f.id}>
                <td className="strong">{f.label}</td><td>{ENTITIES[f.entity]}</td>
                <td className="muted">{TYPES[f.type]}{f.options?.length ? `: ${f.options.join(', ')}` : ''}</td>
                <td className="nowrap" style={{ textAlign: 'right' }}>
                  <button className="icon-btn" onClick={() => setEditing(f)} aria-label="Editar"><Pencil size={15} /></button>
                  <button className="icon-btn" onClick={() => setRemoving(f)} aria-label="Eliminar"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
            {!customFields.length && <tr><td colSpan={4} className="muted">Aún no hay campos personalizados.</td></tr>}
          </tbody>
        </table>
      </div>
      {editing && <FieldForm field={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSave={async (data) => {
        if (editing === 'new') await createItem<CustomFieldDef>(orgId, 'customFields', uid, { ...data, order: customFields.length });
        else await updateItem<CustomFieldDef>(orgId, 'customFields', editing.id, data);
        toast('Campo guardado');
      }} />}
      {removing && <ConfirmDialog title="Eliminar campo" danger confirmLabel="Eliminar" onClose={() => setRemoving(null)}
        onConfirm={async () => { await deleteItem(orgId, 'customFields', removing.id); toast('Campo eliminado'); }}>
        ¿Eliminar el campo <strong>{removing.label}</strong>? Dejará de mostrarse (los valores guardados no se borran).
      </ConfirmDialog>}
    </>
  );
}

function FieldForm({ field, onSave, onClose }: {
  field?: CustomFieldDef; onClose: () => void;
  onSave: (d: Pick<CustomFieldDef, 'label' | 'entity' | 'type' | 'options'>) => Promise<void>;
}) {
  const [label, setLabel] = useState(field?.label ?? '');
  const [entity, setEntity] = useState<CustomFieldEntity>(field?.entity ?? 'company');
  const [type, setType] = useState<CustomFieldType>(field?.type ?? 'text');
  const [options, setOptions] = useState(field?.options?.join(', ') ?? '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await onSave({ label: label.trim(), entity, type, options: type === 'select' ? options.split(',').map((o) => o.trim()).filter(Boolean) : undefined });
      onClose();
    } finally { setBusy(false); }
  };
  return (
    <Modal title={field ? 'Editar campo' : 'Nuevo campo personalizado'} onClose={onClose} width={480} footer={
      <><button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
        <button className="btn btn--primary" onClick={save} disabled={busy || !label.trim() || (type === 'select' && !options.trim())}>{busy ? <Spinner size={16} /> : 'Guardar'}</button></>
    }>
      <div className="stack">
        <label className="field"><span>Nombre del campo</span><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nº de empleados" autoFocus /></label>
        <div className="row">
          <label className="field"><span>Entidad</span><select value={entity} onChange={(e) => setEntity(e.target.value as CustomFieldEntity)} disabled={!!field}>
            {Object.entries(ENTITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="field"><span>Tipo</span><select value={type} onChange={(e) => setType(e.target.value as CustomFieldType)}>
            {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        {type === 'select' && <label className="field"><span>Opciones (separadas por comas)</span><input value={options} onChange={(e) => setOptions(e.target.value)} placeholder="SAP, Navision, Holded, Otro" /></label>}
      </div>
    </Modal>
  );
}
