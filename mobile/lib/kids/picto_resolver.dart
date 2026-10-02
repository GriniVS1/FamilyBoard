/// Port of `src/components/pictos/resolve.ts` (R3.2).
///
/// Motifs are plain kebab-case names (`'water'`); see [kPictoCatalog]. A null
/// result means "no fitting motif": show the neutral fallback (a star or the
/// calendar leaf in the member colour).
library;

import 'emoji_map.dart';
import 'picto_catalog.g.dart';
import 'picto_suggest.dart';

/// Optional explicit form for `icon` (`picto:water`). Storing the canonical
/// emoji is preferred, see [canonicalEmojiFor].
const String kPictoIconPrefix = 'picto:';

String? _explicitPicto(String raw) {
  final String bare = raw.startsWith(kPictoIconPrefix)
      ? raw.substring(kPictoIconPrefix.length)
      : raw;
  return kPictoCatalog.containsKey(bare) ? bare : null;
}

/// Picture for content of one [category], in this order:
/// 1. an explicit picto name in [icon] ("water" / "picto:water") of that
///    category;
/// 2. a specific title keyword of that category: it beats the emoji because
///    stored emoji are often generic (a book on "Hausaufgaben");
/// 3. the emoji, if it maps into that category (a moon does not count);
/// 4. a weak title keyword, else null.
String? _resolveIn(String? icon, String title, PictoCategory category) {
  final String raw = icon?.trim() ?? '';
  final Set<PictoCategory> cats = <PictoCategory>{category};
  final String? explicit = raw.isEmpty ? null : _explicitPicto(raw);
  if (explicit != null && kPictoCatalog[explicit]!.category == category) {
    return explicit;
  }
  final TitleMatch? fromTitle = matchTitle(title, cats);
  if (fromTitle != null && !fromTitle.weak) {
    return fromTitle.name;
  }
  final String? fromEmoji = raw.isEmpty ? null : pictoFromEmoji(raw, cats);
  return fromEmoji ?? fromTitle?.name;
}

/// Chore cards, chore dialogs, toasts about a chore: task motifs only.
String? resolveTaskPicto(String? icon, String title) =>
    _resolveIn(icon, title, PictoCategory.task);

/// Calendar events: event motifs only.
String? resolveEventPicto(String? icon, String title) =>
    _resolveIn(icon, title, PictoCategory.event);

/// Compatibility: any category, emoji beats title. Content should use
/// [resolveTaskPicto] / [resolveEventPicto].
String? resolvePicto(String? icon, String title) {
  final String raw = icon?.trim() ?? '';
  if (raw.isNotEmpty) {
    final String? explicit = _explicitPicto(raw);
    if (explicit != null) {
      return explicit;
    }
    final String? fromEmoji = pictoFromEmoji(raw);
    if (fromEmoji != null) {
      return fromEmoji;
    }
  }
  return suggestPicto(title);
}

/// Canonical emoji of a motif (R3.3): what create/edit flows store in
/// `Chore.icon`, never the motif name. Null for an unknown motif.
String? canonicalEmojiFor(String motif) => kPictoCatalog[motif]?.emoji;

/// Motifs a task can be given, in manifest order (for a future picker).
List<PictoMeta> pictosOfCategory(PictoCategory category) => <PictoMeta>[
  for (final PictoMeta meta in kPictoCatalog.values)
    if (meta.category == category) meta,
];
