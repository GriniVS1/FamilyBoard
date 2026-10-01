/**
 * Card widths that change what a card can show. Measured, not guessed from the
 * viewport, because a wall column at 1280 px and a phone card differ by ~40 px.
 */

/** Below this the row drops to a smaller picture and ring so the title keeps room. */
export const TIGHT_MAX_WIDTH = 290;
/** From here the ring can grow to its full 64 px. */
export const ROOMY_MIN_WIDTH = 380;
