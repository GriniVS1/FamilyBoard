import 'dart:io' show Platform;

import 'package:dio/dio.dart';

import '../models/session.dart';
import 'api_client.dart';

enum PairErrorKind { invalidCode, tooManyAttempts, network, badServer, unknown }

class PairException implements Exception {
  const PairException(this.kind);

  final PairErrorKind kind;

  @override
  String toString() => 'PairException($kind)';
}

class PairRequest {
  const PairRequest({
    required this.serverUrl,
    required this.code,
    required this.deviceName,
    this.altUrl,
  });

  final String serverUrl;
  final String code;
  final String deviceName;

  /// Fallback URL scanned from the QR code's `alt` parameter. Carried into
  /// the resulting [Session] but never sent to the server.
  final String? altUrl;
}

class PairService {
  PairService({ApiClientFactory? clientFactory})
      : _clientFactory = clientFactory ?? const ApiClientFactory();

  final ApiClientFactory _clientFactory;

  Future<Session> pair(PairRequest request) async {
    if (!_looksLikeUrl(request.serverUrl)) {
      throw const PairException(PairErrorKind.badServer);
    }

    final Dio dio = _clientFactory.unauthenticated(request.serverUrl);
    final Response<Object?> response;
    try {
      response = await dio.post<Object?>(
        '/api/devices/pair',
        data: <String, Object?>{
          'code': request.code.toUpperCase(),
          'name': request.deviceName,
          'platform': _detectPlatform(),
        },
      );
    } on DioException {
      throw const PairException(PairErrorKind.network);
    }

    final int status = response.statusCode ?? 0;
    if (status == 200) {
      final Object? data = response.data;
      if (data is! Map) {
        throw const PairException(PairErrorKind.unknown);
      }
      final Map<String, Object?> payload =
          (data as Map<Object?, Object?>).cast<String, Object?>();
      return Session(
        serverUrl: dio.options.baseUrl,
        altUrl: request.altUrl,
        token: payload['token']! as String,
        deviceId: payload['deviceId']! as String,
        member: Member.fromJson(
          (payload['member']! as Map<Object?, Object?>).cast<String, Object?>(),
        ),
        family: Family.fromJson(
          (payload['family']! as Map<Object?, Object?>).cast<String, Object?>(),
        ),
      );
    }

    final String? code = _extractErrorCode(response.data);
    if (status == 429 || code == 'TOO_MANY_ATTEMPTS') {
      throw const PairException(PairErrorKind.tooManyAttempts);
    }
    if (status == 400 || code == 'INVALID_PAIR_CODE') {
      throw const PairException(PairErrorKind.invalidCode);
    }
    throw const PairException(PairErrorKind.unknown);
  }

  bool _looksLikeUrl(String raw) {
    final Uri? parsed = Uri.tryParse(raw.trim());
    if (parsed == null) {
      return false;
    }
    if (parsed.scheme != 'http' && parsed.scheme != 'https') {
      return false;
    }
    return parsed.host.isNotEmpty;
  }

  String _detectPlatform() {
    if (Platform.isIOS) {
      return 'ios';
    }
    if (Platform.isAndroid) {
      return 'android';
    }
    return 'unknown';
  }

  String? _extractErrorCode(Object? body) {
    if (body is! Map) {
      return null;
    }
    final Object? error = body['error'];
    if (error is! Map) {
      return null;
    }
    final Object? code = error['code'];
    return code is String ? code : null;
  }
}
