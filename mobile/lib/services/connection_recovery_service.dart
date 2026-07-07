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
  });

  final String serverUrl;
  final String installationId;
}

/// Finds the wall again after its LAN IP changes (DHCP lease renewal).
///
/// Tries, in order:
///  1. [Session.altUrl] — an mDNS hostname carried in the same QR code as
///     the primary URL, so it should still resolve even if the IP moved.
///  2. Active mDNS discovery of `_familyboard._tcp` on the LAN.
///
/// Every candidate is verified via `GET /api/mobile/identity` before being
/// trusted — a bare "something answered on this URL" is not enough, it must
/// report the same `installationId` as the paired wall. For sessions paired
/// before this feature shipped (no stored `installationId`), a candidate is
/// accepted only if discovery finds *exactly one* FamilyBoard on the LAN —
/// good enough odds for a single-family, one-wall household, and refuses to
/// guess when it isn't sure.
///
/// Throttled to at most one attempt per [minInterval] so a burst of failing
/// requests (e.g. several screens refreshing at once after the wall's IP
/// changes) doesn't trigger a discovery storm.
class ConnectionRecoveryService {
  ConnectionRecoveryService({
    IdentityService? identityService,
    MdnsDiscoveryService? discoveryService,
    Duration? minInterval,
  })  : _identity = identityService ?? IdentityService(),
        _discovery = discoveryService ?? MdnsDiscoveryService(),
        _minInterval = minInterval ?? const Duration(seconds: 30);

  final IdentityService _identity;
  final MdnsDiscoveryService _discovery;
  final Duration _minInterval;

  DateTime? _lastAttempt;

  Future<RecoveredConnection?> recover(Session session) async {
    final DateTime now = DateTime.now();
    final DateTime? last = _lastAttempt;
    if (last != null && now.difference(last) < _minInterval) {
      return null;
    }
    _lastAttempt = now;

    final RecoveredConnection? viaAlt = await _tryAlt(session);
    if (viaAlt != null) {
      return viaAlt;
    }
    return _tryMdns(session);
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
