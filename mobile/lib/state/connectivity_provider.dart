// ignore_for_file: deprecated_member_use
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Emits `true` when at least one connectivity result is not [ConnectivityResult.none].
///
/// The stream starts live changes via [Connectivity.onConnectivityChanged].
/// `StreamProviderRef` is the correct type in Riverpod 2.x — the deprecation
/// is a forward-notice for 3.0 (tracked with flutter_riverpod upgrade).
final StreamProvider<bool> connectivityProvider = StreamProvider<bool>(
  (StreamProviderRef<bool> ref) {
    final Connectivity connectivity = Connectivity();
    return connectivity.onConnectivityChanged.map(
      (List<ConnectivityResult> results) =>
          results.any((ConnectivityResult r) => r != ConnectivityResult.none),
    );
  },
);
