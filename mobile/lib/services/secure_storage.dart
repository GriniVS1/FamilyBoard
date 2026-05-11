import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../models/session.dart';

class SecureSessionStore {
  SecureSessionStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock,
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
