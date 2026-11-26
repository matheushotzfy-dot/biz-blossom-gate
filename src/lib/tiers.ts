/**
 * Single source of truth for seller revenue tiers.
 * Used by Perfil progress and anywhere else
 * we display "tier / próximo milestone / % da meta".
 */

export type Milestone = {
  label: string;
  value: number;
  tier: string;
};

export const MILESTONES: Milestone[] = [
  { label: "R$ 0",    value: 0,        tier: "Iniciante" },
  { label: "R$ 10K",  value: 10_000,   tier: "Bronze" },
  { label: "R$ 100K", value: 100_000,  tier: "Prata" },
  { label: "R$ 500K", value: 500_000,  tier: "Ouro" },
  { label: "R$ 1M",   value: 1_000_000, tier: "Platina" },
  { label: "R$ 5M",   value: 5_000_000, tier: "Diamante" },
];

export const TIER_LABELS = MILESTONES.map((m) => m.tier);

export type MilestoneInfo = {
  current: Milestone;
  next: Milestone;
  pct: number;
  tier: number;
};

export function getMilestone(revenue: number): MilestoneInfo {
  const last = MILESTONES[MILESTONES.length - 1];
  if (revenue >= last.value) {
    return { current: last, next: last, pct: 100, tier: MILESTONES.length - 1 };
  }
  for (let i = 0; i < MILESTONES.length - 1; i++) {
    if (revenue >= MILESTONES[i].value && revenue < MILESTONES[i + 1].value) {
      const current = MILESTONES[i];
      const next = MILESTONES[i + 1];
      const range = next.value - current.value;
      const pct = range > 0 ? Math.min(((revenue - current.value) / range) * 100, 100) : 100;
      return { current, next, pct, tier: i };
    }
  }
  return { current: MILESTONES[0], next: MILESTONES[1], pct: 0, tier: 0 };
}
