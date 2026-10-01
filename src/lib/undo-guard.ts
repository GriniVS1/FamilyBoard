/**
 * A ↶ that just appeared stays inert for this long, so the second tap of a
 * child's double tap cannot undo what the first tap just did.
 */
export const UNDO_ARM_MS = 600;

export function isUndoArmed(shownAt: number, now: number, armMs: number = UNDO_ARM_MS): boolean {
  return now - shownAt >= armMs;
}
