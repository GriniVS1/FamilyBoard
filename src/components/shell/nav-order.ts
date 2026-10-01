import type { NavConfigItem, NavKey } from "@/lib/nav-config";

// Which group an area belongs to is fixed; only the order inside a group and
// the visibility come from the saved config.
const KID_AREAS: readonly NavKey[] = ["chores", "calendar", "meals", "photos"];
const ADULT_AREAS: readonly NavKey[] = ["todos", "notes"];

// Installs that never touched the setting still hold the original default
// order. It would put "Calendar" before "Chores" and contradict the fixed
// child-first layout, so it is treated as "no preference".
const LEGACY_DEFAULT_ORDER = "calendar,meals,chores,todos,notes,photos";

/** Always first among the children's areas, on the wall rail and on a phone alike. */
export const PINNED_NAV_KEY: NavKey = "chores";

export type NavGroupItem = { key: NavKey; enabled: boolean };

export type NavOrder = { kids: NavGroupItem[]; adults: NavGroupItem[] };

export function resolveNavOrder(config: readonly NavConfigItem[] | undefined): NavOrder {
  const saved = config ?? [];
  const untouched =
    saved.length === 0 || saved.map((item) => item.key).join(",") === LEGACY_DEFAULT_ORDER;
  const enabledByKey = new Map(saved.map((item) => [item.key, item.enabled]));
  const order = (areas: readonly NavKey[]): NavGroupItem[] => {
    const keys = untouched
      ? [...areas]
      : saved.map((item) => item.key).filter((key) => areas.includes(key));
    return keys.map((key) => ({ key, enabled: enabledByKey.get(key) ?? true }));
  };
  const kids = order(KID_AREAS);
  const pinned = kids.filter((item) => item.key === PINNED_NAV_KEY);
  return {
    kids: [...pinned, ...kids.filter((item) => item.key !== PINNED_NAV_KEY)],
    adults: order(ADULT_AREAS),
  };
}

/** Full list in the shape the API stores: kids first, then adults. */
export function flattenNavOrder({ kids, adults }: NavOrder): NavConfigItem[] {
  return [...kids, ...adults].map(({ key, enabled }) => ({ key, enabled }));
}
