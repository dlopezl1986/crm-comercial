import type { DataState } from '@/data/DataProvider';
import { ACTIVITY_META, ACTIVITY_STATUS, CALL_RESULTS, LEAD_STATUS, LOSS_REASONS, STAGE_META, CONTACT_PREFERENCE } from '@/domain/labels';
import { formatDate, formatDateTime } from '@/lib/dates';
import { fullName } from '@/lib/text';

export type ExportEntity = 'companies' | 'contacts' | 'leads' | 'opportunities' | 'activities';
export const EXPORT_LABELS: Record<ExportEntity, string> = {
  companies: 'Empresas', contacts: 'Contactos', leads: 'Leads', opportunities: 'Oportunidades', activities: 'Actividades',
};

const tags = (t?: string[]) => (t ?? []).join('; ');

/** Filas legibles (nombres en vez de ids, textos en español) para exportar. */
export function exportRows(d: DataState, e: ExportEntity): Record<string, unknown>[] {
  const co = (id?: string | null) => (id ? d.companyById.get(id)?.name ?? '' : '');
  const ct = (id?: string | null) => { const c = id ? d.contactById.get(id) : undefined; return c ? fullName(c) : ''; };
  switch (e) {
    case 'companies': return d.companies.map((c) => ({
      Empresa: c.name, CIF: c.cif ?? '', Sector: c.sector ?? '', Subsector: c.subsector ?? '', Ciudad: c.city ?? '', Provincia: c.province ?? '', Dirección: c.address ?? '',
      Email: c.email ?? '', Teléfono: c.phone ?? '', Web: c.website ?? '', Etiquetas: tags(c.tags), Notas: c.notes ?? '',
      'Fecha de creación': formatDate(c.createdAt), 'Última actividad': c.lastActivityAt ? formatDate(c.lastActivityAt) : '',
    }));
    case 'contacts': return d.contacts.map((c) => ({
      Nombre: c.firstName, Apellidos: c.lastName ?? '', Empresa: co(c.companyId), Cargo: c.jobTitle ?? '', Departamento: c.department ?? '',
      Email: c.email ?? '', Teléfono: c.phone ?? '', Móvil: c.mobile ?? '', LinkedIn: c.linkedin ?? '',
      Preferencia: c.preference ? CONTACT_PREFERENCE[c.preference] : '', Etiquetas: tags(c.tags), Notas: c.notes ?? '', 'Fecha de creación': formatDate(c.createdAt),
    }));
    case 'leads': return d.leads.map((l) => ({
      Lead: l.title, Empresa: co(l.companyId), Contacto: ct(l.contactId), Estado: LEAD_STATUS[l.status].label, Fuente: l.source ?? '',
      'Próximo paso': l.nextStep ?? '', 'Fecha próximo paso': l.nextStepAt ? formatDateTime(l.nextStepAt) : '', Etiquetas: tags(l.tags),
      Notas: l.notes ?? '', 'Fecha de creación': formatDate(l.createdAt),
    }));
    case 'opportunities': return d.opportunities.map((o) => ({
      Oportunidad: o.name, Empresa: co(o.companyId), Contacto: ct(o.contactId), Estado: STAGE_META[o.stage].label,
      Servicios: (o.serviceIds ?? []).map((s) => d.serviceById.get(s)?.name).filter(Boolean).join('; '),
      Valor: o.value ?? '', 'Probabilidad (%)': o.probability ?? '', 'Valor ponderado': o.weightedValue ?? '',
      'Cierre previsto': o.expectedCloseAt ? formatDate(o.expectedCloseAt) : '', 'Próximo paso': o.nextStep ?? '',
      'Fecha próximo paso': o.nextStepAt ? formatDateTime(o.nextStepAt) : '', 'Motivo de pérdida': o.lossReason ? LOSS_REASONS[o.lossReason] : '',
      Etiquetas: tags(o.tags), Notas: o.notes ?? '', 'Fecha de creación': formatDate(o.createdAt), 'Fecha de cierre': o.closedAt ? formatDate(o.closedAt) : '',
    }));
    case 'activities': return d.activities.map((a) => ({
      Tipo: ACTIVITY_META[a.type].label, Título: a.title, Fecha: formatDateTime(a.dueAt), Estado: ACTIVITY_STATUS[a.status],
      Resultado: a.result ? CALL_RESULTS[a.result] : '', Empresa: co(a.companyId), Contacto: ct(a.contactId),
      Oportunidad: a.opportunityId ? d.opportunityById.get(a.opportunityId)?.name ?? '' : '', Descripción: a.description ?? '',
    }));
  }
}

export async function downloadExport(d: DataState, e: ExportEntity, format: 'csv' | 'xlsx') {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(exportRows(d, e));
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `CRM_${EXPORT_LABELS[e]}_${stamp}.${format}`;
  if (format === 'csv') {
    // BOM para que Excel abra bien los acentos; separador ";" (configuración regional española).
    const csv = '﻿' + XLSX.utils.sheet_to_csv(ws, { FS: ';' });
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, EXPORT_LABELS[e]);
    XLSX.writeFile(wb, name);
  }
}
