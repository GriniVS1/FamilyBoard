/// Port of `src/components/pictos/emoji-map.ts`.
///
/// Keys are stored WITHOUT variation selectors / skin tones;
/// [normalizeEmoji] strips those from input, so both the text and the emoji
/// presentation of an emoji hit. Navigation motifs are deliberately absent:
/// an emoji on content (a house on a chore) means the chore, not the app
/// section. An emoji may appear in several rows (teeth for a chore, doctor
/// for an event); row order is the priority.
library;

import 'emoji_table.dart';
import 'picto_catalog.g.dart';

final RegExp _variationSelectors = RegExp('[\u{FE0E}\u{FE0F}]');
final RegExp _skinTones = RegExp('[\u{1F3FB}-\u{1F3FF}]', unicode: true);
final RegExp _genderSign = RegExp('\u{200D}[\u{2640}\u{2642}]');

String normalizeEmoji(String input) => input
    .trim()
    .replaceAll(_variationSelectors, '')
    .replaceAll(_skinTones, '')
    .replaceAll(_genderSign, '');

final Map<String, List<String>> _emojiToPicto = () {
  final Map<String, List<String>> map = <String, List<String>>{};
  for (final (String name, List<String> list) in kEmojiTable) {
    for (final String emoji in list) {
      final List<String> names = map.putIfAbsent(
        normalizeEmoji(emoji),
        () => <String>[],
      );
      if (!names.contains(name)) {
        names.add(name);
      }
    }
  }
  return map;
}();

/// Normalised emoji -> candidate motifs, in priority order.
Map<String, List<String>> get emojiToPicto => _emojiToPicto;

List<String> _candidates(String key) {
  final List<String>? direct = _emojiToPicto[key];
  if (direct != null) {
    return direct;
  }
  final String head = key.split('\u{200D}').first;
  if (head.isNotEmpty && head != key) {
    return _emojiToPicto[head] ?? const <String>[];
  }
  final String first = String.fromCharCode(key.runes.first);
  return first != key
      ? (_emojiToPicto[first] ?? const <String>[])
      : const <String>[];
}

/// Motif for an emoji. With [categories], only motifs of those categories
/// count (a moon on a chore is not a chore picture -> null).
String? pictoFromEmoji(String? emoji, [Set<PictoCategory>? categories]) {
  if (emoji == null || emoji.isEmpty) {
    return null;
  }
  final String key = normalizeEmoji(emoji);
  if (key.isEmpty) {
    return null;
  }
  final List<String> list = _candidates(key);
  if (categories == null) {
    return list.isEmpty ? null : list.first;
  }
  for (final String name in list) {
    if (categories.contains(kPictoCatalog[name]!.category)) {
      return name;
    }
  }
  return null;
}
