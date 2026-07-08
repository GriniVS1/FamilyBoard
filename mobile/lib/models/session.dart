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
    this.remoteUrl,
    this.activeUrl,
  });

  factory Session.fromJson(Map<String, Object?> json) {
    final Map<String, Object?> memberJson =
        (json['member']! as Map<Object?, Object?>).cast<String, Object?>();
    final Map<String, Object?> familyJson =
        (json['family']! as Map<Object?, Object?>).cast<String, Object?>();
    final Object? altUrlRaw = json['altUrl'];
    final Object? installationIdRaw = json['installationId'];
    final Object? remoteUrlRaw = json['remoteUrl'];
    final Object? activeUrlRaw = json['activeUrl'];
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
      remoteUrl: remoteUrlRaw is String && remoteUrlRaw.isNotEmpty
          ? remoteUrlRaw
          : null,
      activeUrl: activeUrlRaw is String && activeUrlRaw.isNotEmpty
          ? activeUrlRaw
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

  /// The wall's cloud-relay base URL (`https://relay.familyboard.ch/f/<id>`),
  /// carried by the QR code's `remote` parameter or backfilled from
  /// `GET /api/mobile/identity` fetched over the LAN. Null for pairings that
  /// predate the relay feature or whose wall has no relay configured.
  final String? remoteUrl;

  /// The base URL actually in use for API calls, when it differs from
  /// [serverUrl] — set by [ConnectionRecoveryService] when the LAN address
  /// (and its `altUrl` fallback) are unreachable and [remoteUrl] answered
  /// instead. Null means "use [serverUrl]"; see [effectiveUrl].
  final String? activeUrl;

  /// The base URL [ApiClientFactory.authenticated] should actually dial.
  String get effectiveUrl => activeUrl ?? serverUrl;

  Map<String, Object?> toJson() => <String, Object?>{
        'serverUrl': serverUrl,
        'token': token,
        'deviceId': deviceId,
        'member': member.toJson(),
        'family': family.toJson(),
        if (altUrl != null) 'altUrl': altUrl,
        if (installationId != null) 'installationId': installationId,
        if (remoteUrl != null) 'remoteUrl': remoteUrl,
        if (activeUrl != null) 'activeUrl': activeUrl,
      };

  String encode() => jsonEncode(toJson());

  /// Sentinel distinguishing "leave [activeUrl] unchanged" (the default, an
  /// omitted argument) from "explicitly set it to null" (flipping back to
  /// [serverUrl]) — the only field that needs a real tri-state update.
  static const Object _unset = Object();

  Session copyWith({
    String? serverUrl,
    String? altUrl,
    String? installationId,
    String? remoteUrl,
    Object? activeUrl = _unset,
  }) {
    return Session(
      serverUrl: serverUrl ?? this.serverUrl,
      token: token,
      deviceId: deviceId,
      member: member,
      family: family,
      altUrl: altUrl ?? this.altUrl,
      installationId: installationId ?? this.installationId,
      remoteUrl: remoteUrl ?? this.remoteUrl,
      activeUrl:
          identical(activeUrl, _unset) ? this.activeUrl : activeUrl as String?,
    );
  }
}
