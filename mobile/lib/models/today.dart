/// POD models for the GET /api/mobile/today response.
library;

class TodayMember {
  const TodayMember({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory TodayMember.fromJson(Map<String, Object?> json) {
    return TodayMember(
      id: json['id']! as String,
      name: json['name']! as String,
      color: json['color']! as String,
      emoji: json['emoji'] is String ? json['emoji']! as String : '',
    );
  }

  final String id;
  final String name;
  final String color;
  final String emoji;
}

class TodayEvent {
  const TodayEvent({
    required this.id,
    required this.title,
    required this.description,
    required this.location,
    required this.startsAt,
    required this.endsAt,
    required this.allDay,
    required this.color,
  });

  factory TodayEvent.fromJson(Map<String, Object?> json) {
    final Object? startsRaw = json['startsAt'];
    final Object? endsRaw = json['endsAt'];
    return TodayEvent(
      id: json['id']! as String,
      title: json['title']! as String,
      description:
          json['description'] is String ? json['description']! as String : null,
      location: json['location'] is String ? json['location']! as String : null,
      startsAt: startsRaw is String ? DateTime.parse(startsRaw) : null,
      endsAt: endsRaw is String ? DateTime.parse(endsRaw) : null,
      allDay: json['allDay'] == true,
      color: json['color'] is String ? json['color']! as String : null,
    );
  }

  final String id;
  final String title;
  final String? description;
  final String? location;
  final DateTime? startsAt;
  final DateTime? endsAt;
  final bool allDay;

  /// Accent name override (e.g. "mint"). Falls back to member color when null.
  final String? color;
}

class TodayChore {
  const TodayChore({
    required this.id,
    required this.title,
    required this.icon,
    required this.points,
    required this.completedToday,
  });

  factory TodayChore.fromJson(Map<String, Object?> json) {
    return TodayChore(
      id: json['id']! as String,
      title: json['title']! as String,
      icon: json['icon'] is String ? json['icon']! as String : null,
      points: json['points'] is int ? json['points']! as int : 0,
      completedToday: json['completedToday'] == true,
    );
  }

  final String id;
  final String title;

  /// Raw emoji string or null.
  final String? icon;
  final int points;
  final bool completedToday;
}

class TodayTodo {
  const TodayTodo({
    required this.id,
    required this.title,
    required this.done,
    required this.dueDate,
  });

  factory TodayTodo.fromJson(Map<String, Object?> json) {
    final Object? dueRaw = json['dueDate'];
    return TodayTodo(
      id: json['id']! as String,
      title: json['title']! as String,
      done: json['done'] == true,
      dueDate: dueRaw is String ? DateTime.tryParse(dueRaw) : null,
    );
  }

  final String id;
  final String title;
  final bool done;
  final DateTime? dueDate;
}

class TodayPayload {
  const TodayPayload({
    required this.member,
    required this.todayIso,
    required this.events,
    required this.chores,
    required this.todos,
    this.staleAt,
  });

  factory TodayPayload.fromJson(
    Map<String, Object?> json, {
    DateTime? staleAt,
  }) {
    final Map<String, Object?> memberJson =
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>();

    final Map<String, Object?> todayJson =
        (json['today']! as Map<Object?, Object?>).cast<String, Object?>();

    final List<Object?> eventsRaw =
        json['events'] is List ? json['events']! as List<Object?> : <Object?>[];
    final List<Object?> choresRaw =
        json['chores'] is List ? json['chores']! as List<Object?> : <Object?>[];
    final List<Object?> todosRaw =
        json['todos'] is List ? json['todos']! as List<Object?> : <Object?>[];

    return TodayPayload(
      member: TodayMember.fromJson(memberJson),
      todayIso: todayJson['iso']! as String,
      events: eventsRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> e) =>
              TodayEvent.fromJson(e.cast<String, Object?>()))
          .toList(),
      chores: choresRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> c) =>
              TodayChore.fromJson(c.cast<String, Object?>()))
          .toList(),
      todos: todosRaw
          .whereType<Map<Object?, Object?>>()
          .map((Map<Object?, Object?> t) =>
              TodayTodo.fromJson(t.cast<String, Object?>()))
          .toList(),
      staleAt: staleAt,
    );
  }

  final TodayMember member;

  /// ISO-8601 date string, e.g. "2026-05-11".
  final String todayIso;
  final List<TodayEvent> events;
  final List<TodayChore> chores;
  final List<TodayTodo> todos;

  /// Non-null when this payload was served from the disk cache rather than a
  /// live network response. Phase B can surface this in the UI.
  final DateTime? staleAt;
}
