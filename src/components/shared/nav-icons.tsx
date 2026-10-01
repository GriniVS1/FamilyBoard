import type { PictoName } from "@/components/pictos";
import type { NavKey } from "@/lib/nav-config";
import type { MemberColor } from "@/lib/utils";

// Shared between the shell (rendering) and the settings nav-config card (the
// "which picture goes with this feature" picker), so they can never drift.
export type NavEntryKey = "dashboard" | NavKey | "settings";

export const NAV_PICTO: Record<NavEntryKey, PictoName> = {
  dashboard: "nav-home",
  calendar: "nav-calendar",
  meals: "nav-meals",
  chores: "nav-tasks",
  todos: "nav-todos",
  notes: "nav-notes",
  photos: "nav-photos",
  settings: "nav-settings",
};

export const NAV_COLOR: Record<NavEntryKey, MemberColor> = {
  dashboard: "rose",
  calendar: "sky",
  meals: "peach",
  chores: "sun",
  todos: "mint",
  notes: "lilac",
  photos: "teal",
  settings: "sand",
};

export const NAV_HREF: Record<NavEntryKey, string> = {
  dashboard: "/",
  calendar: "/calendar",
  meals: "/meals",
  chores: "/chores",
  todos: "/todos",
  notes: "/notes",
  photos: "/photos",
  settings: "/settings",
};

// Fixed on purpose: children's areas always come before the adult ones, so the
// configurable part of the nav is only which areas are visible.
export const KID_NAV_ORDER: readonly NavEntryKey[] = [
  "dashboard",
  "chores",
  "calendar",
  "meals",
  "photos",
];

export const ADULT_NAV_ORDER: readonly NavEntryKey[] = ["todos", "notes", "settings"];
