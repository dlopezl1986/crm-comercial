/**
 * Modelo de datos del CRM.
 *
 * Multi-tenant desde el inicio: todos los datos comerciales viven bajo
 * `orgs/{orgId}/...`. Hoy cada usuario tiene su propia organización
 * (orgId = uid); en el futuro una organización podrá tener varios miembros,
 * roles y pipelines sin cambiar la forma de los documentos.
 */
import type { Timestamp } from 'firebase/firestore';

export type ID = string;

/** Campos comunes a todo documento de negocio. */
export interface BaseDoc {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: ID;
  ownerId: ID; // responsable
  /** Etiquetas (por nombre). Se gestionan en Configuración > Etiquetas. */
  tags?: string[];
  /** Valores de campos personalizados, indexados por id de definición. */
  custom?: Record<string, unknown>;
  /** Borrado lógico: necesario para la sincronización incremental (services/sync.ts). */
  deleted?: boolean;
  /** Marca de datos de demostración (para poder borrarlos de golpe). */
  isDemo?: boolean;
  /** Lote de importación del que procede (para poder deshacerla). */
  importBatch?: string;
}

export type OrgRole = 'owner' | 'admin' | 'member';

/** users/{uid} */
export interface UserProfile {
  uid: ID;
  email: string;
  displayName?: string;
  defaultOrgId: ID;
  prefs?: { theme?: 'light' | 'dark' };
  createdAt: Timestamp;
}

/** orgs/{orgId} */
export interface Org {
  id: ID;
  name: string;
  ownerId: ID;
  createdAt: Timestamp;
  settings: OrgSettings;
}

export interface OrgSettings {
  staleDays: number; // días sin actividad para considerar una oportunidad estancada
  currency: 'EUR';
}

export interface Company extends BaseDoc {
  name: string;
  cif?: string;
  /** Sector (grupo), ver domain/sectors.ts. */
  sector?: string;
  /** Subsector: categoría detallada (p. ej. "Empresa de transporte por camión"). */
  subsector?: string;
  city?: string;
  province?: string;
  address?: string;
  notes?: string;
  email?: string;
  phone?: string;
  website?: string;
  rating?: number; // valoración pública (p.ej. Google)
  source?: string; // origen del registro (importación, web, referido…)
  lastActivityAt?: Timestamp;
  /** No quiere recibir comunicaciones comerciales por email (baja). */
  emailOptOut?: boolean;
  emailOptOutAt?: Timestamp | null;
  /** Campañas de email ya enviadas a esta empresa. */
  campaignIds?: string[];
  /** Estado del email comercial (ver domain/emailStatus.ts). */
  emailStatus?: EmailStatus;
  /** Comentario sobre el email (p. ej. "rebota: buzón inexistente"). */
  emailNote?: string;
  emailSentAt?: Timestamp | null;
  emailStatusAt?: Timestamp | null;
}

export type EmailStatus = 'sent' | 'replied' | 'bounced' | 'error' | 'optout';

export type ContactPreference = 'phone' | 'mobile' | 'email' | 'linkedin';

export interface Contact extends BaseDoc {
  firstName: string;
  lastName?: string;
  jobTitle?: string;
  department?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  linkedin?: string;
  notes?: string;
  preference?: ContactPreference;
  companyId?: ID | null;
  lastActivityAt?: Timestamp;
}

export type LeadStatus = 'new' | 'attempting' | 'contacted' | 'qualified' | 'disqualified' | 'converted';

export interface Lead extends BaseDoc {
  title: string;
  companyId?: ID | null;
  contactId?: ID | null;
  source?: string;
  status: LeadStatus;
  notes?: string;
  disqualifyReason?: string;
  convertedOpportunityId?: ID;
  convertedAt?: Timestamp;
  nextStep?: string;
  nextStepAt?: Timestamp | null;
  lastActivityAt?: Timestamp;
}

/** Etapas del pipeline (orden visual) y estados alternativos. */
export const PIPELINE_STAGES = [
  'new', 'to_contact', 'contacted', 'interested', 'meeting', 'proposal', 'negotiation', 'won',
] as const;
export const ALT_STAGES = ['no_response', 'postponed', 'not_interested', 'lost'] as const;
export type OpportunityStage = (typeof PIPELINE_STAGES)[number] | (typeof ALT_STAGES)[number];

export type LossReason =
  | 'price' | 'competition' | 'not_interested' | 'no_budget' | 'has_provider'
  | 'not_now' | 'no_answer' | 'not_fit' | 'cancelled' | 'other';

export interface StageChange {
  from: OpportunityStage | null;
  to: OpportunityStage;
  at: Timestamp;
}

export interface Opportunity extends BaseDoc {
  name: string;
  companyId?: ID | null;
  contactId?: ID | null;
  serviceIds: ID[];
  stage: OpportunityStage;
  value?: number | null;        // opcional
  probability?: number | null;  // 0..100
  weightedValue?: number | null; // value * probability / 100, calculado al guardar
  expectedCloseAt?: Timestamp | null;
  notes?: string;
  nextStep?: string;
  nextStepAt?: Timestamp | null;
  lastActivityAt?: Timestamp;
  stageChangedAt?: Timestamp;
  stageHistory?: StageChange[];
  closedAt?: Timestamp | null;
  lossReason?: LossReason | null;
  lossNotes?: string;
  leadId?: ID | null;
}

export type ActivityType = 'call' | 'email' | 'meeting' | 'demo' | 'task' | 'follow_up' | 'note';
export type ActivityStatus = 'pending' | 'done' | 'cancelled';
export type CallResult =
  | 'no_answer' | 'wrong_number' | 'reception' | 'decision_maker' | 'interested'
  | 'not_interested' | 'call_later' | 'wants_meeting' | 'wants_quote' | 'other';

export interface Activity extends BaseDoc {
  type: ActivityType;
  title: string;
  description?: string;
  dueAt: Timestamp; // fecha + hora
  status: ActivityStatus;
  result?: CallResult | null;
  outcome?: string; // resultado libre
  companyId?: ID | null;
  contactId?: ID | null;
  opportunityId?: ID | null;
  leadId?: ID | null;
  completedAt?: Timestamp | null;
  /** Identificador en el sistema de origen (p. ej. ID de respuesta de Forms), para no importar dos veces. */
  externalId?: string | null;
}

export interface Service extends BaseDoc {
  name: string;
  description?: string;
  price?: number | null;
  active: boolean;
  order: number;
}

/** Registro de etiquetas (orgs/{orgId}/tags/{id}): color y etiquetas aún sin uso. */
export interface Tag extends BaseDoc {
  name: string;
  color: string;
}

export type CustomFieldEntity = 'company' | 'contact' | 'opportunity' | 'lead';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

/** Definición de campo personalizado (orgs/{orgId}/customFields/{id}). */
export interface CustomFieldDef extends BaseDoc {
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  options?: string[];
  order: number;
}

/** Registro de una importación (orgs/{orgId}/imports/{id}), para consultarla o deshacerla. */
export interface ImportRecord extends BaseDoc {
  fileName: string;
  batch: string;
  companiesCreated: number;
  companiesMerged: number;
  contactsCreated: number;
  leadsCreated: number;
  notesCreated?: number;
  skippedAlreadyImported?: number;
  undone?: boolean;
}

/** Campaña de email por lotes (orgs/{orgId}/campaigns/{id}). */
export interface Campaign extends BaseDoc {
  name: string;
  subject: string;
  /** Enlace al que lleva la imagen (formulario). */
  linkUrl: string;
  /** Imagen del email (URL pública). */
  imageUrl: string;
  /** Pie con identificación del remitente e instrucciones de baja. */
  footer: string;
  /** Segmento: empresas con alguna de estas etiquetas (vacío = todas). */
  segmentTags: string[];
  /** @deprecated usar segmentSectors */
  segmentSector?: string;
  /** Segmento: sectores (vacío = todos). */
  segmentSectors?: string[];
  /** Segmento: subsectores concretos dentro de esos sectores (vacío = todos). */
  segmentSubsectors?: string[];
  batchSize: number;
  sentCount: number;
  lastBatchAt?: Timestamp | null;
}
