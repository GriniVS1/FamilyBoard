import type { ReactNode } from "react";

export const PICTO_MOTIONS = [
  "drop",
  "pour",
  "scrub",
  "wiggle",
  "bounce",
  "spin",
  "float",
] as const;

export type PictoMotion = (typeof PICTO_MOTIONS)[number];

/**
 * A motif is drawn in three layers so the animated part can sit between
 * scenery (e.g. a toy falling *into* a box whose front panel covers it).
 */
export type Motif = {
  motion: PictoMotion;
  /** transform-origin in 64×64 view-box units, e.g. "48px 26px". */
  origin?: string;
  back?: ReactNode;
  move: ReactNode;
  front?: ReactNode;
};
