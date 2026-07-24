import 'dart:io' show Platform;

/// Platform string sent to the wall on any endpoint that pairs a device
/// (`POST /api/devices/pair`, `POST /api/setup/pin`). Mirrors the wall's
/// `platform` enum for those routes — `web` is never produced by this app.
String detectDevicePlatform() {
  if (Platform.isIOS) {
    return 'ios';
  }
  if (Platform.isAndroid) {
    return 'android';
  }
  return 'unknown';
}

/// Sensible default device name shown/sent when the user hasn't (or can't)
/// pick one — used by manual pairing entry and by app-first onboarding,
/// which pairs the finishing device silently as part of setting the PIN.
String defaultDeviceName() {
  if (Platform.isIOS) {
    return 'iPhone';
  }
  if (Platform.isAndroid) {
    return 'Android phone';
  }
  return 'Phone';
}
