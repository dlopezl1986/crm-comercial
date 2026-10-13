import { Fragment } from 'react';
import { useData } from '@/data/DataProvider';
import type { CustomFieldEntity } from '@/types/models';

/** Campos personalizados de una entidad dentro de un formulario (definidos en Configuración). */
export function CustomFieldsEditor({ entity, value, onChange }: {
  entity: CustomFieldEntity; value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void;
}) {
  const defs = useData().customFields.filter((f) => f.entity === entity);
  if (!defs.length) return null;
  const set = (id: string, v: unknown) => onChange({ ...value, [id]: v === '' ? null : v });
  return (
    <div className="form-grid">
      {defs.map((f) => {
        const v = value[f.id];
        return (
          <label key={f.id} className="field"><span>{f.label}</span>
            {f.type === 'select' ? (
              <select value={(v as string) ?? ''} onChange={(e) => set(f.id, e.target.value)}>
                <option value="">—</option>
                {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : f.type === 'boolean' ? (
              <select value={v == null ? '' : v ? 'yes' : 'no'} onChange={(e) => set(f.id, e.target.value === '' ? '' : e.target.value === 'yes')}>
                <option value="">—</option><option value="yes">Sí</option><option value="no">No</option>
              </select>
            ) : (
              <input type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} value={(v as string | number) ?? ''}
                onChange={(e) => set(f.id, f.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value)} />
            )}
          </label>
        );
      })}
    </div>
  );
}

/** Valores de campos personalizados en una ficha. */
export function CustomFieldsView({ entity, value }: { entity: CustomFieldEntity; value?: Record<string, unknown> }) {
  const defs = useData().customFields.filter((f) => f.entity === entity);
  if (!defs.length) return null;
  const show = (v: unknown) => v == null || v === '' ? '—' : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : String(v);
  return (
    <>
      {defs.map((f) => <Fragment key={f.id}><dt>{f.label}</dt><dd>{show(value?.[f.id])}</dd></Fragment>)}
    </>
  );
}
