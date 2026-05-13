/// POD model for a sticky note returned by `GET /api/mobile/notes`.
library;

class NoteAuthor {
  const NoteAuthor({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory NoteAuthor.fromJson(Map<String, Object?> json) {
    return NoteAuthor(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji']! as String,
    );
  }

  final String id;
  final String name;
  final String color;
  final String emoji;
}

class Note {
  const Note({
    required this.id,
    required this.familyId,
    required this.body,
    required this.color,
    required this.pinned,
    required this.createdAt,
    required this.author,
  });

  factory Note.fromJson(Map<String, Object?> json) {
    final Object? authorRaw = json['author'];
    final NoteAuthor? author = authorRaw is Map
        ? NoteAuthor.fromJson(
            (authorRaw as Map<Object?, Object?>).cast<String, Object?>(),
          )
        : null;

    return Note(
      id: json['id']! as String,
      familyId: json['familyId']! as String,
      body: json['body']! as String,
      color: json['color'] is String ? json['color']! as String : 'sun',
      pinned: json['pinned'] == true,
      createdAt: DateTime.parse(json['createdAt']! as String),
      author: author,
    );
  }

  final String id;
  final String familyId;
  final String body;

  /// One of the 8 accent names: peach mint sun sky lilac rose teal sand.
  final String color;

  final bool pinned;
  final DateTime createdAt;

  /// Null when the original author has since been deleted.
  final NoteAuthor? author;
}
