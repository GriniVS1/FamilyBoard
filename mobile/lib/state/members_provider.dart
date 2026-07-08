import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/family_member.dart';
import '../services/members_service.dart';
import 'session_provider.dart';

/// Fetches the family's members and the acting device's own role.
///
/// Watches the current session so it rebuilds when the session changes.
/// Callers trigger a manual refresh via `ref.invalidate(membersProvider)`.
final FutureProvider<MembersResult> membersProvider =
    FutureProvider<MembersResult>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const MembersSessionRevokedException();
  }
  return ref.watch(membersServiceProvider).fetchMembers(session);
});
