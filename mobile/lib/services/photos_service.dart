import 'dart:io';

import 'package:dio/dio.dart';

import '../models/photo.dart';
import '../models/session.dart';
import 'api_client.dart';

/// Thrown when the server returns 401 (bearer token revoked).
class PhotosSessionRevokedException implements Exception {
  const PhotosSessionRevokedException();
}

/// Thrown when the photo was already removed by another client (404
/// PHOTO_NOT_FOUND).
class PhotosNotFoundException implements Exception {
  const PhotosNotFoundException();
}

/// Thrown when the wall rejects an upload because the file exceeds its 8 MiB
/// cap (server error codes containing "LARGE" or "SIZE").
class PhotosTooLargeException implements Exception {
  const PhotosTooLargeException();
}

/// Thrown when the wall rejects an upload's format (server error codes
/// containing "TYPE" or "MIME"), or when the picked file's extension isn't
/// one of [allowedPhotoExtensions] before it is even sent.
class PhotosUnsupportedTypeException implements Exception {
  const PhotosUnsupportedTypeException();
}

/// Thrown for any other failure (network, 5xx, parse errors, unmapped codes).
class PhotosFetchException implements Exception {
  const PhotosFetchException(this.message);

  final String message;
}

/// Formats the wall's `/api/mobile/photos` upload endpoint accepts.
const Set<String> allowedPhotoExtensions = <String>{
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
};

/// Per-file cap enforced by the wall.
const int maxPhotoUploadBytes = 8 * 1024 * 1024;

/// Lower-cased file extension of [path] (without the leading dot), or null if
/// [path] has none. Pure logic — kept free of any picker/IO dependency so it
/// is directly unit-testable.
String? photoExtensionOf(String path) {
  final int dot = path.lastIndexOf('.');
  if (dot == -1 || dot == path.length - 1) {
    return null;
  }
  return path.substring(dot + 1).toLowerCase();
}

/// True if [path]'s extension is one the wall accepts.
bool isAcceptablePhotoExtension(String path) {
  final String? ext = photoExtensionOf(path);
  return ext != null && allowedPhotoExtensions.contains(ext);
}

/// Best-effort MIME type for [path], derived purely from its extension.
/// Falls back to `application/octet-stream` for anything unrecognised — the
/// caller is expected to have already rejected those via
/// [isAcceptablePhotoExtension].
String photoMimeTypeOf(String path) {
  switch (photoExtensionOf(path)) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'application/octet-stream';
  }
}

/// CRUD service for the `/api/mobile/photos` endpoints. Online-only, like
/// `MembersService` — screensaver uploads have no sensible offline replay
/// story.
class PhotosService {
  PhotosService({required ApiClientFactory clientFactory})
      : _clientFactory = clientFactory;

  final ApiClientFactory _clientFactory;

  Future<List<Photo>> fetchPhotos(Session session) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio.get<Object?>('/api/mobile/photos');
    } on DioException catch (e) {
      throw PhotosFetchException('Network error: ${e.message}');
    }
    _guard(response, expected: const <int>{200});
    final Object? raw = _extractMap(response)['photos'];
    if (raw is! List) {
      throw const PhotosFetchException('Unexpected response format');
    }
    return raw
        .whereType<Map<Object?, Object?>>()
        .map((Map<Object?, Object?> m) =>
            Photo.fromJson(m.cast<String, Object?>()))
        .toList();
  }

  /// Uploads the file at [filePath]. Throws [PhotosUnsupportedTypeException]
  /// up front (no request sent) if the extension isn't accepted, and
  /// [PhotosTooLargeException] up front if the file already exceeds
  /// [maxPhotoUploadBytes] on disk.
  Future<Photo> uploadPhoto({
    required Session session,
    required String filePath,
    String? caption,
    void Function(int sent, int total)? onSendProgress,
  }) async {
    if (!isAcceptablePhotoExtension(filePath)) {
      throw const PhotosUnsupportedTypeException();
    }
    final int size = await File(filePath).length();
    if (size > maxPhotoUploadBytes) {
      throw const PhotosTooLargeException();
    }

    final Dio dio = _clientFactory.authenticated(session);
    final String filename = filePath.split(Platform.pathSeparator).last;
    final FormData formData = FormData.fromMap(<String, Object?>{
      'file': await MultipartFile.fromFile(
        filePath,
        filename: filename,
        contentType: DioMediaType.parse(photoMimeTypeOf(filePath)),
      ),
      if (caption != null && caption.isNotEmpty) 'caption': caption,
    });

    final Response<Object?> response;
    try {
      response = await dio.post<Object?>(
        '/api/mobile/photos',
        data: formData,
        onSendProgress: onSendProgress,
      );
    } on DioException catch (e) {
      throw PhotosFetchException('Network error: ${e.message}');
    }
    _guard(response, expected: const <int>{201});
    final Object? raw = _extractMap(response)['photo'];
    if (raw is! Map) {
      throw const PhotosFetchException('Unexpected response format');
    }
    return Photo.fromJson(
        (raw as Map<Object?, Object?>).cast<String, Object?>());
  }

  Future<void> deletePhoto({
    required Session session,
    required String id,
  }) async {
    final Dio dio = _clientFactory.authenticated(session);
    final Response<Object?> response;
    try {
      response = await dio
          .delete<Object?>('/api/mobile/photos/${Uri.encodeComponent(id)}');
    } on DioException catch (e) {
      throw PhotosFetchException('Network error: ${e.message}');
    }
    _guard(response, expected: const <int>{200});
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  void _guard(Response<Object?> response, {required Set<int> expected}) {
    final int status = response.statusCode ?? 0;
    if (status == 401) {
      throw const PhotosSessionRevokedException();
    }
    if (expected.contains(status)) {
      return;
    }
    if (status == 404) {
      throw const PhotosNotFoundException();
    }
    final String code = _errorCodeFromResponse(response);
    final String upper = code.toUpperCase();
    if (upper.contains('LARGE') || upper.contains('SIZE')) {
      throw const PhotosTooLargeException();
    }
    if (upper.contains('TYPE') || upper.contains('MIME')) {
      throw const PhotosUnsupportedTypeException();
    }
    throw PhotosFetchException('$status $code');
  }

  String _errorCodeFromResponse(Response<Object?> response) {
    final Object? data = response.data;
    if (data is Map) {
      final Object? error = (data as Map<Object?, Object?>)['error'];
      if (error is Map) {
        final Object? code = (error as Map<Object?, Object?>)['code'];
        if (code is String) {
          return code;
        }
      }
    }
    return 'UNKNOWN';
  }

  Map<String, Object?> _extractMap(Response<Object?> response) {
    final Object? data = response.data;
    if (data is! Map) {
      throw const PhotosFetchException('Unexpected response format');
    }
    return (data as Map<Object?, Object?>).cast<String, Object?>();
  }
}
