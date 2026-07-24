import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/session.dart';
import '../models/setup_member_draft.dart';
import '../models/setup_status.dart';
import '../services/device_info.dart';
import '../services/identity_service.dart';
import '../services/setup_service.dart';
import 'pairing_adoption.dart';
import 'session_provider.dart';

/// Which screen the app-first onboarding flow is currently showing.
enum OnboardingPhase {
  /// Verifying the scanned `familyboard://setup` URL (and its `alt`
  /// fallback) actually belong to the QR's `installationId` before trusting
  /// either.
  verifying,

  /// Neither the primary nor fallback URL answered with a matching
  /// identity.
  unreachable,

  /// `GET /api/setup/status` reported `setupComplete: true` — someone
  /// finished setup elsewhere (the wall's own fallback wizard, or a race
  /// with another device). Point the user back at normal pairing.
  alreadyConfigured,

  /// Driving the step-by-step wizard.
  wizard,
}

/// The onboarding wizard's steps, in the order this controller drives them.
///
/// Deliberately NOT the wall's own order (`family, members, pin, weather`;
/// see `src/app/setup/wizard.tsx`'s `STEP_ORDER`). `getSetupStatus().
/// setupComplete` is `familyCreated && memberCount >= 1 && pinSet` — it does
/// not require `weatherSet`. Every `/api/setup/*` mutation (including
/// weather) calls `assertSetupIncomplete()` first, so a wizard that sets the
/// PIN before weather locks itself out of `POST /api/setup/weather` the
/// moment the PIN call succeeds (it would 403 `SETUP_ALREADY_COMPLETE` from
/// then on). Ordering weather ahead of PIN sidesteps that trap entirely.
///
/// `pin` is the terminal step: `POST /api/setup/pin` pairs the finishing
/// phone to the admin member in the same call (see the route's doc comment),
/// so there is no separate "who are you?" step — the app is signed in the
/// moment the PIN is set.
enum WizardStep { family, members, weather, pin }

/// Computes the first step to show for a given `/api/setup/status` snapshot,
/// skipping whatever the wall (or a previous app session) already completed.
/// See [WizardStep] for why weather is checked before pin.
///
/// A snapshot with `pinSet: true` also has `setupComplete: true` (pin is the
/// last thing `setupComplete` requires), which `SetupOnboardingController.
/// _loadStatus` checks *before* calling this — so that case never reaches
/// here in practice. `pin` is still the correct fallback: there is nothing
/// left to resume into.
WizardStep resolveInitialStep(SetupStatus status) {
  if (!status.familyCreated) {
    return WizardStep.family;
  }
  if (status.memberCount == 0) {
    return WizardStep.members;
  }
  if (!status.weatherSet) {
    return WizardStep.weather;
  }
  return WizardStep.pin;
}

class SetupOnboardingState {
  const SetupOnboardingState({
    required this.phase,
    this.baseUrl,
    this.altUrl,
    this.installationId,
    this.step = WizardStep.family,
    this.submitting = false,
    this.error,
  });

  const SetupOnboardingState.verifying()
      : phase = OnboardingPhase.verifying,
        baseUrl = null,
        altUrl = null,
        installationId = null,
        step = WizardStep.family,
        submitting = false,
        error = null;

  final OnboardingPhase phase;

  /// The verified, reachable base URL to send setup requests to (either the
  /// QR's `url` or its `alt`, whichever answered with a matching identity).
  final String? baseUrl;

  /// The QR's `alt` fallback, carried into the final [Session] the same way
  /// a normal pair QR's `alt` parameter would be.
  final String? altUrl;

  /// The QR's `installationId`, already verified in [SetupOnboardingController
  /// .start] against whichever of `url`/`alt` answered. Carried into the
  /// final [Session] so it doesn't need a redundant identity round-trip
  /// before connection recovery can trust it — `remoteUrl` still gets
  /// backfilled by the post-pair identity fetch, same as normal pairing.
  final String? installationId;

  final WizardStep step;
  final bool submitting;
  final SetupErrorKind? error;

  static const Object _unset = Object();

  SetupOnboardingState copyWith({
    OnboardingPhase? phase,
    String? baseUrl,
    String? altUrl,
    String? installationId,
    WizardStep? step,
    bool? submitting,
    Object? error = _unset,
  }) {
    return SetupOnboardingState(
      phase: phase ?? this.phase,
      baseUrl: baseUrl ?? this.baseUrl,
      altUrl: altUrl ?? this.altUrl,
      installationId: installationId ?? this.installationId,
      step: step ?? this.step,
      submitting: submitting ?? this.submitting,
      error: identical(error, _unset) ? this.error : error as SetupErrorKind?,
    );
  }
}

final Provider<SetupService> setupServiceProvider = Provider<SetupService>(
  (Ref ref) => SetupService(),
);

class SetupOnboardingController extends Notifier<SetupOnboardingState> {
  @override
  SetupOnboardingState build() => const SetupOnboardingState.verifying();

  /// Verifies the scanned QR's `url` (falling back to `alt`) reports the
  /// same `installationId` via `GET /api/mobile/identity`, then loads
  /// `/api/setup/status` and enters the wizard at the right step.
  Future<void> start({
    required String url,
    required String installationId,
    String? altUrl,
  }) async {
    state = const SetupOnboardingState.verifying();
    final IdentityService identity = ref.read(identityServiceProvider);

    String? verified;
    final IdentityResult? direct = await identity.fetch(url);
    if (direct != null && direct.installationId == installationId) {
      verified = url;
    } else if (altUrl != null && altUrl.isNotEmpty) {
      final IdentityResult? viaAlt = await identity.fetch(altUrl);
      if (viaAlt != null && viaAlt.installationId == installationId) {
        verified = altUrl;
      }
    }

    if (verified == null) {
      state = state.copyWith(phase: OnboardingPhase.unreachable);
      return;
    }

    await _loadStatus(verified, altUrl, installationId);
  }

  Future<void> _loadStatus(
    String baseUrl,
    String? altUrl,
    String installationId,
  ) async {
    try {
      final SetupStatus status =
          await ref.read(setupServiceProvider).fetchStatus(baseUrl);
      if (status.setupComplete) {
        state = state.copyWith(
          phase: OnboardingPhase.alreadyConfigured,
          baseUrl: baseUrl,
        );
        return;
      }
      state = state.copyWith(
        phase: OnboardingPhase.wizard,
        baseUrl: baseUrl,
        altUrl: altUrl,
        installationId: installationId,
        step: resolveInitialStep(status),
        error: null,
      );
    } on SetupException {
      state = state.copyWith(phase: OnboardingPhase.unreachable);
    }
  }

  Future<bool> submitFamily(String name) => _run(() async {
        await ref.read(setupServiceProvider).createFamily(state.baseUrl!, name);
        state = state.copyWith(step: WizardStep.members);
      });

  Future<bool> submitMembers(List<SetupMemberDraft> drafts) => _run(() async {
        await ref
            .read(setupServiceProvider)
            .createMembers(state.baseUrl!, drafts);
        state = state.copyWith(step: WizardStep.weather);
      });

  Future<bool> submitWeather({
    required double lat,
    required double lon,
    required String label,
  }) =>
      _run(() async {
        await ref.read(setupServiceProvider).setWeather(
              state.baseUrl!,
              lat: lat,
              lon: lon,
              label: label,
            );
        state = state.copyWith(step: WizardStep.pin);
      });

  /// Mirrors the wall's `StepWeather.onSkip` — weather is optional and does
  /// not gate `setupComplete`.
  void skipWeather() {
    state = state.copyWith(step: WizardStep.pin);
  }

  /// Sets the admin PIN and, in the same call, pairs this phone to the
  /// admin member (`POST /api/setup/pin` with `device`). Builds the final
  /// [Session] exactly the way `PairService.pair` does after
  /// `POST /api/devices/pair`: `serverUrl`/`altUrl`/`installationId` come
  /// from this onboarding session, `token`/`deviceId`/`member`/`family` come
  /// from the response. `remoteUrl` is left null — the wall's setup/pin
  /// response doesn't carry one — and gets backfilled by the same post-pair
  /// identity fetch [adoptPairedSession] runs for normal pairing.
  Future<bool> submitPin(String pin) => _run(() async {
        final String? baseUrl = state.baseUrl;
        if (baseUrl == null) {
          throw const SetupException(SetupErrorKind.unknown);
        }
        final SetupPinSession result =
            await ref.read(setupServiceProvider).setPin(
                  baseUrl,
                  pin,
                  deviceName: defaultDeviceName(),
                  devicePlatform: detectDevicePlatform(),
                );
        final Session session = Session(
          serverUrl: baseUrl,
          altUrl: state.altUrl,
          installationId: state.installationId,
          token: result.token,
          deviceId: result.deviceId,
          member: result.member,
          family: result.family,
        );
        await adoptPairedSession(ref, session);
      });

  Future<bool> _run(Future<void> Function() body) async {
    state = state.copyWith(submitting: true, error: null);
    try {
      await body();
      state = state.copyWith(submitting: false);
      return true;
    } on SetupException catch (err) {
      if (err.kind == SetupErrorKind.alreadyComplete) {
        state = state.copyWith(
          phase: OnboardingPhase.alreadyConfigured,
          submitting: false,
          error: null,
        );
        return false;
      }
      state = state.copyWith(submitting: false, error: err.kind);
      return false;
    }
  }
}

final NotifierProvider<SetupOnboardingController, SetupOnboardingState>
    setupOnboardingControllerProvider =
    NotifierProvider<SetupOnboardingController, SetupOnboardingState>(
  SetupOnboardingController.new,
);
