import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import { useSession } from '@/auth/AuthProvider';
import { useData } from '@/data/DataProvider';
import { useToast } from '@/components/ui/Toast';
import { WhenBadge } from '@/components/ui/Badges';
import { ALT_STAGES, PIPELINE_STAGES, type Opportunity, type OpportunityStage } from '@/types/models';
import { STAGE_META, isOpenStage } from '@/domain/labels';
import { changeStage } from '@/services/crm';
import { daysBetween, tsToDate, whenOf } from '@/lib/dates';
import { money, moneyCompact } from '@/lib/format';
import { LossDialog } from './LossDialog';

function OppCard({ o, staleDays }: { o: Opportunity; staleDays: number }) {
  const { companyById } = useData();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: o.id });
  const last = tsToDate(o.lastActivityAt ?? o.updatedAt);
  const idle = last ? daysBetween(last, new Date()) : 0;
  const stale = isOpenStage(o.stage) && idle > staleDays;
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className={`kcard ${isDragging ? 'kcard--dragging' : ''}`}>
      <Link to={`/oportunidades/${o.id}`} className="kcard__title" onPointerDown={(e) => e.stopPropagation()}>{o.name}</Link>
      {o.companyId && <div className="kcard__sub">{companyById.get(o.companyId)?.name}</div>}
      <div className="kcard__meta">
        {o.value != null && <span className="kcard__value">{money(o.value)}</span>}
        {o.probability != null && <span className="muted small">{o.probability} %</span>}
      </div>
      {isOpenStage(o.stage) && (o.nextStep ? (
        <div className="kcard__next"><CalendarClock size={13} /><span className="truncate">{o.nextStep}</span><WhenBadge when={whenOf(o.nextStepAt)} /></div>
      ) : <div className="kcard__next kcard__next--missing">Sin próximo paso</div>)}
      {stale && <div className="kcard__stale"><AlertTriangle size={12} /> {idle} días sin actividad</div>}
    </div>
  );
}

function Column({ stage, items, staleDays, compact }: { stage: OpportunityStage; items: Opportunity[]; staleDays: number; compact?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const m = STAGE_META[stage];
  const total = items.reduce((s, o) => s + (o.value ?? 0), 0);
  return (
    <div ref={setNodeRef} className={`kcol ${compact ? 'kcol--compact' : ''} ${isOver ? 'kcol--over' : ''}`}>
      <div className="kcol__head" style={{ borderTopColor: m.color }}>
        <span className="kcol__title">{m.label}</span>
        <span className="kcol__count">{items.length}</span>
        {total > 0 && <span className="kcol__total">{moneyCompact(total)}</span>}
      </div>
      {!compact && <div className="kcol__body">{items.map((o) => <OppCard key={o.id} o={o} staleDays={staleDays} />)}</div>}
    </div>
  );
}

/** Kanban del pipeline. Arrastrar a "Perdido" pide el motivo; el cambio se guarda en Firestore. */
export function PipelineBoard({ items }: { items: Opportunity[] }) {
  const ctx = useSession();
  const toast = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [losing, setLosing] = useState<Opportunity | null>(null);
  const byStage = useMemo(() => {
    const m = new Map<OpportunityStage, Opportunity[]>();
    items.forEach((o) => m.set(o.stage, [...(m.get(o.stage) ?? []), o]));
    m.forEach((xs) => xs.sort((a, b) => (tsToDate(a.nextStepAt)?.getTime() ?? Infinity) - (tsToDate(b.nextStepAt)?.getTime() ?? Infinity)));
    return m;
  }, [items]);

  const onDragEnd = async (e: DragEndEvent) => {
    const to = e.over?.id as OpportunityStage | undefined;
    const opp = items.find((o) => o.id === e.active.id);
    if (!to || !opp || opp.stage === to) return;
    if (to === 'lost') { setLosing(opp); return; }
    try {
      await changeStage(ctx, opp, to);
      toast(`${opp.name} → ${STAGE_META[to].label}`);
    } catch (err) { console.error(err); toast('No se pudo mover la oportunidad', 'error'); }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="kanban">
        {PIPELINE_STAGES.map((s) => <Column key={s} stage={s} items={byStage.get(s) ?? []} staleDays={ctx.org.settings.staleDays} />)}
      </div>
      <div className="kanban-alt">
        <span className="muted small">Otros estados (arrastra aquí):</span>
        {ALT_STAGES.map((s) => <Column key={s} stage={s} items={byStage.get(s) ?? []} staleDays={ctx.org.settings.staleDays} compact />)}
      </div>
      {losing && (
        <LossDialog name={losing.name} onClose={() => setLosing(null)}
          onConfirm={async (reason, notes) => { await changeStage(ctx, losing, 'lost', { lossReason: reason, lossNotes: notes }); toast('Marcada como perdida'); }} />
      )}
    </DndContext>
  );
}
