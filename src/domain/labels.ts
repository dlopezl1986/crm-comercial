import {
  Phone, Mail, Users, Presentation, CheckSquare, RefreshCw, StickyNote, type LucideIcon,
} from 'lucide-react';
import type {
  ActivityStatus, ActivityType, CallResult, ContactPreference, LeadStatus, LossReason, OpportunityStage,
} from '@/types/models';
import { ALT_STAGES, PIPELINE_STAGES } from '@/types/models';

/** Textos y colores de dominio. Única fuente para formularios, filtros, tablas y gráficos. */

export const STAGE_META: Record<OpportunityStage, { label: string; color: string; probability: number }> = {
  new: { label: 'Nuevo', color: '#64748b', probability: 5 },
  to_contact: { label: 'Pendiente de contactar', color: '#94a3b8', probability: 10 },
  contacted: { label: 'Contactado', color: '#0ea5e9', probability: 20 },
  interested: { label: 'Interesado', color: '#6366f1', probability: 35 },
  meeting: { label: 'Reunión / Demo', color: '#8b5cf6', probability: 50 },
  proposal: { label: 'Propuesta', color: '#d946ef', probability: 60 },
  negotiation: { label: 'Negociación', color: '#f59e0b', probability: 80 },
  won: { label: 'Ganado', color: '#10b981', probability: 100 },
  no_response: { label: 'Sin respuesta', color: '#a8a29e', probability: 5 },
  postponed: { label: 'Pospuesto', color: '#78716c', probability: 10 },
  not_interested: { label: 'No interesado', color: '#f87171', probability: 0 },
  lost: { label: 'Perdido', color: '#ef4444', probability: 0 },
};

export const ALL_STAGES: OpportunityStage[] = [...PIPELINE_STAGES, ...ALT_STAGES];
export const PIPELINE_STAGE_LIST: OpportunityStage[] = [...PIPELINE_STAGES];
/** Etapas cerradas: no requieren próximo paso ni cuentan como pipeline abierto. */
export const CLOSED_STAGES: OpportunityStage[] = ['won', 'lost', 'not_interested'];
export const isOpenStage = (s: OpportunityStage) => !CLOSED_STAGES.includes(s);

export const LOSS_REASONS: Record<LossReason, string> = {
  price: 'Precio',
  competition: 'Competencia',
  not_interested: 'No interesado',
  no_budget: 'Sin presupuesto',
  has_provider: 'Ya tiene proveedor',
  not_now: 'No es el momento',
  no_answer: 'No responde',
  not_fit: 'Producto no adecuado',
  cancelled: 'Proyecto cancelado',
  other: 'Otro',
};

export const ACTIVITY_META: Record<ActivityType, { label: string; icon: LucideIcon; color: string }> = {
  call: { label: 'Llamada', icon: Phone, color: '#0ea5e9' },
  email: { label: 'Email', icon: Mail, color: '#6366f1' },
  meeting: { label: 'Reunión', icon: Users, color: '#8b5cf6' },
  demo: { label: 'Demo', icon: Presentation, color: '#d946ef' },
  task: { label: 'Tarea', icon: CheckSquare, color: '#f59e0b' },
  follow_up: { label: 'Seguimiento', icon: RefreshCw, color: '#10b981' },
  note: { label: 'Nota', icon: StickyNote, color: '#78716c' },
};
export const ACTIVITY_TYPES = Object.keys(ACTIVITY_META) as ActivityType[];

export const ACTIVITY_STATUS: Record<ActivityStatus, string> = {
  pending: 'Pendiente',
  done: 'Hecha',
  cancelled: 'Cancelada',
};

export const CALL_RESULTS: Record<CallResult, string> = {
  no_answer: 'No contesta',
  wrong_number: 'Número incorrecto',
  reception: 'Hablo con recepción',
  decision_maker: 'Hablo con responsable',
  interested: 'Interesado',
  not_interested: 'No interesado',
  call_later: 'Llamar más adelante',
  wants_meeting: 'Quiere reunión',
  wants_quote: 'Quiere presupuesto',
  other: 'Otro',
};

/** Próximos pasos sugeridos (el usuario puede escribir cualquier otro). */
export const NEXT_STEP_PRESETS = [
  'Llamar al cliente', 'Enviar email', 'Enviar presupuesto', 'Concertar reunión', 'Hacer demo',
  'Hacer seguimiento', 'Esperar respuesta', 'Preparar propuesta',
];

export const LEAD_STATUS: Record<LeadStatus, { label: string; color: string }> = {
  new: { label: 'Nuevo', color: '#64748b' },
  attempting: { label: 'Intentando contactar', color: '#0ea5e9' },
  contacted: { label: 'Contactado', color: '#6366f1' },
  qualified: { label: 'Cualificado', color: '#10b981' },
  disqualified: { label: 'Descartado', color: '#ef4444' },
  converted: { label: 'Convertido', color: '#8b5cf6' },
};

export const CONTACT_PREFERENCE: Record<ContactPreference, string> = {
  phone: 'Teléfono',
  mobile: 'Móvil',
  email: 'Email',
  linkedin: 'LinkedIn',
};

export const DEFAULT_SERVICES = [
  'DocuWare Cloud', 'Licencias', 'Implantación', 'Consultoría', 'Integraciones', 'Soporte', 'Formación', 'Otros',
];

export const TAG_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#d946ef', '#8b5cf6', '#64748b'];

/** Tipo de actividad más probable para un próximo paso escrito. */
export function guessType(step?: string) {
  const s = (step ?? '').toLowerCase();
  if (s.includes('llam')) return 'call' as const;
  if (s.includes('email') || s.includes('correo') || s.includes('presupuesto') || s.includes('propuesta')) return 'email' as const;
  if (s.includes('demo')) return 'demo' as const;
  if (s.includes('reuni')) return 'meeting' as const;
  if (s.includes('seguim')) return 'follow_up' as const;
  return 'task' as const;
}
