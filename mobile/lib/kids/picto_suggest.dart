/// Port of `src/components/pictos/suggest.ts`: keyword -> motif for chore,
/// event and to-do titles (de, de-CH, en, fr, it).
///
/// Matching rule, chosen so German compounds work without false positives:
///   `=word`    exact word only            (`=bad` hits "Bad", not "Badminton")
///   <= 4 letters  must start a word       (`zahn` hits "Zahnbuerste")
///   >= 5 letters  anywhere, mid-word too  (`geburtstag` hits "Kindergeburtstag")
///   `~word`    weak: only wins if nothing specific matched
/// The LONGEST matching keyword wins; on a tie the one that appears first in
/// the title wins.
library;

import 'latin_fold.dart';
import 'picto_catalog.g.dart';
import 'picto_keywords.dart';

class _Entry {
  const _Entry({
    required this.name,
    required this.kw,
    required this.exact,
    required this.weak,
    required this.weight,
  });

  final String name;
  final String kw;
  final bool exact;
  final bool weak;
  final int weight;
}

final List<_Entry> _entries = <_Entry>[
  for (final (String name, List<String> list) in kPictoKeywords)
    for (final String raw in list) _parse(name, raw),
];

_Entry _parse(String name, String raw) {
  final bool weak = raw.startsWith('~');
  final String rest = weak ? raw.substring(1) : raw;
  final bool exact = rest.startsWith('=');
  final String kw = exact ? rest.substring(1) : rest;
  final int letters = kw.replaceAll(' ', '').length;
  return _Entry(
    name: name,
    kw: kw,
    exact: exact,
    weak: weak,
    weight: weak ? 1 : letters,
  );
}

final RegExp _nonAlnum = RegExp('[^a-z0-9]+');
final RegExp _combiningMarks = RegExp('[\u{0300}-\u{036F}]');

/// Lower-case ASCII, umlauts folded (a-umlaut -> a, sharp s -> ss), every
/// other run of characters collapsed to one space.
String normalizeTitle(String title) {
  final StringBuffer out = StringBuffer();
  for (final String ch
      in title
          .toLowerCase()
          .replaceAll('\u{DF}', 'ss')
          .replaceAll('\u{E6}', 'ae')
          .replaceAll('\u{153}', 'oe')
          .replaceAll(_combiningMarks, '')
          .split('')) {
    out.write(kLatinBase[ch] ?? ch);
  }
  return out.toString().replaceAll(_nonAlnum, ' ').trim();
}

int _matchIndex(String padded, List<String> words, _Entry entry) {
  if (entry.exact) {
    if (entry.kw.contains(' ')) {
      return padded.indexOf(' ${entry.kw} ');
    }
    return words.contains(entry.kw) ? padded.indexOf(' ${entry.kw} ') : -1;
  }
  if (entry.kw.replaceAll(' ', '').length <= 4 || entry.kw.contains(' ')) {
    return padded.indexOf(' ${entry.kw}');
  }
  return padded.indexOf(entry.kw);
}

class TitleMatch {
  const TitleMatch({required this.name, required this.weak});

  final String name;
  final bool weak;
}

/// Best keyword match, optionally restricted to motif [categories].
TitleMatch? matchTitle(String? title, [Set<PictoCategory>? categories]) {
  if (title == null || title.isEmpty) {
    return null;
  }
  final String norm = normalizeTitle(title);
  if (norm.isEmpty) {
    return null;
  }
  final String padded = ' $norm ';
  final List<String> words = norm.split(' ');

  _Entry? best;
  int bestIndex = -1;
  for (final _Entry entry in _entries) {
    if (categories != null &&
        !categories.contains(kPictoCatalog[entry.name]!.category)) {
      continue;
    }
    final int index = _matchIndex(padded, words, entry);
    if (index == -1) {
      continue;
    }
    if (best == null ||
        entry.weight > best.weight ||
        (entry.weight == best.weight && index < bestIndex)) {
      best = entry;
      bestIndex = index;
    }
  }
  return best == null ? null : TitleMatch(name: best.name, weak: best.weak);
}

/// Best motif for a free-text title, or null when nothing fits well enough.
String? suggestPicto(String? title) => matchTitle(title)?.name;
