import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../services/device_info.dart';
import '../../state/locale_provider.dart';
import '../../state/pair_controller.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/adaptive_layout.dart';
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
  String? _initialAltUrl;
  String? _initialRemoteUrl;

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
        title: const FamilyBoardLogo(fontSize: 18),
        actions: const <Widget>[_LanguageMenuButton()],
      ),
      body: SafeArea(
        child: ConstrainedContent(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: _buildBody(l10n),
          ),
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
        return _ScrollWithFooter(
          bodyBuilder: (BuildContext context, double availableHeight) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                l10n.pairTitle,
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 24),
              QrScannerView(
                maxSide: QrScannerView.sideForHeight(availableHeight),
                onScanned: _onScanned,
              ),
            ],
          ),
          footer: OutlinedButton.icon(
            icon: const Icon(Icons.edit_outlined),
            label: Text(l10n.pairManualButton),
            onPressed: () => setState(() => _mode = _PairMode.manual),
          ),
        );
      case _PairMode.manual:
        return SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                l10n.pairTitle,
                style: Theme.of(context).textTheme.displaySmall,
              ),
              const SizedBox(height: 8),
              Text(
                l10n.pairSubtitle,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: 24),
              ManualEntryView(
                initialServerUrl: _initialServerUrl,
                initialCode: _initialCode,
                initialDeviceName: defaultDeviceName(),
                initialAltUrl: _initialAltUrl,
                initialRemoteUrl: _initialRemoteUrl,
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

  void _onScanned(ScannedQrPayload payload) {
    if (payload is ScannedSetupPayload) {
      // App-first onboarding: the wall hasn't finished setup yet, so hand
      // off to the setup wizard instead of the normal manual-entry step.
      context.push('/setup-onboarding', extra: payload);
      return;
    }
    if (payload is ScannedPairPayload) {
      setState(() {
        _initialServerUrl = payload.serverUrl;
        _initialCode = payload.code;
        _initialAltUrl = payload.altUrl;
        _initialRemoteUrl = payload.remoteUrl;
        _mode = _PairMode.manual;
      });
    }
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
    return _ScrollWithFooter(
      bodyBuilder: (BuildContext context, double availableHeight) => Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const SizedBox(height: 16),
          Text(l10n.pairTitle, style: textTheme.displaySmall),
          const SizedBox(height: 12),
          Text(l10n.pairSubtitle, style: textTheme.bodyLarge),
        ],
      ),
      footer: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
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
      ),
    );
  }
}

/// A body with a footer pinned to the bottom when there is room, scrolling
/// as one column when there is not (phone landscape, long de/fr/it copy,
/// large text). Sizes itself from the space it gets, so no fixed reserves
/// for text that varies by locale. [bodyBuilder] receives the available
/// height for content that wants to scale to it.
class _ScrollWithFooter extends StatelessWidget {
  const _ScrollWithFooter({required this.bodyBuilder, required this.footer});

  final Widget Function(BuildContext context, double availableHeight)
  bodyBuilder;
  final Widget footer;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (BuildContext context, BoxConstraints constraints) {
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            // spaceBetween pins the footer down without Spacer / Expanded,
            // which would need a bounded height inside the scroll view.
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                bodyBuilder(context, constraints.maxHeight),
                Padding(padding: const EdgeInsets.only(top: 16), child: footer),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _LanguageMenuButton extends ConsumerWidget {
  const _LanguageMenuButton();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final LocalePrefState state = ref.watch(localePrefProvider);
    final String? current = state.locale?.languageCode;

    return PopupMenuButton<String?>(
      icon: const Icon(Icons.language),
      tooltip: l10n.pairLanguageTooltip,
      onSelected: (String? code) => ref
          .read(localePrefProvider.notifier)
          .setLocale(code == null ? null : Locale(code)),
      itemBuilder: (BuildContext ctx) => <PopupMenuEntry<String?>>[
        _item(null, l10n.languageSystem, current == null),
        _item('en', l10n.languageEnglish, current == 'en'),
        _item('de', l10n.languageGerman, current == 'de'),
        _item('fr', l10n.languageFrench, current == 'fr'),
        _item('it', l10n.languageItalian, current == 'it'),
      ],
    );
  }

  PopupMenuItem<String?> _item(String? code, String label, bool selected) {
    return PopupMenuItem<String?>(
      value: code,
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 24,
            child: selected ? const Icon(Icons.check, size: 18) : null,
          ),
          const SizedBox(width: 8),
          Text(label),
        ],
      ),
    );
  }
}
