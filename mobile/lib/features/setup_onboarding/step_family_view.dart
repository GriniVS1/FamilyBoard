import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../state/setup_onboarding_controller.dart';
import 'setup_error_text.dart';

class StepFamilyView extends ConsumerStatefulWidget {
  const StepFamilyView({super.key});

  @override
  ConsumerState<StepFamilyView> createState() => _StepFamilyViewState();
}

class _StepFamilyViewState extends ConsumerState<StepFamilyView> {
  final TextEditingController _nameController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  Future<void> _next() async {
    final String name = _nameController.text.trim();
    if (name.isEmpty) {
      return;
    }
    await ref
        .read(setupOnboardingControllerProvider.notifier)
        .submitFamily(name);
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);
    final bool canSubmit = _nameController.text.trim().isNotEmpty;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.setupFamilyTitle,
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(l10n.setupFamilyDescription,
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          TextField(
            controller: _nameController,
            autofocus: true,
            textCapitalization: TextCapitalization.words,
            maxLength: 60,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.setupFamilyNameLabel),
            onSubmitted: (String _) => _next(),
          ),
          if (state.error != null) ...<Widget>[
            const SizedBox(height: 8),
            SetupErrorText(kind: state.error!),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: (!canSubmit || state.submitting) ? null : _next,
            child: state.submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : Text(l10n.setupStepNext),
          ),
        ],
      ),
    );
  }
}
