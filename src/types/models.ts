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
  tags?: ID[];
  /** Valores de campos personalizados, indexados por id de definición. */
  custom?: Record<string, unknown>;
  /** Marca de datos de demostración (para poder borrarlos de golpe). */
  isDemo?: boolean;
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

/** orgs/{orgId}/members/{uid} */
export interface Member {
  uid: ID;
  email: string;
  role: OrgRole;
  joinedAt: Timestamp;
}

export interface Company extends BaseDoc {
  name: string;
  cif?: string;
  sector?: string;
  city?: string;
  notes?: string;
  email?: string;
  phone?: string;
  website?: string;
  lastActivityAt?: Timestamp;
}

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
  companyId?: ID;
  lastActivityAt?: Timestamp;
}

export type LeadStatus = 'new' | 'contacting' | 'qualified' | 'disqualified' | 'converted';

export interface Lead extends BaseDoc {
  title: string;
  companyId?: ID;
  contactId?: ID;
  source?: string;
  status: LeadStatus;
  notes?: string;
  convertedOpportunityId?: ID;
  nextStep?: string;
  nextStepAt?: Timestamp;
}

/** Etapas del pipeline (orden visual) y estados alternativos. */
export const PIPELINE_STAGES = [
  'new', 'to_contact', 'contacted', 'interested', 'meeting', 'proposal', 'negotiation', 'won',
] as const;
export const ALT_STAGES = ['not_interested', 'lost', 'no_response', 'postponed'] as const;
export type OpportunityStage = (typeof PIPELINE_STAGES)[number] | (typeof ALT_STAGES)[number];

export type LossReason =
  | 'price' | 'competition' | 'not_interested' | 'no_budget' | 'has_provider'
  | 'not_now' | 'no_answer' | 'not_fit' | 'cancelled' | 'other';

export interface Opportunity extends BaseDoc {
  name: string;
  companyId?: ID;
  contactId?: ID;
  serviceIds: ID[];
  stage: OpportunityStage;
  value?: number;        // opcional
  probability?: number;  // 0..100
  weightedValue?: number; // value * probability / 100, calculado al guardar
  expectedCloseAt?: Timestamp;
  notes?: string;
  nextStep?: string;
  nextStepAt?: Timestamp;
  lastActivityAt?: Timestamp;
  stageChangedAt?: Timestamp;
  closedAt?: Timestamp;
  lossReason?: LossReason;
  lossNotes?: string;
  leadId?: ID;
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
  allDay?: boolean;
  status: ActivityStatus;
  result?: CallResult | string;
  companyId?: ID;
  contactId?: ID;
  opportunityId?: ID;
  leadId?: ID;
  completedAt?: Timestamp;
}

export interface Service {
  id: ID;
  name: string;
  description?: string;
  price?: number;
  active: boolean;
  order: number;
  createdAt: Timestamp;
}

export interface Tag {
  id: ID;
  name: string;
  color: string;
}

export type CustomFieldEntity = 'company' | 'contact' | 'opportunity' | 'lead';
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean';

/** Definición de campo personalizado (orgs/{orgId}/customFields/{id}). */
export interface CustomFieldDef {
  id: ID;
  entity: CustomFieldEntity;
  label: string;
  type: CustomFieldType;
  options?: string[];
  order: number;
}
