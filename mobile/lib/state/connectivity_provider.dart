import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Emits `true` when at least one connectivity result is not [ConnectivityResult.none].
///
/// The stream starts live changes via [Connectivity.onConnectivityChanged].
/// Riverpod 3 unified all typed refs (`StreamProviderRef<T>` and friends)
/// into a single [Ref] type — see the flutter_riverpod 3.0 migration notes.
final StreamProvider<bool> connectivityProvider = StreamProvider<bool>((
  Ref ref,
) {
  final Connectivity connectivity = Connectivity();
  return connectivity.onConnectivityChanged.map(
    (List<ConnectivityResult> results) =>
        results.any((ConnectivityResult r) => r != ConnectivityResult.none),
  );
});

/// Emits `true` when Wi-Fi is one of the active connectivity transports.
///
/// Used by [SessionNotifier] to trigger a silent probe back to the wall's
/// LAN address when the device reconnects to Wi-Fi after having been pinned
/// to the cloud relay.
final StreamProvider<bool> wifiConnectivityProvider = StreamProvider<bool>((
  Ref ref,
) {
  final Connectivity connectivity = Connectivity();
  return connectivity.onConnectivityChanged.map(
    (List<ConnectivityResult> results) =>
        results.contains(ConnectivityResult.wifi),
  );
});
