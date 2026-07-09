/// POD model for a wall screensaver photo returned by
/// `GET /api/mobile/photos`.
library;

class Photo {
  const Photo({
    required this.id,
    required this.path,
    required this.caption,
    required this.uploadedAt,
  });

  factory Photo.fromJson(Map<String, Object?> json) {
    final Object? captionRaw = json['caption'];
    return Photo(
      id: json['id']! as String,
      path: json['path']! as String,
      caption:
          captionRaw is String && captionRaw.isNotEmpty ? captionRaw : null,
      uploadedAt: DateTime.parse(json['uploadedAt']! as String),
    );
  }

  final String id;

  /// Relative path like `/api/photos-stream/<filename>`. Prefix with the
  /// active session's `effectiveUrl` to load it — that stream route is
  /// unauthenticated on the LAN, so a plain `Image.network` works.
  final String path;

  final String? caption;
  final DateTime uploadedAt;
}
