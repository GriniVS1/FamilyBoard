import 'dart:io' show Platform;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../state/setup_onboarding_controller.dart';
import '../../theme.dart';
import 'setup_error_text.dart';

class StepWhoAreYouView extends ConsumerStatefulWidget {
  const StepWhoAreYouView({super.key});

  @override
  ConsumerState<StepWhoAreYouView> createState() => _StepWhoAreYouViewState();
}

class _StepWhoAreYouViewState extends ConsumerState<StepWhoAreYouView> {
  late final TextEditingController _deviceNameController;
  String? _selectedMemberId;

  @override
  void initState() {
    super.initState();
    _deviceNameController = TextEditingController(text: _defaultDeviceName());
  }

  @override
  void dispose() {
    _deviceNameController.dispose();
    super.dispose();
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

  Future<void> _finish() async {
    final String? memberId = _selectedMemberId;
    final String deviceName = _deviceNameController.text.trim();
    if (memberId == null || deviceName.isEmpty) {
      return;
    }
    await ref.read(setupOnboardingControllerProvider.notifier).completePairing(
          memberId: memberId,
          deviceName: deviceName,
        );
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);
    final List<FamilyMember> members = state.members;
    final bool canSubmit = _selectedMemberId != null &&
        _deviceNameController.text.trim().isNotEmpty;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.setupWhoAreYouTitle,
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(l10n.setupWhoAreYouDescription,
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          if (members.isEmpty)
            Text(
              l10n.setupWhoAreYouEmptyMembers,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            )
          else
            for (final FamilyMember member in members)
              _MemberOption(
                member: member,
                selected: member.id == _selectedMemberId,
                onTap: () => setState(() => _selectedMemberId = member.id),
              ),
          const SizedBox(height: 16),
          TextField(
            controller: _deviceNameController,
            textCapitalization: TextCapitalization.words,
            onChanged: (String _) => setState(() {}),
            decoration: InputDecoration(labelText: l10n.pairDeviceNameLabel),
          ),
          if (state.error != null) ...<Widget>[
            const SizedBox(height: 16),
            SetupErrorText(kind: state.error!),
          ],
          const SizedBox(height: 24),
          FilledButton(
            onPressed: (!canSubmit || state.submitting) ? null : _finish,
            child: state.submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2.5),
                  )
                : Text(l10n.setupStepFinish),
          ),
        ],
      ),
    );
  }
}

class _MemberOption extends StatelessWidget {
  const _MemberOption({
    required this.member,
    required this.selected,
    required this.onTap,
  });

  final FamilyMember member;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final ColorScheme scheme = Theme.of(context).colorScheme;
    final Color accent = AccentPalette.resolve(member.color);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: selected ? scheme.primaryContainer : scheme.surface,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.all(16),
            constraints: const BoxConstraints(minHeight: 52),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected ? scheme.primary : scheme.outline,
                width: selected ? 2 : 1,
              ),
            ),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  backgroundColor: accent,
                  child: Text(member.emoji.isNotEmpty ? member.emoji : '🙂'),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(member.name,
                      style: Theme.of(context).textTheme.bodyLarge),
                ),
                if (selected) Icon(Icons.check_circle, color: scheme.primary),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
