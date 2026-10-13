/**
 * Motor de importación de empresas y contactos desde CSV/Excel:
 * lectura → mapeo de columnas → registros normalizados → detección de duplicados → plan → escritura por lotes.
 */
import type { WorkBook } from 'xlsx';
import { digits, norm } from '@/lib/text';
import type { Company } from '@/types/models';

export type FieldKey =
  | 'company.name' | 'company.cif' | 'company.sector' | 'company.city' | 'company.province' | 'company.address'
  | 'company.email' | 'company.phone' | 'company.website' | 'company.rating' | 'company.notes'
  | 'contact.fullName' | 'contact.firstName' | 'contact.lastName' | 'contact.jobTitle' | 'contact.department'
  | 'contact.email' | 'contact.phone' | 'contact.mobile' | 'contact.linkedin'
  | 'tags';

export const FIELDS: { key: FieldKey; label: string; group: 'Empresa' | 'Contacto' | 'Otros'; synonyms: string[] }[] = [
  { key: 'company.name', label: 'Nombre de empresa', group: 'Empresa', synonyms: ['empresa', 'company', 'razon social', 'nombre empresa', 'cuenta', 'cliente', 'organizacion'] },
  { key: 'company.cif', label: 'CIF', group: 'Empresa', synonyms: ['cif', 'nif', 'vat', 'cif/nif'] },
  { key: 'company.sector', label: 'Sector', group: 'Empresa', synonyms: ['sector', 'sector/categoria', 'categoria', 'industria', 'actividad'] },
  { key: 'company.city', label: 'Ciudad', group: 'Empresa', synonyms: ['ciudad', 'localidad', 'poblacion', 'municipio', 'city'] },
  { key: 'company.province', label: 'Provincia', group: 'Empresa', synonyms: ['provincia', 'region', 'state'] },
  { key: 'company.address', label: 'Dirección', group: 'Empresa', synonyms: ['direccion', 'domicilio', 'address'] },
  { key: 'company.email', label: 'Email de empresa', group: 'Empresa', synonyms: ['email', 'correo', 'e-mail', 'mail', 'email empresa'] },
  { key: 'company.phone', label: 'Teléfono de empresa', group: 'Empresa', synonyms: ['telefono', 'tel', 'phone', 'telefono empresa'] },
  { key: 'company.website', label: 'Web', group: 'Empresa', synonyms: ['web', 'website', 'pagina web', 'url', 'sitio web'] },
  { key: 'company.rating', label: 'Valoración', group: 'Empresa', synonyms: ['rating', 'valoracion', 'puntuacion'] },
  { key: 'company.notes', label: 'Notas de empresa', group: 'Empresa', synonyms: ['notas', 'observaciones', 'comentarios'] },
  { key: 'contact.fullName', label: 'Contacto (nombre completo)', group: 'Contacto', synonyms: ['contacto', 'persona de contacto', 'nombre completo', 'contact'] },
  { key: 'contact.firstName', label: 'Nombre del contacto', group: 'Contacto', synonyms: ['nombre', 'first name'] },
  { key: 'contact.lastName', label: 'Apellidos del contacto', group: 'Contacto', synonyms: ['apellidos', 'apellido', 'last name'] },
  { key: 'contact.jobTitle', label: 'Cargo', group: 'Contacto', synonyms: ['cargo', 'puesto', 'job title', 'title'] },
  { key: 'contact.department', label: 'Departamento', group: 'Contacto', synonyms: ['departamento', 'area', 'department'] },
  { key: 'contact.email', label: 'Email del contacto', group: 'Contacto', synonyms: ['email contacto'] },
  { key: 'contact.phone', label: 'Teléfono del contacto', group: 'Contacto', synonyms: ['telefono contacto'] },
  { key: 'contact.mobile', label: 'Móvil', group: 'Contacto', synonyms: ['movil', 'mobile', 'celular'] },
  { key: 'contact.linkedin', label: 'LinkedIn', group: 'Contacto', synonyms: ['linkedin'] },
  { key: 'tags', label: 'Etiquetas (separadas por ; o ,)', group: 'Otros', synonyms: ['etiquetas', 'tags', 'etiqueta'] },
];

export type Mapping = Record<string, FieldKey | ''>;
export type Row = Record<string, unknown>;

export async function readWorkbook(file: File): Promise<WorkBook> {
  const XLSX = await import('xlsx');
  const buf = await file.arrayBuffer();
  return XLSX.read(buf, { type: 'array', cellDates: true });
}

export async function sheetRows(wb: WorkBook, sheet: string): Promise<{ headers: string[]; rows: Row[] }> {
  const XLSX = await import('xlsx');
  const rows = XLSX.utils.sheet_to_json<Row>(wb.Sheets[sheet], { defval: '', raw: false });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows };
}

/** Propone un mapeo por nombre de columna (sin acentos ni mayúsculas). */
export function guessMapping(headers: string[]): Mapping {
  const used = new Set<FieldKey>();
  const m: Mapping = {};
  for (const h of headers) {
    const n = norm(h).trim();
    const f = FIELDS.find((x) => !used.has(x.key) && x.synonyms.some((s) => n === s))
      ?? FIELDS.find((x) => !used.has(x.key) && x.synonyms.some((s) => s.length > 3 && n.startsWith(s)));
    m[h] = f?.key ?? '';
    if (f) used.add(f.key);
  }
  return m;
}

/** Decodifica entidades HTML que a veces vienen en exportaciones web (&apos; &amp;…). */
function clean(v: unknown): string {
  return String(v ?? '').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
}

export interface ImportRecordRow {
  index: number;
  company: Partial<Company> & { name?: string };
  contact: { firstName?: string; lastName?: string; jobTitle?: string; department?: string; email?: string; phone?: string; mobile?: string; linkedin?: string };
  tags: string[];
}

export function mapRows(rows: Row[], mapping: Mapping): ImportRecordRow[] {
  return rows.map((r, index) => {
    const out: ImportRecordRow = { index, company: {}, contact: {}, tags: [] };
    for (const [header, key] of Object.entries(mapping)) {
      if (!key) continue;
      const v = clean(r[header]);
      if (!v) continue;
      if (key === 'tags') out.tags.push(...v.split(/[;,]/).map((t) => t.trim()).filter(Boolean));
      else if (key === 'contact.fullName') {
        const [first, ...rest] = v.split(' ');
        out.contact.firstName = first; if (rest.length) out.contact.lastName = rest.join(' ');
      } else if (key === 'company.rating') {
        const n = Number(v.replace(',', '.'));
        if (!Number.isNaN(n)) out.company.rating = n;
      } else {
        const [ent, field] = key.split('.') as ['company' | 'contact', string];
        (out[ent] as Record<string, string>)[field] = v;
      }
    }
    return out;
  }).filter((r) => r.company.name || r.contact.firstName);
}

export type DupAction = 'merge' | 'ignore' | 'create';
export interface PlannedCompany {
  key: string;
  rows: ImportRecordRow[];
  data: ImportRecordRow['company'];
  tags: string[];
  existing?: Company;
  matchedBy?: string;
  action: DupAction;
}

const companyKeys = (c: { cif?: string; email?: string; phone?: string; name?: string }) => ({
  cif: norm(c.cif).replace(/\W/g, ''), email: norm(c.email), phone: digits(c.phone), name: norm(c.name).replace(/\s+/g, ' ').trim(),
});

/**
 * Agrupa filas por empresa y busca posibles duplicados en el CRM por CIF, email, teléfono o nombre.
 */
export function planCompanies(records: ImportRecordRow[], existing: Company[]): PlannedCompany[] {
  const idx = { cif: new Map<string, Company>(), email: new Map<string, Company>(), phone: new Map<string, Company>(), name: new Map<string, Company>() };
  existing.forEach((c) => {
    const k = companyKeys(c);
    if (k.cif) idx.cif.set(k.cif, c);
    if (k.email) idx.email.set(k.email, c);
    if (k.phone.length >= 6) idx.phone.set(k.phone, c);
    if (k.name) idx.name.set(k.name, c);
  });
  // Dentro del archivo, varias filas son la misma empresa (p. ej. varios contactos) si comparten
  // CIF, o nombre + localidad. Email/teléfono no agrupan: las sucursales o franquicias de una
  // cadena suelen compartirlos y son clientes potenciales distintos.
  const groups = new Map<string, PlannedCompany>();
  for (const r of records) {
    if (!r.company.name) continue;
    const k = companyKeys(r.company);
    const groupKey = k.cif ? `cif:${k.cif}` : `name:${k.name}|${norm(r.company.city)}`;
    let g = groups.get(groupKey);
    if (!g) {
      g = { key: groupKey, rows: [], data: { ...r.company }, tags: [], action: 'create' };
      const hit = (k.cif && idx.cif.get(k.cif) && ['CIF', idx.cif.get(k.cif)!])
        || (k.email && idx.email.get(k.email) && ['email', idx.email.get(k.email)!])
        || (k.phone.length >= 6 && idx.phone.get(k.phone) && ['teléfono', idx.phone.get(k.phone)!])
        || (k.name && idx.name.get(k.name) && ['nombre', idx.name.get(k.name)!]);
      if (hit) {
        g.existing = hit[1] as Company; g.matchedBy = hit[0] as string;
        // Propuesta por defecto: fusionar si coincide el CIF o es la misma localidad; si no, probablemente sea otra sede.
        g.action = g.matchedBy === 'CIF' || norm(g.existing.city) === norm(r.company.city) ? 'merge' : 'create';
      }
      groups.set(groupKey, g);
    } else {
      // Completa campos vacíos con los de filas repetidas de la misma empresa.
      for (const [f, v] of Object.entries(r.company)) if (v && !(g.data as Record<string, unknown>)[f]) (g.data as Record<string, unknown>)[f] = v;
    }
    g.rows.push(r);
    g.tags = [...new Set([...g.tags, ...r.tags])];
  }
  return [...groups.values()];
}
