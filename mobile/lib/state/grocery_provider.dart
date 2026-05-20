import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/grocery_service.dart';
import 'session_provider.dart';

final FutureProvider<GroceryResult> groceryProvider =
    FutureProvider<GroceryResult>((Ref ref) async {
  final SessionState sessionState = ref.watch(sessionProvider);
  final session = sessionState.session;
  if (session == null) {
    throw const GroceryFetchException('No active session');
  }
  return ref.watch(groceryServiceProvider).fetchAll(session);
});
