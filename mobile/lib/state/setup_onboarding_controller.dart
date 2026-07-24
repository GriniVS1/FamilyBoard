import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/family_member.dart';
import '../models/setup_member_draft.dart';
import '../models/setup_status.dart';
import '../services/identity_service.dart';
import '../services/pair_service.dart';
import '../services/setup_service.dart';
import 'pair_controller.dart';
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
enum WizardStep { family, members, weather, pin, whoAreYou }

/// Computes the first step to show for a given `/api/setup/status` snapshot,
/// skipping whatever the wall (or a previous app session) already completed.
/// See [WizardStep] for why weather is checked before pin.
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
  if (!status.pinSet) {
    return WizardStep.pin;
  }
  return WizardStep.whoAreYou;
}

class SetupOnboardingState {
  const SetupOnboardingState({
    required this.phase,
    this.baseUrl,
    this.altUrl,
    this.step = WizardStep.family,
    this.submitting = false,
    this.error,
    this.members = const <FamilyMember>[],
    this.pin,
  });

  const SetupOnboardingState.verifying()
      : phase = OnboardingPhase.verifying,
        baseUrl = null,
        altUrl = null,
        step = WizardStep.family,
        submitting = false,
        error = null,
        members = const <FamilyMember>[],
        pin = null;

  final OnboardingPhase phase;

  /// The verified, reachable base URL to send setup requests to (either the
  /// QR's `url` or its `alt`, whichever answered with a matching identity).
  final String? baseUrl;

  /// The QR's `alt` fallback, carried into the final pairing step so the
  /// resulting [Session] gets the same recovery fallback a normal pair QR
  /// would provide.
  final String? altUrl;

  final WizardStep step;
  final bool submitting;
  final SetupErrorKind? error;
  final List<FamilyMember> members;

  /// The admin PIN entered in the pin step, held only in memory for the rest
  /// of this onboarding session — used once, to request a pairing code in
  /// the final step. Never persisted, never logged.
  final String? pin;

  static const Object _unset = Object();

  SetupOnboardingState copyWith({
    OnboardingPhase? phase,
    String? baseUrl,
    String? altUrl,
    WizardStep? step,
    bool? submitting,
    Object? error = _unset,
    List<FamilyMember>? members,
    Object? pin = _unset,
  }) {
    return SetupOnboardingState(
      phase: phase ?? this.phase,
      baseUrl: baseUrl ?? this.baseUrl,
      altUrl: altUrl ?? this.altUrl,
      step: step ?? this.step,
      submitting: submitting ?? this.submitting,
      error: identical(error, _unset) ? this.error : error as SetupErrorKind?,
      members: members ?? this.members,
      pin: identical(pin, _unset) ? this.pin : pin as String?,
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

    await _loadStatus(verified, altUrl);
  }

  Future<void> _loadStatus(String baseUrl, String? altUrl) async {
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
        final List<FamilyMember> created = await ref
            .read(setupServiceProvider)
            .createMembers(state.baseUrl!, drafts);
        state = state.copyWith(step: WizardStep.weather, members: created);
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

  Future<bool> submitPin(String pin) => _run(() async {
        await ref.read(setupServiceProvider).setPin(state.baseUrl!, pin);
        final List<FamilyMember> members =
            await ref.read(setupServiceProvider).fetchMembers(state.baseUrl!);
        state = state.copyWith(
            step: WizardStep.whoAreYou, pin: pin, members: members);
      });

  /// Requests a pairing code for [memberId] with the PIN captured in the pin
  /// step, then hands off to [PairController.submit] — the exact same
  /// `POST /api/devices/pair` + session-adopt + FCM-enrollment path the
  /// normal Settings-screen QR uses.
  Future<bool> completePairing({
    required String memberId,
    required String deviceName,
  }) =>
      _run(() async {
        final String? pin = state.pin;
        final String? baseUrl = state.baseUrl;
        if (pin == null || baseUrl == null) {
          throw const SetupException(SetupErrorKind.unknown);
        }
        final PairCodeResult code =
            await ref.read(setupServiceProvider).requestPairCode(
                  baseUrl,
                  memberId: memberId,
                  pin: pin,
                );
        final bool paired =
            await ref.read(pairControllerProvider.notifier).submit(
                  serverUrl: code.serverUrl,
                  code: code.code,
                  deviceName: deviceName,
                  altUrl: code.mdnsUrl ?? state.altUrl,
                  remoteUrl: code.remoteUrl,
                );
        if (!paired) {
          throw SetupException(
              _mapPairError(ref.read(pairControllerProvider).error));
        }
      });

  SetupErrorKind _mapPairError(PairErrorKind? kind) {
    switch (kind) {
      case PairErrorKind.network:
        return SetupErrorKind.network;
      case PairErrorKind.tooManyAttempts:
        return SetupErrorKind.tooManyAttempts;
      case PairErrorKind.invalidCode:
      case PairErrorKind.badServer:
      case PairErrorKind.unknown:
      case null:
        return SetupErrorKind.unknown;
    }
  }

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
