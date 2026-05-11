# FamilyBoard mobile companion

Flutter app that pairs with the FamilyBoard wall and (eventually) gives each
family member a phone-sized view of today's events, chores, and to-dos.

**Status:** M2.1 skeleton — pairing flow + home screen stub. Native push
(Firebase Messaging) and the local cache (drift) land in M2.2.

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
    models/session.dart      hand-written POD (no freezed)
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

Should print `OK: 26 keys present in all 4 locales.`

## What this skeleton talks to (wall contract)

All endpoints are on the FamilyBoard wall under the user-supplied
`serverUrl`. Each authenticated call sends `Authorization: Bearer <token>`.

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/devices/pair` | body `{ code, name, platform }`, returns `{ token, deviceId, member, family }` |
| `POST` | `/api/devices/me/heartbeat` | bearer required, returns `{ ok, deviceId, memberId, lastSeenAt }` |
| `POST` | `/api/devices/me/fcm-token` | bearer required; wired in M2.2 |

## What's deferred to M2.2

- `firebase_messaging` + `firebase_core` for push notifications
- `drift` (or `sqlite3`) for offline cache
- `app_links` for handling `familyboard://pair?…` cold-starts
- Real data views (Today, Chores, To-dos)
