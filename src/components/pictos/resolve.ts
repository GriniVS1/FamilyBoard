import { pictoFromEmoji } from "./emoji-map";
import { PICTO_META, isPictoName, type PictoCategory, type PictoName } from "./registry";
import { matchTitle, suggestPicto } from "./suggest";

/** Optional explicit form for `icon`; storing the canonical emoji is preferred (mobile app shows emoji). */
export const PICTO_ICON_PREFIX = "picto:";

function explicitPicto(raw: string): PictoName | null {
  const bare = raw.startsWith(PICTO_ICON_PREFIX) ? raw.slice(PICTO_ICON_PREFIX.length) : raw;
  return isPictoName(bare) ? bare : null;
}

/**
 * Picture for content of one category, in this order:
 * 1. an explicit picto name in `icon` ("water" / "picto:water") of that category;
 * 2. a specific title keyword of that category — it beats the emoji because
 *    stored emoji are often generic (📚 on "Hausaufgaben", 🌙 on "Pyjama anziehen");
 * 3. the emoji, if it maps into that category (🌙 → evening does not count);
 * 4. a weak title keyword ("füttern"), else null.
 */
function resolveIn(icon: string | null, title: string, category: PictoCategory): PictoName | null {
  const raw = icon?.trim() ?? "";
  const cats = [category] as const;
  const explicit = raw ? explicitPicto(raw) : null;
  if (explicit && PICTO_META[explicit].category === category) return explicit;
  const fromTitle = matchTitle(title, cats);
  if (fromTitle && !fromTitle.weak) return fromTitle.name;
  const fromEmoji = raw ? pictoFromEmoji(raw, cats) : null;
  return fromEmoji ?? fromTitle?.name ?? null;
}

/** Chore cards, chore dialog, toasts about a chore: task motifs only. */
export function resolveTaskPicto(icon: string | null, title: string): PictoName | null {
  return resolveIn(icon, title, "task");
}

/** Calendar events: event motifs only. */
export function resolveEventPicto(icon: string | null, title: string): PictoName | null {
  return resolveIn(icon, title, "event");
}

/**
 * Compatibility: any category, emoji beats title. Content should use
 * `resolveTaskPicto` / `resolveEventPicto`.
 */
export function resolvePicto(icon: string | null, title: string): PictoName | null {
  const raw = icon?.trim() ?? "";
  if (raw) {
    const explicit = explicitPicto(raw);
    if (explicit) return explicit;
    const fromEmoji = pictoFromEmoji(raw);
    if (fromEmoji) return fromEmoji;
  }
  return suggestPicto(title);
}
