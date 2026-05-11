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

  runApp(const ProviderScope(child: FamilyBoardApp()));
}
