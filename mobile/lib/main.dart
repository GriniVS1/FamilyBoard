import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app.dart';
import 'services/fcm_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Firebase.initializeApp() without explicit FirebaseOptions picks up
  // google-services.json (Android) and GoogleService-Info.plist (iOS)
  // automatically. Run `flutterfire configure` if you need platform-specific
  // overrides — that generates firebase_options.dart.
  await Firebase.initializeApp();

  // Must be registered before runApp so the background isolate can find it.
  FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

  runApp(
    ProviderScope(
      // Riverpod 3 auto-retries failed providers by default (exponential
      // backoff, up to 10 attempts) — see `ProviderContainer.defaultRetry`.
      // That would silently change our error-card semantics: every
      // FutureProvider here throws a typed `*FetchException`/`DioException`
      // when the wall is unreachable, and those aren't `Error`s or
      // `ProviderException`s, so the default retry would kick in and make
      // error cards flicker/loop while offline instead of surfacing
      // immediately and waiting for an explicit `ref.invalidate` (pull to
      // refresh, tab switch, foreground poll). Disable it globally to keep
      // the pre-3.0 "fail once, stay failed until invalidated" behavior.
      retry: (int retryCount, Object error) => null,
      child: const FamilyBoardApp(),
    ),
  );
}
