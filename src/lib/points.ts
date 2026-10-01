export type PointCompletion = { points: number; completedAt: Date };

// Strictly greater: a completion stamped at the exact reset instant belongs to
// the balance that the reset just cleared, never to the new one.
export function computeBalance(
  completions: readonly PointCompletion[],
  since: Date | null,
): number {
  const sinceMs = since === null ? null : since.getTime();
  let total = 0;
  for (const c of completions) {
    if (sinceMs === null || c.completedAt.getTime() > sinceMs) {
      total += c.points;
    }
  }
  return total;
}

let tail: Promise<unknown> = Promise.resolve();

// Two overlapping resets would both read the same balance before either writes,
// leaving a duplicate record whose undo restores nothing. One Node process owns
// the database, so an in-process queue is enough.
export function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}
