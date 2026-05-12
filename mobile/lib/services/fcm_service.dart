import 'dart:io' show Platform;

import 'package:dio/dio.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../models/notification_payload.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Background message handler — must be a top-level function.
///
/// Firebase calls this in a separate isolate when the app is terminated or
/// in the background. We have no UI here, so we only ensure the isolate
/// processes the message without crashing.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Background isolate: no UI available. Firebase has already displayed
  // the system notification if the message contained a notification payload.
  // Nothing more to do for M2.3.
}

/// Encapsulates all Firebase Cloud Messaging interactions for the app.
///
/// Call [requestPermission] → [getToken] → [registerWithWall] immediately
/// after a successful pairing. Re-run on foreground resume if permission was
/// previously denied (handled by [HomeScreen] via WidgetsBindingObserver).
class FcmService {
  FcmService({ApiClientFactory? clientFactory})
      : _clientFactory = clientFactory ?? const ApiClientFactory();

  final FirebaseMessaging _messaging = FirebaseMessaging.instance;
  final ApiClientFactory _clientFactory;

  /// Asks the OS for notification permission.
  ///
  /// On iOS this shows the system dialog. On Android 13+ the system dialog
  /// also appears. Returns true only when the user grants authorization.
  Future<bool> requestPermission() async {
    final NotificationSettings settings = await _messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Returns the current permission status without prompting.
  Future<bool> hasPermission() async {
    final NotificationSettings settings =
        await _messaging.getNotificationSettings();
    return settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
  }

  /// Returns the FCM registration token for this device, or null on failure.
  Future<String?> getToken() async {
    try {
      if (Platform.isIOS) {
        // Request APNs token first; FCM token won't be available without it.
        await _messaging.getAPNSToken();
      }
      return await _messaging.getToken();
    } on Exception {
      return null;
    }
  }

  /// POSTs the FCM token to `POST /api/devices/me/fcm-token` on the wall.
  ///
  /// Failures are swallowed — token registration is best-effort. If it fails
  /// the user still uses the app; they just won't receive push until the next
  /// successful registration (which happens on the next foreground resume when
  /// [HomeScreen] re-checks permission).
  Future<void> registerWithWall(Session session, String fcmToken) async {
    final Dio dio = _clientFactory.authenticated(session);
    try {
      await dio.post<Object?>(
        '/api/devices/me/fcm-token',
        data: <String, Object?>{
          if (Platform.isIOS) 'apnsToken': fcmToken,
          if (!Platform.isIOS) 'fcmToken': fcmToken,
        },
      );
    } on DioException {
      // Best-effort — no rethrow.
    }
  }

  /// Wires a listener for messages received while the app is in the
  /// foreground. FCM does not display a system notification in this case;
  /// the caller is responsible for showing in-app feedback.
  void subscribeToForegroundMessages(
    void Function(NotificationPayload payload) onReceive,
  ) {
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      final Map<String, String> data = message.data.cast<String, String>();
      onReceive(NotificationPayload.fromData(data));
    });
  }

  /// Returns the [NotificationPayload] that launched the app from a cold
  /// start (app was terminated), or null if the app was opened normally.
  Future<NotificationPayload?> getInitialMessage() async {
    final RemoteMessage? message = await _messaging.getInitialMessage();
    if (message == null) {
      return null;
    }
    return NotificationPayload.fromData(
      message.data.cast<String, String>(),
    );
  }

  /// Wires a listener for notification taps when the app is in the background
  /// (not terminated). The system already showed the notification; tapping it
  /// brings the app to the foreground and calls this callback.
  void subscribeToOpenedMessages(
    void Function(NotificationPayload payload) onOpen,
  ) {
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      onOpen(
        NotificationPayload.fromData(
          message.data.cast<String, String>(),
        ),
      );
    });
  }
}
