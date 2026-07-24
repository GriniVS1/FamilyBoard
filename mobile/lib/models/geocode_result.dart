/// POD model for `GET /api/geocode` results — the wall's Open-Meteo
/// geocoding proxy (`src/app/api/geocode/route.ts`), reused as-is by the
/// app-first onboarding weather step so location search matches the wall's
/// own `PlaceSearch` component.
library;

class GeocodeResult {
  const GeocodeResult({
    required this.id,
    required this.name,
    required this.country,
    required this.admin1,
    required this.latitude,
    required this.longitude,
  });

  factory GeocodeResult.fromJson(Map<String, Object?> json) {
    final Object? idRaw = json['id'];
    final Object? latRaw = json['latitude'];
    final Object? lonRaw = json['longitude'];
    return GeocodeResult(
      id: idRaw is num ? idRaw.toInt() : 0,
      name: json['name'] is String ? json['name']! as String : '',
      country: json['country'] is String ? json['country'] as String? : null,
      admin1: json['admin1'] is String ? json['admin1'] as String? : null,
      latitude: latRaw is num ? latRaw.toDouble() : 0,
      longitude: lonRaw is num ? lonRaw.toDouble() : 0,
    );
  }

  final int id;
  final String name;
  final String? country;
  final String? admin1;
  final double latitude;
  final double longitude;

  /// Mirrors the wall's `PlaceSearch` formatting (`name, admin1, country`,
  /// skipping blank parts).
  String get displayLabel {
    final List<String> parts = <String>[
      name,
      if (admin1 != null && admin1!.trim().isNotEmpty) admin1!,
      if (country != null && country!.trim().isNotEmpty) country!,
    ];
    return parts.join(', ');
  }

  /// Mirrors `StepWeather.handlePlacePick`'s label (`name, admin1` only —
  /// no country) used as the submitted `label` field.
  String get shortLabel {
    if (admin1 != null && admin1!.trim().isNotEmpty) {
      return '$name, $admin1';
    }
    return name;
  }
}
