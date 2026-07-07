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
    this.altUrl,
    this.installationId,
  });

  factory Session.fromJson(Map<String, Object?> json) {
    final Map<String, Object?> memberJson =
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>();
    final Map<String, Object?> familyJson =
        (json['family']! as Map<Object?, Object?>).cast<String, Object?>();
    final Object? altUrlRaw = json['altUrl'];
    final Object? installationIdRaw = json['installationId'];
    return Session(
      serverUrl: json['serverUrl']! as String,
      token: json['token']! as String,
      deviceId: json['deviceId']! as String,
      member: Member.fromJson(memberJson),
      family: Family.fromJson(familyJson),
      altUrl: altUrlRaw is String && altUrlRaw.isNotEmpty ? altUrlRaw : null,
      installationId:
          installationIdRaw is String && installationIdRaw.isNotEmpty
              ? installationIdRaw
              : null,
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

  /// Fallback server URL (typically an mDNS hostname) scanned from the same
  /// QR code as [serverUrl]. Used by connection recovery when [serverUrl]
  /// (a LAN IP) goes stale after a DHCP lease change. Null for older
  /// pairings or manual entry.
  final String? altUrl;

  /// Stable identity of the paired wall (`Installation.id` on the server),
  /// fetched from `GET /api/mobile/identity`. Used to verify that a
  /// rediscovered host is actually the same wall before trusting it. Null
  /// until the first successful identity fetch.
  final String? installationId;

  Map<String, Object?> toJson() => <String, Object?>{
        'serverUrl': serverUrl,
        'token': token,
        'deviceId': deviceId,
        'member': member.toJson(),
        'family': family.toJson(),
        if (altUrl != null) 'altUrl': altUrl,
        if (installationId != null) 'installationId': installationId,
      };

  String encode() => jsonEncode(toJson());

  Session copyWith(
      {String? serverUrl, String? altUrl, String? installationId}) {
    return Session(
      serverUrl: serverUrl ?? this.serverUrl,
      token: token,
      deviceId: deviceId,
      member: member,
      family: family,
      altUrl: altUrl ?? this.altUrl,
      installationId: installationId ?? this.installationId,
    );
  }
}
