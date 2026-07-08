import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/family_member.dart';
import '../../state/members_provider.dart';
import '../../theme.dart';
import 'member_edit_sheet.dart';

/// "Familienmitglieder" settings section: read-only list for non-admins,
/// full add/edit/delete for admins.
class MembersSection extends ConsumerWidget {
  const MembersSection({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<MembersResult> membersAsync = ref.watch(membersProvider);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: membersAsync.when(
          loading: () => const Center(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 24),
              child: CircularProgressIndicator(),
            ),
          ),
          error: (Object err, StackTrace _) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                l10n.membersErrorGeneric,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
              const SizedBox(height: 12),
              FilledButton(
                onPressed: () => ref.invalidate(membersProvider),
                child: Text(l10n.homeRetry),
              ),
            ],
          ),
          data: (MembersResult result) =>
              _MembersList(result: result, l10n: l10n),
        ),
      ),
    );
  }
}

class _MembersList extends StatelessWidget {
  const _MembersList({required this.result, required this.l10n});

  final MembersResult result;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final bool isAdmin = result.isAdmin;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        ...result.members.map(
          (FamilyMember member) => _MemberRow(
            member: member,
            isAdmin: isAdmin,
            l10n: l10n,
          ),
        ),
        if (isAdmin) ...<Widget>[
          const SizedBox(height: 8),
          if (result.members.length < 8)
            OutlinedButton.icon(
              icon: const Icon(Icons.person_add_alt_outlined),
              label: Text(l10n.membersAdd),
              onPressed: () => showMemberEditSheet(context),
            )
          else
            Text(
              l10n.membersErrorTooMany,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5),
                  ),
            ),
        ],
      ],
    );
  }
}

class _MemberRow extends StatelessWidget {
  const _MemberRow({
    required this.member,
    required this.isAdmin,
    required this.l10n,
  });

  final FamilyMember member;
  final bool isAdmin;
  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    final Color accent = AccentPalette.resolve(member.color);
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isAdmin
              ? () => showMemberEditSheet(context, member: member)
              : null,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            constraints: const BoxConstraints(minHeight: 56),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: accent.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
              border: Border(left: BorderSide(color: accent, width: 4)),
            ),
            child: Row(
              children: <Widget>[
                CircleAvatar(
                  radius: 18,
                  backgroundColor: accent.withValues(alpha: 0.3),
                  child:
                      Text(member.emoji, style: const TextStyle(fontSize: 18)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    member.name,
                    style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                ),
                if (member.role == MemberRole.admin) ...<Widget>[
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primaryContainer,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      l10n.membersRoleAdmin,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: Theme.of(context)
                                .colorScheme
                                .onPrimaryContainer,
                            fontWeight: FontWeight.w600,
                            fontSize: 12,
                          ),
                    ),
                  ),
                ],
                if (isAdmin) ...<Widget>[
                  const SizedBox(width: 4),
                  Icon(
                    Icons.chevron_right,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
