# FamilyBoard mobile companion

Flutter app that pairs with the FamilyBoard wall and (eventually) gives each
family member a phone-sized view of today's events, chores, and to-dos.

**Status:** M2.3 — FCM push notifications wired (pairing, foreground/background/tap handling, token registration).

## First-time setup

The Dart code in `lib/` was hand-authored. The native iOS and Android project
shells ARE checked in (including the hand-wired `Runner.xcodeproj`: bundle ID
`com.familyboard.familyboardMobile`, entitlements, deployment target 15.5,
`GoogleService-Info.plist` reference) — do NOT re-run `flutter create`, it
overwrites the wiring. After you clone:

```bash
# Install Flutter 3.x — https://docs.flutter.dev/get-started/install
cd mobile
flutter pub get
flutter gen-l10n
```

The Firebase config files are gitignored and must be dropped in manually:
`android/app/google-services.json` and `ios/Runner/GoogleService-Info.plist`
(both from Firebase Console → Project Settings → Your apps). The iOS file is
already referenced by the Xcode project — placing it on disk is enough.

For building and uploading the iOS app to TestFlight see
[`docs/testflight-upload.md`](../docs/testflight-upload.md).

### Brand the launcher icons (one extra step)

`flutter create` ships a default Flutter logo on both platforms. To replace
it with the FamilyBoard bullseye, run the icon generator from the repo
root after the native shells exist:

```bash
cd ..    # back to repo root
node scripts/generate-app-icons.mjs
```

This regenerates the PWA favicons, Android adaptive launcher icons (5
density buckets), and the full iOS `AppIcon.appiconset` (15 sizes,
alpha-stripped per App Store rules). The iOS write step is gated on
`mobile/ios/Runner/Assets.xcassets/AppIcon.appiconset` existing — if you
haven't run `flutter create` yet, the iOS section silently skips. Brand
tokens (CREAM, INK, CORAL) live at the top of the script.

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

## Self-healing connection (mDNS discovery) setup

The wall's LAN IP can change after a DHCP lease renewal. To survive that
without re-pairing, the QR code's `url` param may be paired with an optional
`alt` fallback URL, and the app falls back further to scanning the LAN for
the wall's `_familyboard._tcp` mDNS service (`package:nsd`) — see
`lib/services/connection_recovery_service.dart`.

### Android — `android/app/src/main/AndroidManifest.xml`

`package:nsd` needs multicast to receive mDNS replies. Add next to the
existing `INTERNET` permission:

```xml
<uses-permission android:name="android.permission.CHANGE_WIFI_MULTICAST_STATE" />
```

### iOS — `ios/Runner/Info.plist`

Already updated in git — local-network + Bonjour usage keys, required for
`nsd` to discover the wall on iOS 14+:

```xml
<key>NSLocalNetworkUsageDescription</key>
<string>FamilyBoard looks for your board on the home network so it can reconnect automatically if its address changes.</string>
<key>NSBonjourServices</key>
<array>
  <string>_familyboard._tcp</string>
</array>
```

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
| `GET` | `/api/mobile/identity` | unauthenticated; `{ installationId, familyName, appVersion }` (accepts `{ data: {...} }` or flat); used to verify a rediscovered host during connection recovery |

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
