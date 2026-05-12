# FamilyBoard mobile companion

Flutter app that pairs with the FamilyBoard wall and (eventually) gives each
family member a phone-sized view of today's events, chores, and to-dos.

**Status:** M2.3 — FCM push notifications wired (pairing, foreground/background/tap handling, token registration).

## First-time setup

The Dart code in `lib/` was hand-authored. The native iOS/Android project
shells are NOT in git. Run this once after you clone:

```bash
# Install Flutter 3.x — https://docs.flutter.dev/get-started/install
cd mobile
flutter create --org com.familyboard --platforms=ios,android .
flutter pub get
flutter gen-l10n
```

`flutter create` adds `ios/`, `android/`, and a default `main.dart`. The
existing `lib/main.dart` (the one you cloned) takes precedence — Flutter will
overwrite it. Restore it with `git checkout lib/main.dart`.

## Running the app

```bash
# iOS simulator
flutter run -d ios

# Android emulator
flutter run -d emulator
```

## Native deep-link setup (REQUIRED before pairing works)

The wall produces `familyboard://pair?url=<wallOrigin>&code=<CODE>` deep links.
After running `flutter create`, append the URL-scheme blocks below.

### iOS — `ios/Runner/Info.plist`

Insert inside the top-level `<dict>`:

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLName</key>
    <string>com.familyboard.pair</string>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>familyboard</string>
    </array>
  </dict>
</array>
<key>NSCameraUsageDescription</key>
<string>FamilyBoard uses the camera to scan the QR pairing code shown on your FamilyBoard.</string>
```

### Android — `android/app/src/main/AndroidManifest.xml`

Inside the existing `<activity android:name=".MainActivity" ...>`, add:

```xml
<intent-filter android:autoVerify="false">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="familyboard" android:host="pair" />
</intent-filter>
```

> M2.1 only uses the camera-scanner route into the pair flow; the
> `familyboard://pair?...` deep link is recognised end-to-end in M2.2 once the
> `app_links` package lands. The scheme is registered now so we don't have to
> touch the native projects again later.

## Project layout

```
mobile/
  pubspec.yaml
  analysis_options.yaml      strict-casts, strict-inference, flutter_lints
  l10n.yaml                  gen-l10n config → lib/l10n/generated/
  lib/
    main.dart                runApp(ProviderScope(FamilyBoardApp))
    app.dart                 MaterialApp.router + go_router redirect logic
    theme.dart               Material 3 wired to FamilyBoard accent palette
    services/
      api_client.dart        Dio factory (Bearer interceptor for auth calls)
      fcm_service.dart       Firebase Cloud Messaging: permission, token, register, listeners
      secure_storage.dart    typed flutter_secure_storage wrapper
      pair_service.dart      POST /api/devices/pair
      heartbeat_service.dart POST /api/devices/me/heartbeat
    state/
      session_provider.dart  Riverpod Notifier — loads / clears the session
      pair_controller.dart   Riverpod Notifier — drives the pair form
    features/
      splash/splash_screen.dart
      pair/{pair_screen,manual_entry_view,qr_scanner_view}.dart
      home/home_screen.dart
    models/
      session.dart           hand-written POD (no freezed)
      notification_payload.dart  typed FCM data-message envelope
    l10n/
      app_en.arb  app_de.arb  app_fr.arb  app_it.arb
  tool/
    sync_messages.dart       dart run tool/sync_messages.dart — ARB parity check
```

## Validating localisation key parity

```bash
cd mobile
dart run tool/sync_messages.dart
```

Should print `OK: 44 keys present in all 4 locales.`

## What this skeleton talks to (wall contract)

All endpoints are on the FamilyBoard wall under the user-supplied
`serverUrl`. Each authenticated call sends `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/devices/pair` | body `{ code, name, platform }`, returns `{ token, deviceId, member, family }` |
| `POST` | `/api/devices/me/heartbeat` | bearer required, returns `{ ok, deviceId, memberId, lastSeenAt }` |
| `POST` | `/api/devices/me/fcm-token` | bearer required; body `{ fcmToken? }` or `{ apnsToken? }` on iOS; wired in M2.3 |

## Android FCM setup

The `google-services.json` file (from Firebase Console → Project Settings →
Your apps → Android app → Download google-services.json) must be placed at
`android/app/google-services.json`. It is already on disk for this project.

The Gradle plugin is already wired — these changes were applied to the files
in git:

**`android/settings.gradle.kts`** — inside the `plugins {}` block, add:
```kotlin
id("com.google.gms.google-services") version "4.4.2" apply false
```

**`android/app/build.gradle.kts`** — inside the `plugins {}` block, add:
```kotlin
id("com.google.gms.google-services")
```

`compileSdk` is `flutter.compileSdkVersion` (Flutter 3.41 = 35) and
`minSdk` is `flutter.minSdkVersion` (= 21). Both exceed firebase_messaging
15.x requirements (compileSdk ≥ 33, minSdk ≥ 19). No manual overrides needed.

## iOS FCM setup

**`ios/Runner/Info.plist`** — already updated in git. The following block was
added inside the top-level `<dict>` (required for background delivery):
```xml
<key>UIBackgroundModes</key>
<array>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

**`ios/Runner/Runner.entitlements`** — created in git with:
```xml
<key>aps-environment</key>
<string>development</string>
```
Change the value to `production` before submitting to the App Store.

**Xcode steps the developer must do manually** (cannot be scripted):

1. Add `GoogleService-Info.plist` via Xcode — **do not** just drop it in the
   filesystem. Open `ios/Runner.xcworkspace` in Xcode, right-click the
   `Runner` group → "Add Files to Runner…", select
   `ios/Runner/GoogleService-Info.plist`, tick "Copy items if needed".
   Without this Xcode step the file won't be in the app bundle.
2. Open `Runner` target → Signing & Capabilities → "+ Capability" → push
   Notifications. This adds the Push Notifications entitlement and links
   the `.entitlements` file.
3. iOS push requires an **APNs Auth Key** uploaded to Firebase Console →
   Project Settings → Cloud Messaging → APNs Authentication Key (or APNs
   Certificates). Without this, iOS devices receive FCM tokens but no
   messages will be delivered.

## What's deferred to M3

- `drift` (or `sqlite3`) for offline cache
- `app_links` for handling `familyboard://pair?…` cold-starts
- `/calendar` route — notification taps with `url: "/calendar"` currently
  fall back to `/home` until the calendar screen lands
