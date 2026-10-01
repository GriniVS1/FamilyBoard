// Pure rules behind "nothing moves under a child who is tapping". Kept free of
// React so `node --test` covers them directly.

/** After a tick, taps on other cards of the same column are ignored this long (a double tap is < 500 ms). */
export const COLUMN_TAP_LOCK_MS = 600;
/**
 * Taps this soon after cards moved are dropped: the finger aimed at the old picture.
 * The move animates for ~400 ms, so the guard runs a little past it.
 */
export const LAYOUT_TAP_GUARD_MS = 600;
/** A scroll gesture leaves taps in the scrolled column unreliable for this long. */
export const SCROLL_TAP_GUARD_MS = 300;
/** Key for scrolls outside any column: the whole page moved. */
export const PAGE_SCROLL_KEY = "page";
/** A column keeps its layout until it has been left alone this long and no ↶ window is open. */
export const LAYOUT_QUIET_MS = 3000;

export type LastCompletion = { columnKey: string; choreId: string; at: number };

export function columnTapAllowed(
  last: LastCompletion | null,
  columnKey: string,
  choreId: string,
  now: number,
  lockMs: number = COLUMN_TAP_LOCK_MS,
): boolean {
  if (!last || last.columnKey !== columnKey || last.choreId === choreId) return true;
  return now - last.at >= lockMs;
}

export function layoutTapAllowed(
  lastShiftAt: number | null,
  now: number,
  guardMs: number = LAYOUT_TAP_GUARD_MS,
): boolean {
  return lastShiftAt === null || now - lastShiftAt >= guardMs;
}

/**
 * A scroll only invalidates taps in the column that scrolled (or after a page
 * scroll, everywhere). A sibling's column must not lose a tap to it.
 */
export function scrollTapAllowedIn(
  scrolls: ReadonlyMap<string, number>,
  columnKey: string,
  now: number,
  guardMs: number = SCROLL_TAP_GUARD_MS,
): boolean {
  const column = scrolls.get(columnKey);
  const page = scrolls.get(PAGE_SCROLL_KEY);
  return (column === undefined || now - column >= guardMs) && (page === undefined || now - page >= guardMs);
}

/**
 * Cards move per column, so only a tap in the column that just moved is at risk.
 * A reorder of one child's column must never swallow a sibling's tap.
 */
export function layoutTapAllowedIn(
  shifts: ReadonlyMap<string, number>,
  columnKey: string,
  now: number,
  guardMs: number = LAYOUT_TAP_GUARD_MS,
): boolean {
  return layoutTapAllowed(shifts.get(columnKey) ?? null, now, guardMs);
}

export function shouldHoldLayout(input: {
  now: number;
  lastTouchAt: number;
  windowOpen: boolean;
  quietMs?: number;
}): boolean {
  const { now, lastTouchAt, windowOpen, quietMs = LAYOUT_QUIET_MS } = input;
  return windowOpen || now - lastTouchAt < quietMs;
}
