/// POD model for `GET /api/setup/status` — the wall's app-first onboarding
/// progress snapshot. Deliberately unauthenticated (pre-pairing), see
/// `src/app/api/setup/status/route.ts` and `getSetupStatus` in
/// `src/lib/queries.ts` on the wall.
library;

class SetupStatus {
  const SetupStatus({
    required this.installationId,
    required this.localeChosen,
    required this.familyCreated,
    required this.memberCount,
    required this.pinSet,
    required this.weatherSet,
    required this.setupComplete,
  });

  factory SetupStatus.fromJson(Map<String, Object?> json) {
    final Object? countRaw = json['memberCount'];
    return SetupStatus(
      installationId: json['installationId'] is String
          ? json['installationId']! as String
          : '',
      localeChosen: json['localeChosen'] == true,
      familyCreated: json['familyCreated'] == true,
      memberCount: countRaw is num ? countRaw.toInt() : 0,
      pinSet: json['pinSet'] == true,
      weatherSet: json['weatherSet'] == true,
      setupComplete: json['setupComplete'] == true,
    );
  }

  final String installationId;
  final bool localeChosen;
  final bool familyCreated;
  final int memberCount;
  final bool pinSet;
  final bool weatherSet;
  final bool setupComplete;
}
