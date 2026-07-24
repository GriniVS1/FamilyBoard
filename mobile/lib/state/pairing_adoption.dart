import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/session.dart';
import '../services/fcm_service.dart';
import '../services/identity_service.dart';
import 'session_provider.dart';

/// Adopts a freshly-paired [session] (persists it, flips [sessionProvider] to
/// signed-in) and kicks off the same non-blocking post-pair work every
/// pairing path shares: FCM enrollment and an identity fetch to backfill
/// `installationId`/`remoteUrl`. Neither is awaited — a slow permission
/// dialog or unreachable identity call must never stall the transition to
/// Home.
///
/// Shared by [PairController.submit] (normal QR/manual pairing) and
/// `SetupOnboardingController.submitPin` (app-first onboarding, which pairs
/// the finishing device to the admin member silently as part of setting the
/// PIN) so both paths give the first device push notifications the same way.
Future<void> adoptPairedSession(Ref ref, Session session) async {
  await ref.read(sessionProvider.notifier).adopt(session);
  unawaited(_enrollFcm(ref, session));
  unawaited(_fetchIdentity(ref, session));
}

Future<void> _enrollFcm(Ref ref, Session session) async {
  final FcmService fcm = ref.read(fcmServiceProvider);
  final bool granted = await fcm.requestPermission();
  if (!granted) {
    return;
  }
  final String? token = await fcm.getToken();
  if (token != null) {
    await fcm.registerWithWall(session, token);
  }
}

Future<void> _fetchIdentity(Ref ref, Session session) async {
  final IdentityService identity = ref.read(identityServiceProvider);
  final IdentityResult? result = await identity.fetch(session.serverUrl);
  if (result != null) {
    await ref.read(sessionProvider.notifier).applyIdentity(result);
  }
}
