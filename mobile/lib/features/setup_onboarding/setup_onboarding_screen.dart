import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../state/setup_onboarding_controller.dart';
import '../../widgets/familyboard_logo.dart';
import '../pair/qr_scanner_view.dart';
import 'step_family_view.dart';
import 'step_members_view.dart';
import 'step_pin_view.dart';
import 'step_weather_view.dart';
import 'step_who_are_you_view.dart';

/// App-first onboarding: driven entirely from a scanned `familyboard://setup`
/// QR code. See `SetupOnboardingController` for the verification + wizard
/// step machinery.
class SetupOnboardingScreen extends ConsumerStatefulWidget {
  const SetupOnboardingScreen({super.key, required this.payload});

  final ScannedSetupPayload payload;

  @override
  ConsumerState<SetupOnboardingScreen> createState() =>
      _SetupOnboardingScreenState();
}

class _SetupOnboardingScreenState extends ConsumerState<SetupOnboardingScreen> {
  @override
  void initState() {
    super.initState();
    Future<void>.microtask(_startVerification);
  }

  Future<void> _startVerification() async {
    await ref.read(setupOnboardingControllerProvider.notifier).start(
          url: widget.payload.url,
          installationId: widget.payload.installationId,
          altUrl: widget.payload.altUrl,
        );
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: Semantics(
          label: l10n.setupWizardAppBarTitle,
          child: const FamilyBoardLogo(fontSize: 18),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _buildBody(context, l10n, state),
        ),
      ),
    );
  }

  Widget _buildBody(
      BuildContext context, AppL10n l10n, SetupOnboardingState state) {
    switch (state.phase) {
      case OnboardingPhase.verifying:
        return _VerifyingView(l10n: l10n);
      case OnboardingPhase.unreachable:
        return _UnreachableView(l10n: l10n, onRetry: _startVerification);
      case OnboardingPhase.alreadyConfigured:
        return _AlreadyConfiguredView(l10n: l10n);
      case OnboardingPhase.wizard:
        return _WizardBody(step: state.step);
    }
  }
}

class _WizardBody extends StatelessWidget {
  const _WizardBody({required this.step});

  final WizardStep step;

  @override
  Widget build(BuildContext context) {
    switch (step) {
      case WizardStep.family:
        return const StepFamilyView();
      case WizardStep.members:
        return const StepMembersView();
      case WizardStep.weather:
        return const StepWeatherView();
      case WizardStep.pin:
        return const StepPinView();
      case WizardStep.whoAreYou:
        return const StepWhoAreYouView();
    }
  }
}

class _VerifyingView extends StatelessWidget {
  const _VerifyingView({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          const CircularProgressIndicator(),
          const SizedBox(height: 24),
          Text(l10n.setupOnboardingVerifyingTitle,
              style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _UnreachableView extends StatelessWidget {
  const _UnreachableView({required this.l10n, required this.onRetry});

  final AppL10n l10n;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.wifi_off,
              size: 48, color: Theme.of(context).colorScheme.error),
          const SizedBox(height: 16),
          Text(
            l10n.setupOnboardingUnreachableTitle,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.setupOnboardingUnreachableMessage,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: onRetry,
            child: Text(l10n.setupOnboardingRetry),
          ),
        ],
      ),
    );
  }
}

class _AlreadyConfiguredView extends StatelessWidget {
  const _AlreadyConfiguredView({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Icon(Icons.check_circle_outline,
              size: 48, color: Theme.of(context).colorScheme.primary),
          const SizedBox(height: 16),
          Text(
            l10n.setupOnboardingAlreadyTitle,
            style: Theme.of(context).textTheme.headlineSmall,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            l10n.setupOnboardingAlreadyMessage,
            style: Theme.of(context).textTheme.bodyMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          FilledButton(
            onPressed: () => context.go('/pair'),
            child: Text(l10n.setupOnboardingBackToPair),
          ),
        ],
      ),
    );
  }
}
