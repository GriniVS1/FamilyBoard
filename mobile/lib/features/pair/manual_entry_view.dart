import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/pair_service.dart';
import '../../state/pair_controller.dart';

class ManualEntryView extends ConsumerStatefulWidget {
  const ManualEntryView({
    super.key,
    required this.initialServerUrl,
    required this.initialCode,
    required this.initialDeviceName,
    this.initialAltUrl,
  });

  final String initialServerUrl;
  final String initialCode;
  final String initialDeviceName;

  /// Optional fallback URL carried from the QR code's `alt` parameter.
  /// Not user-editable — there is no text field for it, it just rides along
  /// to [PairController.submit] so connection recovery has a fallback host.
  final String? initialAltUrl;

  @override
  ConsumerState<ManualEntryView> createState() => _ManualEntryViewState();
}

class _ManualEntryViewState extends ConsumerState<ManualEntryView> {
  late final TextEditingController _serverController;
  late final TextEditingController _codeController;
  late final TextEditingController _nameController;
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _serverController = TextEditingController(text: widget.initialServerUrl);
    _codeController = TextEditingController(text: widget.initialCode);
    _nameController = TextEditingController(text: widget.initialDeviceName);
  }

  @override
  void dispose() {
    _serverController.dispose();
    _codeController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final PairFormState pairState = ref.watch(pairControllerProvider);
    final String? errorMessage = _errorMessage(pairState.error, l10n);

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          TextFormField(
            controller: _serverController,
            decoration: InputDecoration(
              labelText: l10n.pairServerUrlLabel,
              hintText: 'http://familyboard.local:3000',
            ),
            keyboardType: TextInputType.url,
            autocorrect: false,
            textInputAction: TextInputAction.next,
            validator: (String? value) {
              if (value == null || value.trim().isEmpty) {
                return l10n.pairErrorBadServer;
              }
              final Uri? uri = Uri.tryParse(value.trim());
              if (uri == null ||
                  (uri.scheme != 'http' && uri.scheme != 'https') ||
                  uri.host.isEmpty) {
                return l10n.pairErrorBadServer;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _codeController,
            decoration: InputDecoration(
              labelText: l10n.pairCodeLabel,
              hintText: 'ABC-123',
            ),
            textCapitalization: TextCapitalization.characters,
            textInputAction: TextInputAction.next,
            inputFormatters: <TextInputFormatter>[
              FilteringTextInputFormatter.allow(RegExp(r'[A-Za-z0-9\-]')),
              LengthLimitingTextInputFormatter(10),
            ],
            validator: (String? value) {
              if (value == null || value.trim().length < 6) {
                return l10n.pairErrorInvalidCode;
              }
              return null;
            },
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _nameController,
            decoration: InputDecoration(
              labelText: l10n.pairDeviceNameLabel,
            ),
            textCapitalization: TextCapitalization.words,
            textInputAction: TextInputAction.done,
            validator: (String? value) {
              if (value == null || value.trim().isEmpty) {
                return l10n.pairDeviceNameLabel;
              }
              return null;
            },
            onFieldSubmitted: (_) => _submit(),
          ),
          if (errorMessage != null) ...<Widget>[
            const SizedBox(height: 16),
            _ErrorBanner(message: errorMessage),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: pairState.submitting ? null : _submit,
            child: pairState.submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : Text(l10n.pairSubmit),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    final FormState? form = _formKey.currentState;
    if (form == null || !form.validate()) {
      return;
    }
    final String code = _codeController.text.trim().replaceAll('-', '');
    final String server = _serverController.text.trim();
    final String name = _nameController.text.trim();

    await ref.read(pairControllerProvider.notifier).submit(
          serverUrl: server,
          code: code,
          deviceName: name,
          altUrl: widget.initialAltUrl,
        );
  }

  String? _errorMessage(PairErrorKind? kind, AppL10n l10n) {
    if (kind == null) {
      return null;
    }
    switch (kind) {
      case PairErrorKind.invalidCode:
        return l10n.pairErrorInvalidCode;
      case PairErrorKind.tooManyAttempts:
        return l10n.pairErrorTooManyAttempts;
      case PairErrorKind.network:
        return l10n.pairErrorNetwork;
      case PairErrorKind.badServer:
        return l10n.pairErrorBadServer;
      case PairErrorKind.unknown:
        return l10n.pairErrorNetwork;
    }
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: scheme.errorContainer,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.error_outline, color: scheme.onErrorContainer),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: TextStyle(color: scheme.onErrorContainer),
            ),
          ),
        ],
      ),
    );
  }
}
