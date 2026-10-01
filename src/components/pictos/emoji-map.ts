import { PICTO_META, type PictoCategory, type PictoName } from "./registry";

/**
 * Keys are stored WITHOUT variation selectors / skin tones; `normalizeEmoji`
 * strips those from input, so "🍽️" and "🍽" both hit. Navigation motifs are
 * deliberately absent — an emoji on content (🏠 on a chore) means the chore,
 * not the app section. An emoji may appear in several rows (🦷 = teeth for a
 * chore, doctor for an event); row order is the priority.
 */
const TABLE: Array<[PictoName, string[]]> = [
  ["water", ["💧", "🚰", "🥤", "🫗", "🥛", "🧊", "🍶"]],
  ["teeth", ["🪥", "🦷"]],
  ["tidy-toys", ["🧸", "🪀", "🧩", "🪆", "🚂", "🎲"]],
  ["get-dressed", ["👕", "👚", "👗", "👖", "🧦", "🧥", "👔", "🩳", "🧤", "🧣"]],
  ["make-bed", ["🛏"]],
  ["set-table", ["🍽", "🥢"]],
  ["feed-dog", ["🐶", "🐕", "🦮", "🐩", "🦴", "🐕‍🦺"]],
  ["feed-cat", ["🐱", "🐈", "🐈‍⬛", "🐟", "🐠", "🐹", "🐰", "🐇"]],
  ["trash", ["🚮", "🗑", "♻", "🚯"]],
  ["water-plants", ["🌱", "🪴", "🌻", "🌷", "🌿", "🌼", "🌸", "🌵"]],
  ["homework", ["✏", "📚", "📝", "✍", "🖊", "📐", "🖋", "📏", "🧮"]],
  ["read", ["📖", "📕", "📗", "📘", "📙", "📚"]],
  ["laundry", ["🧺", "👙"]],
  ["wash-clothes", ["🫧", "🧺"]],
  ["dishes", ["🧽", "🫙"]],
  ["wash-hands", ["🧼", "👐", "🙌", "🤲", "🫧"]],
  ["bath", ["🛁", "🚿", "🛀", "🦆", "🧴"]],
  ["pajamas", ["🛌", "😴", "💤", "🥱"]],
  ["backpack", ["🎒"]],
  ["sweep", ["🧹"]],
  ["vacuum", ["🌪", "💨"]],
  ["breakfast", ["🥣", "🍳", "🥐", "🍞", "🥞", "🍎", "🍌", "🥪", "🥄", "🧇", "🍓", "🍏"]],
  ["medicine", ["💊", "💉", "🌡", "🤒", "🧪"]],
  ["music", ["🎹", "🎵", "🎶", "🎼", "🪈", "🎺", "🥁", "🎻", "🪗", "🪘"]],
  ["tidy-room", ["🗄", "🚪", "🛋", "🪑", "🏠", "🏡"]],
  ["shoes", ["👟", "👞", "🥾", "👢", "🩴", "👠", "🥿"]],
  ["shopping", ["🛒", "🛍", "🧾", "🏪"]],
  ["tod-morning", ["🌅", "🌄", "🐓"]],
  ["tod-day", ["☀", "🌞", "🌤"]],
  ["tod-evening", ["🌙", "🌃", "🌌"]],
  ["tod-night", ["🌛", "🌜", "🌚", "💤"]],
  ["tod-anytime", ["🌗", "🌓", "🕒", "⏰", "🕐", "⌚", "⏱", "🕰"]],
  ["celebrate", ["🏆", "🎉", "🥳", "🎊", "🏅", "🥇"]],
  ["oops", ["🩹"]],
  ["relax", ["🏖", "⛱", "🧘", "😌"]],
  ["star", ["⭐", "🌟", "✨", "💫"]],
  ["undo", ["↩", "↶", "🔙"]],
  ["next", ["👉", "➡", "▶"]],
  ["pause", ["⏳", "⌛", "⏸"]],
  ["event-school", ["🏫", "🧑‍🏫", "👩‍🏫", "👨‍🏫", "🎓", "📚", "✏"]],
  ["event-kindergarten", ["🖍", "🧱", "🎨", "🖌", "✂"]],
  ["event-soccer", ["⚽", "🥅"]],
  ["event-swim", ["🏊", "🩱", "🤿", "🥽"]],
  ["event-doctor", ["🩺", "🏥", "🧑‍⚕", "👩‍⚕", "👨‍⚕", "🚑", "🦷", "💊", "💉"]],
  ["event-birthday", ["🎂", "🎁", "🎈", "🧁", "🍰"]],
  ["event-dinner", ["🍲", "🍝", "🍕", "🥘", "🍛", "🍜", "🍴", "🥗", "🍖", "🍗", "🍽", "🍳", "🥐", "🥞"]],
  ["event-music", ["🎸", "🎤", "🎷", "🎙", "🎧", "🎹", "🎵", "🎶", "🎼", "🎻", "🥁", "🪈", "🎺", "🪗"]],
  ["event-play", ["🪣", "🛝", "🪁", "🏐", "🏀", "🎠", "🤸", "🧸", "🧩"]],
  ["event-trip", ["🚗", "🚙", "🚌", "🚆", "✈", "🏔", "⛰", "🧳", "🏕", "🗺", "🚂", "⛵", "🦁", "🐘"]],
  ["event-bike", ["🚲", "🚴", "🛴", "🛹", "🚵"]],
];

const MAP: ReadonlyMap<string, readonly PictoName[]> = (() => {
  const map = new Map<string, PictoName[]>();
  for (const [name, list] of TABLE) {
    for (const emoji of list) {
      const key = normalizeEmoji(emoji);
      const names = map.get(key) ?? [];
      if (!names.includes(name)) names.push(name);
      map.set(key, names);
    }
  }
  return map;
})();

export function normalizeEmoji(input: string): string {
  return input
    .trim()
    .replace(/[︎️]/g, "")
    .replace(/[\u{1F3FB}-\u{1F3FF}]/gu, "")
    .replace(/‍[♀♂]/g, "");
}

function candidates(key: string): readonly PictoName[] {
  const direct = MAP.get(key);
  if (direct) return direct;
  const [head] = key.split("\u200D");
  if (head && head !== key) return MAP.get(head) ?? [];
  const first = Array.from(key)[0];
  return first && first !== key ? (MAP.get(first) ?? []) : [];
}

/**
 * Motif for an emoji. With `categories`, only motifs of those categories
 * count (🌙 on a chore is not a chore picture → null).
 */
export function pictoFromEmoji(
  emoji: string | null | undefined,
  categories?: readonly PictoCategory[],
): PictoName | null {
  if (!emoji) return null;
  const key = normalizeEmoji(emoji);
  if (!key) return null;
  const list = candidates(key);
  const hit = categories ? list.find((n) => categories.includes(PICTO_META[n].category)) : list[0];
  return hit ?? null;
}

export const EMOJI_TO_PICTO = MAP;
