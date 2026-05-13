/// POD models for the GET /api/mobile/events response.
library;

class EventMember {
  const EventMember({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory EventMember.fromJson(Map<String, Object?> json) {
    return EventMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji'] is String ? json['emoji']! as String : '',
    );
  }

  final String id;
  final String name;

  /// One of the 8 accent names ("peach", "mint", "sun", …).
  final String color;
  final String emoji;
}

class MobileEvent {
  const MobileEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.startsAt,
    required this.endsAt,
    required this.allDay,
    required this.color,
    required this.source,
    required this.member,
  });

  factory MobileEvent.fromJson(Map<String, Object?> json) {
    final Object? startsRaw = json['startsAt'];
    final Object? endsRaw = json['endsAt'];
    final Map<String, Object?> memberJson =
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>();

    return MobileEvent(
      id: json['id']! as String,
      title: json['title']! as String,
      description:
          json['description'] is String ? json['description']! as String : null,
      location: json['location'] is String ? json['location']! as String : null,
      startsAt: startsRaw is String ? DateTime.parse(startsRaw) : null,
      endsAt: endsRaw is String ? DateTime.parse(endsRaw) : null,
      allDay: json['allDay'] == true,
      color: json['color'] is String ? json['color']! as String : null,
      source: json['source'] is String ? json['source']! as String : 'LOCAL',
      member: EventMember.fromJson(memberJson),
    );
  }

  final String id;
  final String title;
  final String? description;
  final String? location;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final bool allDay;

  /// Accent name override (e.g. "mint"). Falls back to member.color when null.
  final String? color;

  /// "LOCAL" | "GOOGLE" | "CALDAV" | "MICROSOFT"
  final String source;

  final EventMember member;

  /// The day key used for grouping: local date at midnight derived from startsAt.
  /// Events with no startsAt are grouped under DateTime(0) (treated as all-day today).
  DateTime get groupDay {
    final DateTime? start = startsAt;
    if (start == null) {
      return DateTime(0);
    }
    final DateTime local = start.toLocal();
    return DateTime(local.year, local.month, local.day);
  }
}
