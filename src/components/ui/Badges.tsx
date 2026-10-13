import type { OpportunityStage } from '@/types/models';
import { STAGE_META } from '@/domain/labels';
import { WHEN_LABEL, type When } from '@/lib/dates';

export function Dot({ color }: { color: string }) {
  return <span className="dot" style={{ background: color }} />;
}

export function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="badge" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{children}</span>;
}

export function StageBadge({ stage }: { stage: OpportunityStage }) {
  const m = STAGE_META[stage];
  return <Badge color={m.color}>{m.label}</Badge>;
}

const WHEN_COLOR: Record<When, string> = {
  overdue: 'var(--danger)', today: 'var(--danger)', tomorrow: 'var(--warning)', soon: 'var(--info)', later: 'var(--text-3)',
};

export function WhenBadge({ when }: { when: When | null }) {
  if (!when) return null;
  return <Badge color={WHEN_COLOR[when]}>{WHEN_LABEL[when]}</Badge>;
}
