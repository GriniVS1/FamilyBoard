import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../state/setup_onboarding_controller.dart';
import 'setup_error_text.dart';

class StepPinView extends ConsumerStatefulWidget {
  const StepPinView({super.key});

  @override
  ConsumerState<StepPinView> createState() => _StepPinViewState();
}

class _StepPinViewState extends ConsumerState<StepPinView> {
  final TextEditingController _pinController = TextEditingController();
  final TextEditingController _confirmController = TextEditingController();
  String? _localError;

  @override
  void dispose() {
    _pinController.dispose();
    _confirmController.dispose();
    super.dispose();
  }

  bool get _isValidLength =>
      _pinController.text.length == 6 && _confirmController.text.length == 6;

  Future<void> _next() async {
    final AppL10n l10n = AppL10n.of(context);
    final String pin = _pinController.text;
    final String confirm = _confirmController.text;
    if (!RegExp(r'^\d{6}$').hasMatch(pin)) {
      setState(() => _localError = l10n.setupPinInvalid);
      return;
    }
    if (pin != confirm) {
      setState(() => _localError = l10n.setupPinMismatch);
      return;
    }
    setState(() => _localError = null);
    await ref.read(setupOnboardingControllerProvider.notifier).submitPin(pin);
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);
    final List<TextInputFormatter> digitsOnly = <TextInputFormatter>[
      FilteringTextInputFormatter.digitsOnly,
      LengthLimitingTextInputFormatter(6),
    ];

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.setupPinTitle,
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(l10n.setupPinDescription,
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          TextField(
            controller: _pinController,
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: digitsOnly,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.setupPinLabel),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _confirmController,
            obscureText: true,
            keyboardType: TextInputType.number,
            inputFormatters: digitsOnly,
            onChanged: (String _) => setState(() {}),
            onSubmitted: (String _) => _next(),
            decoration: InputDecoration(labelText: l10n.setupPinConfirmLabel),
          ),
          if (_localError != null) ...<Widget>[
            const SizedBox(height: 12),
            Text(_localError!,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          if (state.error != null) ...<Widget>[
            const SizedBox(height: 16),
            SetupErrorText(kind: state.error!),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: (!_isValidLength || state.submitting) ? null : _next,
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
