import type { PictoName } from "@/components/pictos";
import type { ChoreTimeOfDay } from "@/lib/enums";

export type PictoDefaults = {
  timeOfDay: ChoreTimeOfDay | null;
  points: number;
};

/** What picking a picture pre-fills in the chore dialog; every value can still be changed. */
export const PICTO_DEFAULTS: Partial<Record<PictoName, PictoDefaults>> = {
  water: { timeOfDay: null, points: 1 },
  teeth: { timeOfDay: "MORNING", points: 1 },
  "tidy-toys": { timeOfDay: "EVENING", points: 2 },
  "get-dressed": { timeOfDay: "MORNING", points: 1 },
  "make-bed": { timeOfDay: "MORNING", points: 1 },
  "set-table": { timeOfDay: "EVENING", points: 2 },
  "feed-dog": { timeOfDay: "MORNING", points: 2 },
  "feed-cat": { timeOfDay: "MORNING", points: 2 },
  trash: { timeOfDay: "EVENING", points: 2 },
  "water-plants": { timeOfDay: null, points: 1 },
  homework: { timeOfDay: "DAY", points: 3 },
  read: { timeOfDay: "EVENING", points: 1 },
  laundry: { timeOfDay: null, points: 3 },
  "wash-clothes": { timeOfDay: null, points: 2 },
  dishes: { timeOfDay: "EVENING", points: 2 },
  "wash-hands": { timeOfDay: "DAY", points: 1 },
  bath: { timeOfDay: "EVENING", points: 2 },
  pajamas: { timeOfDay: "EVENING", points: 1 },
  backpack: { timeOfDay: "MORNING", points: 1 },
  sweep: { timeOfDay: null, points: 2 },
  vacuum: { timeOfDay: null, points: 3 },
  breakfast: { timeOfDay: "MORNING", points: 1 },
  medicine: { timeOfDay: "MORNING", points: 1 },
  music: { timeOfDay: "DAY", points: 2 },
  "tidy-room": { timeOfDay: "EVENING", points: 2 },
  shoes: { timeOfDay: "DAY", points: 1 },
  shopping: { timeOfDay: null, points: 2 },
};

export type PictoCategoryKey = "body" | "dress" | "tidy" | "food" | "nature" | "school" | "help";

export const PICTO_GROUPS: ReadonlyArray<{ key: PictoCategoryKey; pictos: readonly PictoName[] }> = [
  { key: "body", pictos: ["teeth", "wash-hands", "bath", "pajamas", "medicine"] },
  { key: "dress", pictos: ["get-dressed", "shoes"] },
  { key: "tidy", pictos: ["tidy-toys", "tidy-room", "make-bed", "sweep", "vacuum"] },
  { key: "food", pictos: ["water", "breakfast", "set-table", "dishes"] },
  { key: "nature", pictos: ["feed-dog", "feed-cat", "water-plants"] },
  { key: "school", pictos: ["backpack", "homework", "read", "music"] },
  { key: "help", pictos: ["laundry", "wash-clothes", "trash", "shopping"] },
];
