import 'dart:async';
import 'dart:io' show InternetAddress;

import 'package:nsd/nsd.dart';

/// A host discovered via mDNS, ready to be probed via [IdentityService].
class DiscoveredHost {
  const DiscoveredHost({required this.address, required this.port});

  final String address;
  final int port;

  String get baseUrl => 'http://$address:$port';
}

/// Wraps `package:nsd` to find the wall on the LAN by its advertised
/// `_familyboard._tcp` service.
///
/// Chosen over `multicast_dns` (pure-Dart mDNS client): `multicast_dns`
/// requires the app to manually acquire and hold Android's Wi-Fi multicast
/// lock and is widely reported as flaky on stock ROMs that aggressively
/// throttle multicast traffic to save battery. `nsd` instead delegates to
/// the platform's own Network Service Discovery (Android) / Bonjour (iOS)
/// APIs, which already manage locks and battery exemptions the same way
/// system features (AirPrint, Chromecast, printer discovery) do — it rides
/// the platform's own reliability rather than reimplementing mDNS in Dart.
class MdnsDiscoveryService {
  MdnsDiscoveryService({Duration? scanDuration})
      : _scanDuration = scanDuration ?? const Duration(seconds: 4);

  static const String _serviceType = '_familyboard._tcp';

  final Duration _scanDuration;

  /// Scans the LAN for `_familyboard._tcp` and returns every host that
  /// answered with a resolvable address, deduplicated by `address:port`.
  ///
  /// Never throws: mDNS being unsupported, permission being denied, or
  /// simply finding nothing all resolve to an empty list so the caller
  /// falls back to surfacing the original connection error.
  Future<List<DiscoveredHost>> discover() async {
    Discovery? discovery;
    try {
      discovery = await startDiscovery(
        _serviceType,
        ipLookupType: IpLookupType.any,
      );
      await Future<void>.delayed(_scanDuration);
      return _toHosts(discovery.services);
    } on Object {
      // nsd signals platform-level failures (unsupported OS version, missing
      // permission, ...) via `NsdError`, which extends `Error` rather than
      // `Exception` — catching `Object` is the only way to keep a broken or
      // permission-less mDNS stack from taking down connection recovery.
      return const <DiscoveredHost>[];
    } finally {
      final Discovery? started = discovery;
      if (started != null) {
        unawaited(stopDiscovery(started));
      }
    }
  }

  List<DiscoveredHost> _toHosts(List<Service> services) {
    final Map<String, DiscoveredHost> byKey = <String, DiscoveredHost>{};
    for (final Service service in services) {
      final int? port = service.port;
      if (port == null) {
        continue;
      }
      final String? address = _preferredAddress(service);
      if (address == null) {
        continue;
      }
      byKey['$address:$port'] = DiscoveredHost(address: address, port: port);
    }
    return byKey.values.toList(growable: false);
  }

  String? _preferredAddress(Service service) {
    final List<InternetAddress>? addresses = service.addresses;
    if (addresses != null && addresses.isNotEmpty) {
      return addresses.first.address;
    }
    final String? host = service.host;
    if (host != null && host.isNotEmpty) {
      return host;
    }
    return null;
  }
}
