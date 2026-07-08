# TestFlight upload — iOS companion app

How to get `mobile/` onto your iPhone via TestFlight. The machine-side prep
(Flutter SDK, CocoaPods, regenerated iOS shell, Xcode project wiring) is
already done — see "What is already prepared" below.

## What is already prepared

- Flutter SDK at `~/development/flutter`, CocoaPods via Homebrew. Not yet on PATH — add once: `echo 'export PATH="$HOME/development/flutter/bin:$PATH"' >> ~/.zshrc`.
- iOS native shell regenerated (`flutter create --org com.familyboard --project-name familyboard_mobile --platforms=ios .`), git-tracked files restored on top.
- Bundle ID `com.familyboard.familyboardMobile` — matches the Firebase iOS app in `GoogleService-Info.plist`.
- `GoogleService-Info.plist` is referenced in the Xcode project and copied into the app bundle (the manual "Add Files to Runner…" step from `mobile/README.md` is no longer needed).
- `Runner.entitlements` linked via `CODE_SIGN_ENTITLEMENTS` (aps-environment = development; Xcode/export rewrites it to production automatically when signing with an App Store profile).
- `Info.plist`: `familyboard://` URL scheme + `NSCameraUsageDescription` added (QR pairing would crash without it), duplicate `UIBackgroundModes` block removed.
- iOS deployment target 15.5 (required by `mobile_scanner` 7.x).
- Release build compiles (`flutter build ios --release --no-codesign` passes).

## One-time Apple-side setup (needs your Apple ID)

1. **Apple Developer Program** — enroll at <https://developer.apple.com/programs/enroll/> (99 USD/year). TestFlight is not available on a free account.
2. **Xcode sign-in** — Xcode → Settings → Accounts → "+" → your Apple ID.
3. **Signing** — open `mobile/ios/Runner.xcworkspace`, select the *Runner* target → *Signing & Capabilities* → tick "Automatically manage signing" and pick your team. Xcode creates the signing certificate and registers the App ID. If it complains about `aps-environment`, click *+ Capability* → *Push Notifications* once.
4. **App record** — <https://appstoreconnect.apple.com> → Apps → "+" → New App: platform iOS, bundle ID `com.familyboard.familyboardMobile`, name e.g. "FamilyBoard", SKU free-form.
5. **APNs key for push (optional but needed for FCM)** — developer.apple.com → Certificates, Identifiers & Profiles → Keys → "+" → enable *Apple Push Notifications service*; download the `.p8` and upload it in Firebase Console → Project Settings → Cloud Messaging → APNs Authentication Key (with Key ID + Team ID). Without this, iOS gets FCM tokens but no messages.

## Build & upload (repeat per release)

```bash
cd mobile
flutter build ipa
```

Output: `mobile/build/ios/ipa/familyboard_mobile.ipa` and the archive at
`mobile/build/ios/archive/Runner.xcarchive`.

Upload — pick one:

- **Transporter** (simplest): install "Transporter" from the Mac App Store, sign in, drag the `.ipa` in, *Deliver*.
- **Xcode Organizer**: `open mobile/build/ios/archive/Runner.xcarchive` → *Distribute App* → *TestFlight & App Store*.

## TestFlight on the iPhone

1. App Store Connect → your app → *TestFlight* tab. The build appears after Apple's processing (5–15 min).
2. First build: answer the export-compliance question (the app uses only standard HTTPS → "standard encryption, exempt").
3. Create an *Internal Testing* group, add yourself as tester.
4. Install the **TestFlight** app on the iPhone, accept the invite, install FamilyBoard.

## Versioning

`mobile/pubspec.yaml` `version: 0.1.0+1` maps to
`CFBundleShortVersionString 0.1.0` / `CFBundleVersion 1`. Every upload needs a
unique build number — bump the `+N` part before each `flutter build ipa`.
