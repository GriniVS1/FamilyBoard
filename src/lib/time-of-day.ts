import type { ChoreTimeOfDay } from "./enums";

// Kept free of value imports through "@/…" so `node --test` can load it
// directly (type-only imports are stripped).

export type DayPhase = ChoreTimeOfDay | "NIGHT";

/** Local wall-clock hour at which each phase starts. NIGHT runs 00:00–04:59. */
export const PHASE_START_HOUR = {
  MORNING: 5,
  DAY: 11,
  EVENING: 17,
} as const satisfies Record<ChoreTimeOfDay, number>;

/** Display and grouping order; `null` (anytime) is rendered after these. */
export const PHASE_ORDER: readonly ChoreTimeOfDay[] = ["MORNING", "DAY", "EVENING"];

export function phaseOf(now: Date): DayPhase {
  const h = now.getHours();
  if (h < PHASE_START_HOUR.MORNING) return "NIGHT";
  if (h < PHASE_START_HOUR.DAY) return "MORNING";
  if (h < PHASE_START_HOUR.EVENING) return "DAY";
  return "EVENING";
}

/** Phases that already ended today, most recent first (EVENING → DAY → MORNING). */
export function earlierPhases(phase: DayPhase): ChoreTimeOfDay[] {
  if (phase === "NIGHT") return [];
  const idx = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER.slice(0, idx).reverse();
}

export function laterPhases(phase: DayPhase): ChoreTimeOfDay[] {
  if (phase === "NIGHT") return [...PHASE_ORDER];
  const idx = PHASE_ORDER.indexOf(phase);
  return PHASE_ORDER.slice(idx + 1);
}
