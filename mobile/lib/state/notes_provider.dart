import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/notes_service.dart';
import 'session_provider.dart';

final FutureProvider<NotesResult> notesProvider =
    FutureProvider<NotesResult>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const NoteFetchException('No active session');
  }
  return ref.watch(notesServiceProvider).fetchNotes(session);
});
