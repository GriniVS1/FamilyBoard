import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/secure_storage.dart';

final Provider<LocalePrefStore> localePrefStoreProvider =
    Provider<LocalePrefStore>((Ref ref) => LocalePrefStore());

class LocalePrefState {
  const LocalePrefState({required this.loaded, required this.locale});

  const LocalePrefState.loading()
      : loaded = false,
        locale = null;

  final bool loaded;

  /// Null means "follow the OS locale".
  final Locale? locale;
}

/// Loads and persists the user's locale override. Starts as
/// [LocalePrefState.loading] (resolved to `locale: null`, i.e. system) so
/// `MaterialApp.router` never blocks on this — the brief flash before the
/// stored value loads is imperceptible.
class LocalePrefNotifier extends Notifier<LocalePrefState> {
  @override
  LocalePrefState build() {
    Future<void>.microtask(_load);
    return const LocalePrefState.loading();
  }

  Future<void> _load() async {
    final String? code = await ref.read(localePrefStoreProvider).read();
    state = LocalePrefState(
      loaded: true,
      locale: code == null ? null : Locale(code),
    );
  }

  Future<void> setLocale(Locale? locale) async {
    await ref.read(localePrefStoreProvider).write(locale?.languageCode);
    state = LocalePrefState(loaded: true, locale: locale);
  }
}

final NotifierProvider<LocalePrefNotifier, LocalePrefState> localePrefProvider =
    NotifierProvider<LocalePrefNotifier, LocalePrefState>(
        LocalePrefNotifier.new);
