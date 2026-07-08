import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/session.dart';

class SecureSessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                // first_unlock_this_device (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly)
                // is non-migratable and excluded from iTunes/Finder backups,
                // preventing token cloning onto a different device. Background
                // push/heartbeat still work after first unlock.
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  static const String _sessionKey = 'familyboard.session.v1';

  final FlutterSecureStorage _storage;

  Future<Session?> read() async {
    final String? raw = await _storage.read(key: _sessionKey);
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      return Session.decode(raw);
    } on FormatException {
      await _storage.delete(key: _sessionKey);
      return null;
    }
  }

  Future<void> write(Session session) async {
    await _storage.write(key: _sessionKey, value: session.encode());
  }

  Future<void> clear() async {
    await _storage.delete(key: _sessionKey);
  }
}

/// Persists the user's optional locale override (a plain language code, e.g.
/// "de"). Not a credential — reuses [FlutterSecureStorage] purely because
/// it's already a dependency, avoiding a second local-storage plugin for one
/// small preference. Null means "follow the OS locale".
class LocalePrefStore {
  LocalePrefStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const String _localeKey = 'familyboard.locale.v1';

  final FlutterSecureStorage _storage;

  Future<String?> read() async {
    final String? raw = await _storage.read(key: _localeKey);
    return raw != null && raw.isNotEmpty ? raw : null;
  }

  Future<void> write(String? languageCode) async {
    if (languageCode == null) {
      await _storage.delete(key: _localeKey);
    } else {
      await _storage.write(key: _localeKey, value: languageCode);
    }
  }
}
