// Shared scaffolding for the kid-UI widget tests: a faked session, a mocked
// mutations service that records every request, a clock driven by the test
// binding's fake time and a MaterialApp with the undo toast host mounted the
// way AppShell does.

import 'dart:async';

import 'package:familyboard_mobile/kids/kid_chore_section.dart';
import 'package:familyboard_mobile/kids/picto.dart';
import 'package:familyboard_mobile/kids/undo_toast.dart';
import 'package:familyboard_mobile/l10n/generated/app_localizations.dart';
import 'package:familyboard_mobile/models/chore.dart';
import 'package:familyboard_mobile/models/family_member.dart';
import 'package:familyboard_mobile/models/mutations.dart';
import 'package:familyboard_mobile/models/session.dart';
import 'package:familyboard_mobile/services/chores_service.dart';
import 'package:familyboard_mobile/services/mutations_service.dart';
import 'package:familyboard_mobile/state/chore_actions.dart';
import 'package:familyboard_mobile/state/chores_provider.dart';
import 'package:familyboard_mobile/state/kid_clock_provider.dart';
import 'package:familyboard_mobile/state/members_provider.dart';
import 'package:familyboard_mobile/state/session_provider.dart';
import 'package:familyboard_mobile/state/write_queue_provider.dart';
import 'package:familyboard_mobile/kids/time_of_day.dart';
import 'package:familyboard_mobile/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

const Member kMia = Member(id: 'mia', name: 'Mia', color: 'lilac', emoji: '🦄');
const Session kSession = Session(
  serverUrl: 'http://192.168.1.50:3000',
  token: 'fake-token',
  deviceId: 'device_1',
  member: kMia,
  family: Family(id: 'f1', name: 'Muster'),
);

const ChoreMember kChoreMia = ChoreMember(
  id: 'mia',
  name: 'Mia',
  color: 'lilac',
  emoji: '🦄',
);
const ChoreMember kChoreLeo = ChoreMember(
  id: 'leo',
  name: 'Leo',
  color: 'teal',
  emoji: '🦖',
);

Chore chore(
  String id,
  String title,
  String? icon,
  ChoreTimeOfDay? tod, {
  ChoreMember? who = kChoreMia,
  int points = 1,
  bool done = false,
  ChoreMember? doneBy,
}) => Chore(
  id: id,
  title: title,
  icon: icon,
  points: points,
  rrule: null,
  memberId: who?.id,
  member: who,
  completedToday: done,
  completedTodayBy: done ? (doneBy ?? who) : null,
  timeOfDay: tod,
);

/// 14:30 is the DAY phase: Morgens is collapsed, Tagsüber and Jederzeit open.
List<Chore> sampleChores() => <Chore>[
  chore('a', 'Zähne putzen', '🪥', ChoreTimeOfDay.morning),
  chore('b', 'Bett machen', '🛏️', ChoreTimeOfDay.morning),
  chore('c', 'Hausaufgaben', '📚', ChoreTimeOfDay.day, points: 3),
  chore('d', 'Hände waschen', '🧼', ChoreTimeOfDay.day),
  chore('f', 'Musik üben', '🎵', ChoreTimeOfDay.day, points: 2),
  chore('e', 'Wasser trinken', '💧', null),
];

class FakeSessionNotifier extends SessionNotifier {
  @override
  SessionState build() => const SessionState.signedIn(kSession);
}

/// Mocked mutations service: records every request and mutates [Harness]'s
/// "server" so the refetch after the requests settle sees the truth.
class FakeMutations implements MutationsService {
  FakeMutations(this.harness);

  final Harness harness;
  final List<String> completed = <String>[];
  final List<String> undone = <String>[];
  Duration delay = Duration.zero;
  Object? failWith;
  Completer<void>? gate;

  @override
  Future<ChoreCompletionResult> completeChore({
    required Session session,
    required String id,
  }) async {
    completed.add(id);
    if (gate != null) {
      await gate!.future;
    }
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    final Object? error = failWith;
    if (error != null) {
      throw error;
    }
    harness.setDone(id, true);
    return ChoreCompletionResult(
      completionId: 'cc-$id',
      choreId: id,
      memberId: 'mia',
      points: 1,
      completedToday: true,
      alreadyCompletedToday: false,
    );
  }

  @override
  Future<bool> undoChoreCompletion({
    required Session session,
    required String id,
  }) async {
    undone.add(id);
    if (delay > Duration.zero) {
      await Future<void>.delayed(delay);
    }
    harness.setDone(id, false);
    return true;
  }

  final List<Map<String, Object?>> created = <Map<String, Object?>>[];

  @override
  Future<ChoreMutation> createChore({
    required Session session,
    required String title,
    String? memberId,
    String? icon,
    int points = 1,
    String? rrule,
  }) async {
    created.add(<String, Object?>{
      'title': title,
      'memberId': memberId,
      'icon': icon,
      'points': points,
    });
    return ChoreMutation(
      id: 'new',
      familyId: 'f1',
      memberId: memberId,
      title: title,
      icon: icon,
      points: points,
      rrule: rrule,
      createdAt: DateTime(2026, 10, 2),
    );
  }

  @override
  // ignore: no_such_method
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class Harness {
  Harness(this.tester, {List<Chore>? chores, this.admin = false})
    : server = chores ?? sampleChores() {
    mutations = FakeMutations(this);
    _fakeStart = tester.binding.clock.now();
  }

  final WidgetTester tester;
  final bool admin;
  List<Chore> server;
  late final FakeMutations mutations;
  late final DateTime _fakeStart;
  DateTime startOfDay = DateTime(2026, 10, 2, 14, 30);

  /// "Now" as the app sees it: starts at [startOfDay] and runs with the
  /// binding's fake time, so every `pump(duration)` moves it.
  DateTime now() =>
      startOfDay.add(tester.binding.clock.now().difference(_fakeStart));

  void setDone(String id, bool done) {
    server = <Chore>[
      for (final Chore c in server)
        if (c.id == id)
          Chore(
            id: c.id,
            title: c.title,
            icon: c.icon,
            points: c.points,
            rrule: c.rrule,
            memberId: c.memberId,
            member: c.member,
            completedToday: done,
            completedTodayBy: done ? kChoreMia : null,
            timeOfDay: c.timeOfDay,
          )
        else
          c,
    ];
  }

  List<Override> overrides({Future<ChoresResult> Function()? chores}) =>
      <Override>[
        sessionProvider.overrideWith(FakeSessionNotifier.new),
        kidClockProvider.overrideWithValue(now),
        queueCountProvider.overrideWith((Ref ref) => Stream<int>.value(0)),
        mutationsServiceProvider.overrideWithValue(mutations),
        membersProvider.overrideWith(
          (Ref ref) async => MembersResult(
            members: const <FamilyMember>[
              FamilyMember(
                id: 'mia',
                name: 'Mia',
                color: 'lilac',
                emoji: '🦄',
                role: MemberRole.member,
              ),
              FamilyMember(
                id: 'leo',
                name: 'Leo',
                color: 'teal',
                emoji: '🦖',
                role: MemberRole.member,
              ),
            ],
            me: CurrentMember(
              memberId: 'mia',
              role: admin ? MemberRole.admin : MemberRole.member,
            ),
          ),
        ),
        choresProvider.overrideWith(
          (Ref ref) => chores != null
              ? chores()
              : Future<ChoresResult>.value(ChoresResult(chores: server)),
        ),
      ];

  Widget app(
    Widget screen, {
    Locale locale = const Locale('de'),
    bool reduced = false,
    ThemeMode mode = ThemeMode.light,
    List<Override> extra = const <Override>[],
    Future<ChoresResult> Function()? load,
  }) {
    return ProviderScope(
      // Same as main.dart: a failed provider shows its error, no auto-retry.
      retry: (int retryCount, Object error) => null,
      overrides: <Override>[
        ...overrides(chores: load),
        ...extra,
      ],
      child: MaterialApp(
        theme: FamilyBoardTheme.light(),
        darkTheme: FamilyBoardTheme.dark(),
        themeMode: mode,
        locale: locale,
        localizationsDelegates: const <LocalizationsDelegate<Object>>[
          AppL10n.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppL10n.supportedLocales,
        builder: (BuildContext context, Widget? child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
          child: child!,
        ),
        home: Scaffold(
          body: Stack(
            children: <Widget>[
              Positioned.fill(child: screen),
              const Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: UndoToastHost(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// Mia's own board as a plain scrollable list.
  Widget miaBoard({List<Chore>? only}) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(16, 16, 16, kToastListPadding),
    child: Consumer(
      builder: (BuildContext context, WidgetRef ref, Widget? _) {
        final List<Chore> chores =
            (only ?? ref.watch(choresProvider).value?.chores ?? <Chore>[])
                .where((Chore c) => c.memberId == 'mia')
                .toList();
        return KidChoreSection(
          chores: chores,
          listKey: 'test',
          ownerId: 'mia',
          accentName: 'lilac',
        );
      },
    ),
  );

  ChoreActions get actions => ProviderScope.containerOf(
    tester.element(find.byType(MaterialApp)),
  ).read(choreActionsProvider.notifier);
}

/// Finder for a card by its visible title.
Finder cardTitle(String title) => find.text(title);

/// The ↶ picto of an open undo toast.
Finder undoPicto() =>
    find.byWidgetPredicate((Widget w) => w is KidPicto && w.name == 'undo');

/// Moves the fake time forward in frames of at most 100 ms so that timers,
/// animations and the harness clock stay in step.
Future<void> advance(WidgetTester tester, int ms) async {
  int left = ms;
  while (left > 0) {
    final int step = left > 100 ? 100 : left;
    await tester.pump(Duration(milliseconds: step));
    left -= step;
  }
}
