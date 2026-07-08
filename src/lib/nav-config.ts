import "server-only";

import { db } from "./db";

// Which features appear in the wall's navigation, and in what order.
// Dashboard and Settings are deliberately NOT configurable: Dashboard is the
// home route, and hiding Settings would lock the user out of the very screen
// that could undo it.
export const NAV_KEYS = [
  "calendar",
  "meals",
  "chores",
  "todos",
  "notes",
  "photos",
] as const;

export type NavKey = (typeof NAV_KEYS)[number];

export type NavConfigItem = { key: NavKey; enabled: boolean };

const SETTING_KEY = "nav_config";

const DEFAULTS: NavConfigItem[] = NAV_KEYS.map((key) => ({ key, enabled: true }));

function isNavKey(v: string): v is NavKey {
  return (NAV_KEYS as readonly string[]).includes(v);
}

// Merge a stored config with the defaults so the shape is always complete and
// forward-compatible: unknown keys (removed features) are dropped, missing
// keys (features added after the config was saved) are appended enabled.
export function mergeNavConfig(stored: unknown): NavConfigItem[] {
  const out: NavConfigItem[] = [];
  const seen = new Set<NavKey>();
  if (Array.isArray(stored)) {
    for (const item of stored) {
      if (
        item &&
        typeof item === "object" &&
        "key" in item &&
        typeof (item as { key: unknown }).key === "string" &&
        isNavKey((item as { key: string }).key)
      ) {
        const key = (item as { key: NavKey }).key;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ key, enabled: (item as { enabled?: unknown }).enabled !== false });
      }
    }
  }
  for (const d of DEFAULTS) {
    if (!seen.has(d.key)) out.push({ ...d });
  }
  return out;
}

export async function getNavConfig(): Promise<NavConfigItem[]> {
  try {
    const row = await db.setting.findUnique({ where: { key: SETTING_KEY } });
    if (!row) return DEFAULTS.map((d) => ({ ...d }));
    return mergeNavConfig(JSON.parse(row.value));
  } catch {
    return DEFAULTS.map((d) => ({ ...d }));
  }
}

export async function setNavConfig(items: NavConfigItem[]): Promise<NavConfigItem[]> {
  const merged = mergeNavConfig(items);
  await db.setting.upsert({
    where: { key: SETTING_KEY },
    update: { value: JSON.stringify(merged) },
    create: { key: SETTING_KEY, value: JSON.stringify(merged) },
  });
  return merged;
}
