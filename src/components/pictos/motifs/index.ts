import type { PictoName } from "../registry";
import type { Motif } from "../types";
import { EVENT_MOTIFS } from "./events";
import { NAV_MOTIFS } from "./nav";
import { TASK_MOTIFS } from "./tasks";
import { FEEDBACK_MOTIFS, TIME_MOTIFS } from "./time-feedback";

export const MOTIFS: Record<PictoName, Motif> = {
  ...TASK_MOTIFS,
  ...NAV_MOTIFS,
  ...TIME_MOTIFS,
  ...FEEDBACK_MOTIFS,
  ...EVENT_MOTIFS,
};
