// Widget-level smoke test for the Tasks screen (`/tasks`) — renders the
// Ämtli segment with an assigned chore (member chip), an unassigned chore
// ("Alle" chip), and a completed chore ("Erledigt von …"), then switches to
// the To-dos segment. Provider overrides avoid any platform channel (secure
// storage, sqflite, network) so this runs under plain `flutter test`.

import 'package:familyboard_mobile/l10n/generated/app_localizations.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:familyboard_mobile/models/family_member.dart';
import 'package:familyboard_mobile/models/session.dart';
import 'package:familyboard_mobile/models/todo_item.dart';
import 'package:familyboard_mobile/services/chores_service.dart';
import 'package:familyboard_mobile/services/todos_service.dart';
import 'package:familyboard_mobile/state/chores_provider.dart';
import 'package:familyboard_mobile/state/members_provider.dart';
import 'package:familyboard_mobile/state/session_provider.dart';
import 'package:familyboard_mobile/state/todos_provider.dart';
import 'package:familyboard_mobile/state/write_queue_provider.dart';
import 'package:familyboard_mobile/features/tasks/tasks_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

const Session _fakeSession = Session(
  serverUrl: 'http://192.168.1.50:3000',
  token: 'fake-token',
  deviceId: 'device_1',
  member: Member(id: 'm1', name: 'Mia', color: 'sky', emoji: '🦊'),
  family: Family(id: 'f1', name: 'Müller'),
);

/// Skips [SessionNotifier.build]'s real side effects (secure storage read,
/// `WidgetsBinding` observer registration) — see `session_provider.dart`.
class _FakeSessionNotifier extends SessionNotifier {
  @override
  SessionState build() => const SessionState.signedIn(_fakeSession);
}

Future<void> _pumpTasksScreen(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(_FakeSessionNotifier.new),
        queueCountProvider.overrideWith((Ref ref) => Stream<int>.value(0)),
        membersProvider.overrideWith(
          (Ref ref) async => const MembersResult(
            members: <FamilyMember>[
              FamilyMember(
                id: 'm1',
                name: 'Mia',
                color: 'sky',
                emoji: '🦊',
                role: MemberRole.admin,
              ),
            ],
            me: CurrentMember(memberId: 'm1', role: MemberRole.admin),
          ),
        ),
        choresProvider.overrideWith(
          (Ref ref) async => const ChoresResult(
            chores: <Chore>[
              Chore(
                id: 'c1',
                title: 'Take out trash',
                icon: '🗑️',
                points: 3,
                rrule: null,
                memberId: 'm1',
                member: ChoreMember(
                  id: 'm1',
                  name: 'Mia',
                  color: 'sky',
                  emoji: '🦊',
                ),
                completedToday: false,
                completedTodayBy: null,
              ),
              Chore(
                id: 'c2',
                title: 'Water the plants',
                icon: '🌱',
                points: 1,
                rrule: null,
                memberId: null,
                member: null,
                completedToday: false,
                completedTodayBy: null,
              ),
              Chore(
                id: 'c3',
                title: 'Feed the cat',
                icon: '🐈',
                points: 2,
                rrule: null,
                memberId: 'm1',
                member: ChoreMember(
                  id: 'm1',
                  name: 'Mia',
                  color: 'sky',
                  emoji: '🦊',
                ),
                completedToday: true,
                completedTodayBy: ChoreMember(
                  id: 'm1',
                  name: 'Mia',
                  color: 'sky',
                  emoji: '🦊',
                ),
              ),
            ],
          ),
        ),
        todosProvider.overrideWith(
          (Ref ref) async => const TodosResult(
            todos: <TodoItem>[
              TodoItem(
                id: 't1',
                title: 'Buy milk',
                done: false,
                dueDate: null,
                member: TodoMember(
                  id: 'm1',
                  name: 'Mia',
                  color: 'sky',
                  emoji: '🦊',
                ),
              ),
            ],
          ),
        ),
      ],
      child: const MaterialApp(
        localizationsDelegates: AppL10n.localizationsDelegates,
        supportedLocales: AppL10n.supportedLocales,
        home: TasksScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('TasksScreen renders chores with member/unassigned chips', (
    WidgetTester tester,
  ) async {
    await _pumpTasksScreen(tester);

    expect(find.text('Take out trash'), findsOneWidget);
    expect(find.text('Water the plants'), findsOneWidget);
    expect(find.text('Feed the cat'), findsOneWidget);
    // Unassigned chore shows the neutral chip label.
    expect(find.text('Everyone'), findsOneWidget);
    // Completed chore shows who completed it.
    expect(find.text('Done by Mia'), findsOneWidget);
  });

  testWidgets('TasksScreen switches to the To-dos segment', (
    WidgetTester tester,
  ) async {
    await _pumpTasksScreen(tester);

    await tester.tap(find.text('To-dos'));
    await tester.pumpAndSettle();

    expect(find.text('Buy milk'), findsOneWidget);
  });
}
