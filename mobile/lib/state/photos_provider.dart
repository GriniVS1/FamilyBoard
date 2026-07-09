import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/photo.dart';
import '../models/session.dart';
import '../services/photos_service.dart';
import 'session_provider.dart';

/// Fetches the wall's screensaver photos.
///
/// Watches the current session so it rebuilds when the session changes.
/// Callers trigger a manual refresh via `ref.invalidate(photosProvider)`.
final FutureProvider<List<Photo>> photosProvider =
    FutureProvider<List<Photo>>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final Session? session = sessionState.session;
  if (session == null) {
    throw const PhotosSessionRevokedException();
  }
  return ref.watch(photosServiceProvider).fetchPhotos(session);
});
