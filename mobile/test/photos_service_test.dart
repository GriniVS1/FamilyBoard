// Unit tests for the pure extension/MIME guessing logic in
// `PhotosService` (used to reject unsupported gallery picks before they're
// ever sent to the wall), plus `Photo.fromJson` parsing.

import 'package:familyboard_mobile/models/photo.dart';
import 'package:familyboard_mobile/services/photos_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('photoExtensionOf', () {
    test('extracts a lower-cased extension', () {
      expect(photoExtensionOf('/tmp/IMG_0001.JPG'), equals('jpg'));
      expect(photoExtensionOf('/tmp/photo.png'), equals('png'));
    });

    test('returns null when there is no extension', () {
      expect(photoExtensionOf('/tmp/noext'), isNull);
      expect(photoExtensionOf('/tmp/trailing.'), isNull);
    });
  });

  group('isAcceptablePhotoExtension', () {
    test('accepts the wall-supported formats', () {
      expect(isAcceptablePhotoExtension('a.jpg'), isTrue);
      expect(isAcceptablePhotoExtension('a.jpeg'), isTrue);
      expect(isAcceptablePhotoExtension('a.png'), isTrue);
      expect(isAcceptablePhotoExtension('a.webp'), isTrue);
      expect(isAcceptablePhotoExtension('a.gif'), isTrue);
    });

    test('rejects HEIC and other unsupported formats', () {
      expect(isAcceptablePhotoExtension('a.heic'), isFalse);
      expect(isAcceptablePhotoExtension('a.HEIC'), isFalse);
      expect(isAcceptablePhotoExtension('a.bmp'), isFalse);
      expect(isAcceptablePhotoExtension('a'), isFalse);
    });
  });

  group('photoMimeTypeOf', () {
    test('maps extensions to their MIME type', () {
      expect(photoMimeTypeOf('a.jpg'), equals('image/jpeg'));
      expect(photoMimeTypeOf('a.jpeg'), equals('image/jpeg'));
      expect(photoMimeTypeOf('a.png'), equals('image/png'));
      expect(photoMimeTypeOf('a.webp'), equals('image/webp'));
      expect(photoMimeTypeOf('a.gif'), equals('image/gif'));
    });

    test('falls back to octet-stream for unknown extensions', () {
      expect(photoMimeTypeOf('a.heic'), equals('application/octet-stream'));
    });
  });

  group('Photo.fromJson', () {
    test('parses a full payload', () {
      final Photo photo = Photo.fromJson(<String, Object?>{
        'id': 'p1',
        'path': '/api/photos-stream/p1.jpg',
        'caption': 'Beach day',
        'uploadedAt': '2026-07-01T12:00:00.000Z',
      });
      expect(photo.id, equals('p1'));
      expect(photo.path, equals('/api/photos-stream/p1.jpg'));
      expect(photo.caption, equals('Beach day'));
      expect(
          photo.uploadedAt, equals(DateTime.parse('2026-07-01T12:00:00.000Z')));
    });

    test('treats an empty caption as null', () {
      final Photo photo = Photo.fromJson(<String, Object?>{
        'id': 'p2',
        'path': '/api/photos-stream/p2.jpg',
        'caption': '',
        'uploadedAt': '2026-07-01T12:00:00.000Z',
      });
      expect(photo.caption, isNull);
    });
  });
}
