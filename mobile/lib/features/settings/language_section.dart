import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../state/locale_provider.dart';

/// "Sprache" settings section — lets the user pin the app to a specific
/// locale instead of following the OS, applied immediately.
class LanguageSection extends ConsumerWidget {
  const LanguageSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final LocalePrefState state = ref.watch(localePrefProvider);

    final List<_LanguageOption> options = <_LanguageOption>[
      _LanguageOption(languageCode: null, label: l10n.languageSystem),
      _LanguageOption(languageCode: 'en', label: l10n.languageEnglish),
      _LanguageOption(languageCode: 'de', label: l10n.languageGerman),
      _LanguageOption(languageCode: 'fr', label: l10n.languageFrench),
      _LanguageOption(languageCode: 'it', label: l10n.languageItalian),
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            for (final _LanguageOption option in options)
              _LanguageTile(
                option: option,
                selected: state.locale?.languageCode == option.languageCode,
                onTap: () => ref.read(localePrefProvider.notifier).setLocale(
                      option.languageCode == null
                          ? null
                          : Locale(option.languageCode!),
                    ),
              ),
          ],
        ),
      ),
    );
  }
}

class _LanguageOption {
  const _LanguageOption({required this.languageCode, required this.label});

  final String? languageCode;
  final String label;
}

class _LanguageTile extends StatelessWidget {
  const _LanguageTile({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _LanguageOption option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  option.label,
                  style: Theme.of(context).textTheme.bodyLarge,
                ),
              ),
              if (selected)
                Icon(Icons.check, color: Theme.of(context).colorScheme.primary),
            ],
          ),
        ),
      ),
    );
  }
}
