import 'dart:convert';

class Member {
  const Member({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  factory Member.fromJson(Map<String, Object?> json) {
    final String id = json['id']! as String;
    final String name = json['name']! as String;
    final String color = json['color']! as String;
    final Object? emojiRaw = json['emoji'];
    final String emoji = emojiRaw is String ? emojiRaw : '';
    return Member(id: id, name: name, color: color, emoji: emoji);
  }

  final String id;
  final String name;
  final String color;
  final String emoji;

  Map<String, Object?> toJson() => <String, Object?>{
        'id': id,
        'name': name,
        'color': color,
        'emoji': emoji,
      };
}

class Family {
  const Family({required this.id, required this.name});

  factory Family.fromJson(Map<String, Object?> json) {
    return Family(
      id: json['id']! as String,
      name: json['name']! as String,
    );
  }

  final String id;
  final String name;

  Map<String, Object?> toJson() => <String, Object?>{
        'id': id,
        'name': name,
      };
}

class Session {
  const Session({
    required this.serverUrl,
    required this.token,
    required this.deviceId,
    required this.member,
    required this.family,
  });

  factory Session.fromJson(Map<String, Object?> json) {
    final Map<String, Object?> memberJson =
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>();
    final Map<String, Object?> familyJson =
        (json['family']! as Map<Object?, Object?>).cast<String, Object?>();
    return Session(
      serverUrl: json['serverUrl']! as String,
      token: json['token']! as String,
      deviceId: json['deviceId']! as String,
      member: Member.fromJson(memberJson),
      family: Family.fromJson(familyJson),
    );
  }

  static Session decode(String raw) {
    final Object? parsed = jsonDecode(raw);
    if (parsed is! Map) {
      throw const FormatException('Stored session is not a JSON object');
    }
    return Session.fromJson(parsed.cast<String, Object?>());
  }

  final String serverUrl;
  final String token;
  final String deviceId;
  final Member member;
  final Family family;

  Map<String, Object?> toJson() => <String, Object?>{
        'serverUrl': serverUrl,
        'token': token,
        'deviceId': deviceId,
        'member': member.toJson(),
        'family': family.toJson(),
      };

  String encode() => jsonEncode(toJson());
}
