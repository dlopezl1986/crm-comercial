import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useOrg } from '@/auth/AuthProvider';
import { syncCollection } from '@/services/sync';
import type { OrgCollection } from '@/services/paths';
import type { Activity, Company, Contact, CustomFieldDef, ImportRecord, Lead, Opportunity, Service, Tag } from '@/types/models';

/**
 * Datos de la organización en memoria, sincronizados con Firestore (services/sync.ts).
 * Con un CRM personal (miles de registros) da búsqueda, filtros y estadísticas instantáneas.
 * Si algún día crece mucho, las colecciones grandes pasarían a consultas paginadas aquí mismo.
 */
export interface DataState {
  companies: Company[];
  contacts: Contact[];
  leads: Lead[];
  opportunities: Opportunity[];
  activities: Activity[];
  services: Service[];
  tags: Tag[];
  customFields: CustomFieldDef[];
  imports: ImportRecord[];
  companyById: Map<string, Company>;
  contactById: Map<string, Contact>;
  leadById: Map<string, Lead>;
  opportunityById: Map<string, Opportunity>;
  serviceById: Map<string, Service>;
  /** Todas las etiquetas existentes (registradas o en uso), ordenadas. */
  allTags: string[];
  ready: boolean;
  error: string | null;
}

type Raw = {
  companies: Company[]; contacts: Contact[]; leads: Lead[]; opportunities: Opportunity[];
  activities: Activity[]; services: Service[]; tags: Tag[]; customFields: CustomFieldDef[]; imports: ImportRecord[];
};
const KEYS: (keyof Raw & OrgCollection)[] = ['companies', 'contacts', 'leads', 'opportunities', 'activities', 'services', 'tags', 'customFields', 'imports'];

const DataContext = createContext<DataState | null>(null);
const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export function DataProvider({ children }: { children: ReactNode }) {
  const org = useOrg();
  const [raw, setRaw] = useState<Partial<Raw>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw({});
    const onError = (e: Error) => { console.error(e); setError('Error al sincronizar datos con el servidor.'); };
    const unsubs = KEYS.map((k) => syncCollection(org.id, k, (items) => setRaw((r) => ({ ...r, [k]: items })), onError));
    return () => unsubs.forEach((u) => u());
  }, [org.id]);

  // Índices por colección: cada uno solo se recalcula cuando cambia su colección.
  const empty = useMemo(() => [] as never[], []);
  const companies = raw.companies ?? empty;
  const contacts = raw.contacts ?? empty;
  const leads = raw.leads ?? empty;
  const opportunities = raw.opportunities ?? empty;
  const companyById = useMemo(() => byId(companies), [companies]);
  const contactById = useMemo(() => byId(contacts), [contacts]);
  const leadById = useMemo(() => byId(leads), [leads]);
  const opportunityById = useMemo(() => byId(opportunities), [opportunities]);
  const services = useMemo(() => [...(raw.services ?? [])].sort((a, b) => a.order - b.order), [raw.services]);
  const serviceById = useMemo(() => byId(services), [services]);
  const customFields = useMemo(() => [...(raw.customFields ?? [])].sort((a, b) => a.order - b.order), [raw.customFields]);
  const allTags = useMemo(() => {
    const set = new Set<string>((raw.tags ?? []).map((t) => t.name));
    [companies, contacts, leads, opportunities].forEach((xs) => xs.forEach((x: { tags?: string[] }) => x.tags?.forEach((t) => set.add(t))));
    return [...set].sort((a, b) => a.localeCompare(b, 'es'));
  }, [raw.tags, companies, contacts, leads, opportunities]);

  const value = useMemo<DataState>(() => ({
    companies, contacts, leads, opportunities,
    activities: raw.activities ?? empty, tags: raw.tags ?? empty, imports: raw.imports ?? empty,
    services, customFields, companyById, contactById, leadById, opportunityById, serviceById, allTags,
    ready: KEYS.every((k) => raw[k] !== undefined),
    error,
  }), [raw, companies, contacts, leads, opportunities, services, customFields, companyById, contactById, leadById, opportunityById, serviceById, allTags, error, empty]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData debe usarse dentro de <DataProvider>');
  return ctx;
}
