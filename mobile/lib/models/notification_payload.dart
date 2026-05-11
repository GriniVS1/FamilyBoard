/// Structured push notification payload as sent by the FamilyBoard wall.
///
/// The wall includes these fields in the FCM data map:
///   title – notification title
///   body  – notification body
///   url   – in-app navigation target (e.g. "/" or "/calendar")
///   tag   – optional dedup / replacement tag
class NotificationPayload {
  const NotificationPayload({
    required this.title,
    required this.body,
    required this.url,
    this.tag,
  });

  factory NotificationPayload.fromData(Map<String, String> data) {
    return NotificationPayload(
      title: data['title'] ?? '',
      body: data['body'] ?? '',
      url: data['url'] ?? '/',
      tag: data['tag'],
    );
  }

  final String title;
  final String body;

  /// In-app route, e.g. "/", "/calendar".
  final String url;

  /// Optional dedup tag passed from the wall.
  final String? tag;
}
