import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../state/pair_controller.dart';
import 'manual_entry_view.dart';
import 'qr_scanner_view.dart';

enum _PairMode { chooser, scanner, manual }

class PairScreen extends ConsumerStatefulWidget {
  const PairScreen({super.key});

  @override
  ConsumerState<PairScreen> createState() => _PairScreenState();
}

class _PairScreenState extends ConsumerState<PairScreen> {
  _PairMode _mode = _PairMode.chooser;
  String _initialServerUrl = '';
  String _initialCode = '';

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Scaffold(
      appBar: AppBar(
        leading: _mode == _PairMode.chooser
            ? null
            : IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: _goBackToChooser,
              ),
        title: Text(l10n.appTitle),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: _buildBody(l10n),
        ),
      ),
    );
  }

  Widget _buildBody(AppL10n l10n) {
    switch (_mode) {
      case _PairMode.chooser:
        return _Chooser(
          l10n: l10n,
          onScan: () => setState(() => _mode = _PairMode.scanner),
          onManual: () => setState(() => _mode = _PairMode.manual),
        );
      case _PairMode.scanner:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(l10n.pairTitle,
                style: Theme.of(context).textTheme.displaySmall),
            const SizedBox(height: 24),
            QrScannerView(onScanned: _onScanned),
            const Spacer(),
            OutlinedButton.icon(
              icon: const Icon(Icons.edit_outlined),
              label: Text(l10n.pairManualButton),
              onPressed: () => setState(() => _mode = _PairMode.manual),
            ),
          ],
        );
      case _PairMode.manual:
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(l10n.pairTitle,
                  style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(
                l10n.pairSubtitle,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              ManualEntryView(
                initialServerUrl: _initialServerUrl,
                initialCode: _initialCode,
                initialDeviceName: _defaultDeviceName(),
              ),
            ],
          ),
        );
    }
  }

  void _goBackToChooser() {
    ref.read(pairControllerProvider.notifier).reset();
    setState(() {
      _mode = _PairMode.chooser;
    });
  }

  void _onScanned(ScannedPairPayload payload) {
    setState(() {
      _initialServerUrl = payload.serverUrl;
      _initialCode = payload.code;
      _mode = _PairMode.manual;
    });
  }

  String _defaultDeviceName() {
    if (Platform.isIOS) {
      return 'iPhone';
    }
    if (Platform.isAndroid) {
      return 'Android phone';
    }
    return 'Phone';
  }
}

class _Chooser extends StatelessWidget {
  const _Chooser({
    required this.l10n,
    required this.onScan,
    required this.onManual,
  });

  final AppL10n l10n;
  final VoidCallback onScan;
  final VoidCallback onManual;

  @override
  Widget build(BuildContext context) {
    final TextTheme textTheme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        const SizedBox(height: 16),
        Text(l10n.pairTitle, style: textTheme.displaySmall),
        const SizedBox(height: 12),
        Text(l10n.pairSubtitle, style: textTheme.bodyLarge),
        const Spacer(),
        FilledButton.icon(
          icon: const Icon(Icons.qr_code_scanner),
          label: Text(l10n.pairScanButton),
          onPressed: onScan,
        ),
        const SizedBox(height: 12),
        OutlinedButton.icon(
          icon: const Icon(Icons.keyboard_alt_outlined),
          label: Text(l10n.pairManualButton),
          onPressed: onManual,
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}
