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
