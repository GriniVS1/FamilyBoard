import 'package:connectivity_plus/connectivity_plus.dart';

import '../models/session.dart';
import 'identity_service.dart';
import 'mdns_discovery_service.dart';

/// Outcome of a successful connection recovery: the wall's new reachable
/// base URL plus its verified identity, ready for [SessionNotifier] to
/// persist.
class RecoveredConnection {
  const RecoveredConnection({
    required this.serverUrl,
    required this.installationId,
    this.isRemote = false,
  });

  final String serverUrl;
  final String installationId;

  /// True when [serverUrl] is the cloud-relay URL rather than a LAN address.
  /// [SessionNotifier.applyRecoveredConnection] uses this to update
  /// [Session.activeUrl] instead of overwriting [Session.serverUrl] — the
  /// LAN address must survive so the app can flip back to it later.
  final bool isRemote;
}

/// Finds the wall again when it's unreachable at [Session.serverUrl].
///
/// Tries, in order:
///  1. [Session.altUrl] — an mDNS hostname carried in the same QR code as
///     the primary URL, so it should still resolve even if the IP moved.
///  2. Active mDNS discovery of `_familyboard._tcp` on the LAN.
///  3. [Session.remoteUrl] — the cloud relay, for when the device isn't on
///     the wall's LAN at all (mobile data, a different Wi-Fi network, ...).
///
/// Steps 1–2 are skipped outright when the device isn't on Wi-Fi at all
/// (`connectivity_plus` reports no Wi-Fi transport) — they can't succeed off
/// LAN, and probing them first would cost ~10s before falling through to the
/// relay. [probeLan] performs the reverse check (LAN candidates only) for
/// the "did we come back onto the wall's Wi-Fi" flip in [SessionNotifier].
///
/// Every candidate is verified via `GET /api/mobile/identity` before being
/// trusted — a bare "something answered on this URL" is not enough, it must
/// report the same `installationId` as the paired wall. For sessions paired
/// before this feature shipped (no stored `installationId`), a candidate is
/// accepted only if discovery finds *exactly one* FamilyBoard on the LAN —
/// good enough odds for a single-family, one-wall household, and refuses to
/// guess when it isn't sure.
///
/// Throttled to at most one attempt per [minInterval] — shared across
/// [recover] and [probeLan] — so a burst of failing requests (e.g. several
/// screens refreshing at once after the wall's IP changes, or a flurry of
/// app-resume events) doesn't trigger a discovery storm.
class ConnectionRecoveryService {
  ConnectionRecoveryService({
    IdentityService? identityService,
    MdnsDiscoveryService? discoveryService,
    Connectivity? connectivity,
    Duration? minInterval,
  })  : _identity = identityService ?? IdentityService(),
        _discovery = discoveryService ?? MdnsDiscoveryService(),
        _connectivity = connectivity ?? Connectivity(),
        _minInterval = minInterval ?? const Duration(seconds: 30);

  final IdentityService _identity;
  final MdnsDiscoveryService _discovery;
  final Connectivity _connectivity;
  final Duration _minInterval;

  DateTime? _lastAttempt;

  Future<RecoveredConnection?> recover(Session session) async {
    if (_shouldThrottle()) {
      return null;
    }

    if (await _isOnWifi()) {
      final RecoveredConnection? viaAlt = await _tryAlt(session);
      if (viaAlt != null) {
        return viaAlt;
      }
      final RecoveredConnection? viaMdns = await _tryMdns(session);
      if (viaMdns != null) {
        return viaMdns;
      }
    }
    return _tryRemote(session);
  }

  /// LAN-only probe used when the app comes back into range of the wall's
  /// Wi-Fi (app resume, or a connectivity change to Wi-Fi) while [Session]
  /// is currently pinned to [Session.remoteUrl]. Tries [Session.serverUrl]
  /// then [Session.altUrl] — never the relay, since the whole point is to
  /// find out whether the direct LAN path is usable again.
  Future<RecoveredConnection?> probeLan(Session session) async {
    if (_shouldThrottle()) {
      return null;
    }

    final IdentityResult? direct = await _identity.fetch(session.serverUrl);
    if (direct != null &&
        _matches(session.installationId, direct.installationId)) {
      return RecoveredConnection(
        serverUrl: session.serverUrl,
        installationId: direct.installationId,
      );
    }

    final String? altUrl = session.altUrl;
    if (altUrl == null || altUrl.isEmpty) {
      return null;
    }
    final IdentityResult? viaAlt = await _identity.fetch(altUrl);
    if (viaAlt == null ||
        !_matches(session.installationId, viaAlt.installationId)) {
      return null;
    }
    return RecoveredConnection(
      serverUrl: altUrl,
      installationId: viaAlt.installationId,
    );
  }

  bool _shouldThrottle() {
    final DateTime now = DateTime.now();
    final DateTime? last = _lastAttempt;
    if (last != null && now.difference(last) < _minInterval) {
      return true;
    }
    _lastAttempt = now;
    return false;
  }

  /// True when Wi-Fi is one of the active transports. Fails open (returns
  /// true, i.e. "try LAN discovery") on any platform error — a broken
  /// connectivity read must not silently disable LAN recovery.
  Future<bool> _isOnWifi() async {
    try {
      final List<ConnectivityResult> results =
          await _connectivity.checkConnectivity();
      return results.contains(ConnectivityResult.wifi);
    } on Object {
      return true;
    }
  }

  Future<RecoveredConnection?> _tryRemote(Session session) async {
    final String? remoteUrl = session.remoteUrl;
    if (remoteUrl == null || remoteUrl.isEmpty) {
      return null;
    }
    final IdentityResult? result = await _identity.fetch(remoteUrl);
    if (result == null) {
      return null;
    }
    // installationId is the only field the relay doesn't redact — it's also
    // the only one that matters here.
    if (!_matches(session.installationId, result.installationId)) {
      return null;
    }
    return RecoveredConnection(
      serverUrl: remoteUrl,
      installationId: result.installationId,
      isRemote: true,
    );
  }

  Future<RecoveredConnection?> _tryAlt(Session session) async {
    final String? altUrl = session.altUrl;
    if (altUrl == null || altUrl.isEmpty) {
      return null;
    }
    final IdentityResult? result = await _identity.fetch(altUrl);
    if (result == null) {
      return null;
    }
    if (!_matches(session.installationId, result.installationId)) {
      return null;
    }
    return RecoveredConnection(
      serverUrl: altUrl,
      installationId: result.installationId,
    );
  }

  Future<RecoveredConnection?> _tryMdns(Session session) async {
    final List<DiscoveredHost> hosts = await _discovery.discover();
    if (hosts.isEmpty) {
      return null;
    }

    final String? knownId = session.installationId;
    if (knownId != null) {
      for (final DiscoveredHost host in hosts) {
        final IdentityResult? result = await _identity.fetch(host.baseUrl);
        if (result != null && result.installationId == knownId) {
          return RecoveredConnection(
            serverUrl: host.baseUrl,
            installationId: result.installationId,
          );
        }
      }
      return null;
    }

    // Pre-upgrade pairing: no installationId to verify against. Only safe to
    // auto-adopt when discovery is unambiguous.
    if (hosts.length != 1) {
      return null;
    }
    final DiscoveredHost only = hosts.single;
    final IdentityResult? result = await _identity.fetch(only.baseUrl);
    if (result == null) {
      return null;
    }
    return RecoveredConnection(
      serverUrl: only.baseUrl,
      installationId: result.installationId,
    );
  }

  bool _matches(String? known, String fetched) =>
      known == null || known == fetched;
}
