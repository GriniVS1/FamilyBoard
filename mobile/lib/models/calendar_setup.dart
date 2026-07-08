/// POD models for the `/api/mobile/calendar/*` settings endpoints.
library;

/// The three calendar providers the wall can be linked to.
enum CalendarProviderType { google, caldav, microsoft }

CalendarProviderType? _parseProvider(Object? raw) {
  switch (raw) {
    case 'google':
      return CalendarProviderType.google;
    case 'caldav':
      return CalendarProviderType.caldav;
    case 'microsoft':
      return CalendarProviderType.microsoft;
    default:
      return null;
  }
}

/// Result of `GET /api/mobile/calendar/status`.
class CalendarStatus {
  const CalendarStatus({
    required this.provider,
    required this.connected,
    required this.accountLabel,
  });

  factory CalendarStatus.fromJson(Map<String, Object?> json) {
    final Object? accountLabelRaw = json['accountLabel'];
    return CalendarStatus(
      provider: _parseProvider(json['provider']),
      connected: json['connected'] == true,
      accountLabel: accountLabelRaw is String ? accountLabelRaw : null,
    );
  }

  final CalendarProviderType? provider;
  final bool connected;
  final String? accountLabel;
}

/// A CalDAV calendar option returned by `connect-caldav`, offered to the user
/// to pick which one to sync.
class CaldavCalendarOption {
  const CaldavCalendarOption({required this.url, required this.name});

  factory CaldavCalendarOption.fromJson(Map<String, Object?> json) {
    return CaldavCalendarOption(
      url: json['url']! as String,
      name: json['displayName']! as String,
    );
  }

  final String url;
  final String name;
}

/// CalDAV server presets offered in the connect form. `custom` is the only
/// one that requires the user to type a server URL.
enum CaldavPreset { icloud, fastmail, nextcloud, yahoo, custom }
