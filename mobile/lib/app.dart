import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/calendar/calendar_screen.dart';
import 'features/grocery/grocery_screen.dart';
import 'features/home/home_screen.dart';
import 'features/meal_plan/meal_plan_screen.dart';
import 'features/more/more_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/pair/pair_screen.dart';
import 'features/pair/qr_scanner_view.dart';
import 'features/photos/photos_screen.dart';
import 'features/settings/settings_screen.dart';
import 'features/setup_onboarding/setup_onboarding_screen.dart';
import 'features/splash/splash_screen.dart';
import 'l10n/generated/app_localizations.dart';
import 'models/notification_payload.dart';
import 'navigation/app_shell.dart';
import 'services/fcm_service.dart';
import 'services/write_queue_service.dart';
import 'state/locale_provider.dart';
import 'state/session_provider.dart';
import 'state/write_queue_provider.dart';
import 'theme.dart';
import 'widgets/connectivity_banner.dart';

/// Root navigator — hosts the bottom-tab shell itself plus every route that
/// should push *over* it (Notes, Photos, Settings, pairing, splash). The
/// shell's own branches get their own nested navigators (declared per
/// `StatefulShellBranch` below) so in-branch pushes (event detail sheets,
/// etc.) stay scoped to that branch.
final GlobalKey<NavigatorState> _rootNavigatorKey = GlobalKey<NavigatorState>(
  debugLabel: 'root',
);

/// Global messenger key so foreground FCM callbacks can show snackbars
/// from outside the widget tree.
final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
    GlobalKey<ScaffoldMessengerState>();

class FamilyBoardApp extends ConsumerStatefulWidget {
  const FamilyBoardApp({super.key});

  @override
  ConsumerState<FamilyBoardApp> createState() => _FamilyBoardAppState();
}

class _FamilyBoardAppState extends ConsumerState<FamilyBoardApp> {
  late final GoRouter _router;
  StreamSubscription<ReplayFailure>? _replayFailureSub;

  @override
  void initState() {
    super.initState();
    _router = _buildRouter();
    _bootstrapFcmListeners();
    // Keep the replay coordinator alive for the full app lifetime.
    ref.read(queueReplayCoordinatorProvider);
    // Surface permanent 4xx replay failures as snackbars.
    _replayFailureSub = ref
        .read(writeQueueServiceProvider)
        .replayFailures
        .listen(_onReplayFailure);
  }

  @override
  void dispose() {
    _replayFailureSub?.cancel();
    super.dispose();
  }

  void _onReplayFailure(ReplayFailure failure) {
    final BuildContext? ctx = scaffoldMessengerKey.currentContext;
    final String message = ctx != null
        ? AppL10n.of(ctx).syncFailed(failure.message)
        : 'Couldn\'t sync: ${failure.message}';
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(content: Text(message), behavior: SnackBarBehavior.floating),
    );
  }

  GoRouter _buildRouter() {
    final _RouterRefresh refresh = _RouterRefresh(ref);
    return GoRouter(
      navigatorKey: _rootNavigatorKey,
      initialLocation: '/splash',
      refreshListenable: refresh,
      redirect: (BuildContext context, GoRouterState routerState) {
        final SessionState sessionState = ref.read(sessionProvider);
        final String location = routerState.matchedLocation;
        if (!sessionState.loaded) {
          return location == '/splash' ? null : '/splash';
        }
        if (sessionState.hasSession) {
          if (location == '/splash' ||
              location == '/pair' ||
              location == '/setup-onboarding') {
            return '/home';
          }
          return null;
        }
        if (location == '/splash' ||
            location == '/home' ||
            location == '/calendar' ||
            location == '/notes' ||
            location == '/grocery' ||
            location == '/meal-plan' ||
            location == '/photos' ||
            location == '/settings' ||
            location == '/more') {
          return '/pair';
        }
        return null;
      },
      routes: <RouteBase>[
        GoRoute(
          path: '/splash',
          builder: (BuildContext context, GoRouterState routerState) =>
              const SplashScreen(),
        ),
        GoRoute(
          path: '/pair',
          builder: (BuildContext context, GoRouterState routerState) =>
              const PairScreen(),
        ),
        GoRoute(
          path: '/setup-onboarding',
          // Only reachable by pushing with a scanned setup QR as `extra` —
          // bounce back to normal pairing if that's missing (hot restart,
          // deep link, anything that skipped the scanner).
          redirect: (BuildContext context, GoRouterState routerState) {
            return routerState.extra is ScannedSetupPayload ? null : '/pair';
          },
          builder: (BuildContext context, GoRouterState routerState) =>
              SetupOnboardingScreen(
                payload: routerState.extra! as ScannedSetupPayload,
              ),
        ),
        // Full-screen flows that must cover the bottom-tab bar. These are
        // deliberately siblings of the shell route below (not nested inside
        // any branch), so GoRouter pushes them on the root navigator —
        // exactly like /pair and /splash above.
        GoRoute(
          path: '/notes',
          builder: (BuildContext context, GoRouterState routerState) =>
              const NotesScreen(),
        ),
        GoRoute(
          path: '/photos',
          builder: (BuildContext context, GoRouterState routerState) =>
              const PhotosScreen(),
        ),
        GoRoute(
          path: '/settings',
          builder: (BuildContext context, GoRouterState routerState) =>
              const SettingsScreen(),
        ),
        StatefulShellRoute.indexedStack(
          builder:
              (
                BuildContext context,
                GoRouterState routerState,
                StatefulNavigationShell navigationShell,
              ) => AppShell(navigationShell: navigationShell),
          branches: <StatefulShellBranch>[
            StatefulShellBranch(
              routes: <RouteBase>[
                GoRoute(
                  path: '/home',
                  builder: (BuildContext context, GoRouterState routerState) =>
                      const HomeScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: <RouteBase>[
                GoRoute(
                  path: '/calendar',
                  builder: (BuildContext context, GoRouterState routerState) =>
                      const CalendarScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: <RouteBase>[
                GoRoute(
                  path: '/meal-plan',
                  builder: (BuildContext context, GoRouterState routerState) =>
                      const MealPlanScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: <RouteBase>[
                GoRoute(
                  path: '/grocery',
                  builder: (BuildContext context, GoRouterState routerState) =>
                      const GroceryScreen(),
                ),
              ],
            ),
            StatefulShellBranch(
              routes: <RouteBase>[
                GoRoute(
                  path: '/more',
                  builder: (BuildContext context, GoRouterState routerState) =>
                      const MoreScreen(),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  void _bootstrapFcmListeners() {
    final FcmService fcm = ref.read(fcmServiceProvider);

    // Cold-start: app was terminated and user tapped a notification.
    unawaited(
      fcm.getInitialMessage().then((NotificationPayload? payload) {
        if (payload != null) {
          _navigateFromPayload(payload);
        }
      }),
    );

    // Warm-start: app was in background and user tapped the notification.
    fcm.subscribeToOpenedMessages(_navigateFromPayload);

    // Foreground: FCM won't display a system notification, so show a snackbar.
    fcm.subscribeToForegroundMessages((NotificationPayload payload) {
      final String text = payload.title.isNotEmpty
          ? '${payload.title}: ${payload.body}'
          : payload.body;
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(text),
          behavior: SnackBarBehavior.floating,
          action: SnackBarAction(
            label: 'Open',
            onPressed: () => _navigateFromPayload(payload),
          ),
        ),
      );
    });
  }

  /// Routes the app to the path carried in [payload.url].
  ///
  /// Recognised paths: /home, /calendar. Anything else falls back to /home.
  void _navigateFromPayload(NotificationPayload payload) {
    const Set<String> knownRoutes = <String>{'/home', '/calendar'};
    final String target = knownRoutes.contains(payload.url)
        ? payload.url
        : '/home';
    _router.go(target);
  }

  @override
  Widget build(BuildContext context) {
    final LocalePrefState localePrefState = ref.watch(localePrefProvider);
    return MaterialApp.router(
      onGenerateTitle: (BuildContext ctx) => AppL10n.of(ctx).appTitle,
      theme: FamilyBoardTheme.light(),
      darkTheme: FamilyBoardTheme.dark(),
      themeMode: ThemeMode.system,
      locale: localePrefState.locale,
      scaffoldMessengerKey: scaffoldMessengerKey,
      localizationsDelegates: const <LocalizationsDelegate<Object>>[
        AppL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppL10n.supportedLocales,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
      // Mount the connectivity banner above the router outlet on every screen.
      builder: (BuildContext ctx, Widget? child) => Column(
        children: <Widget>[
          const ConnectivityBanner(),
          Expanded(child: child ?? const SizedBox.shrink()),
        ],
      ),
    );
  }
}

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(WidgetRef ref) {
    _subscription = ref.listenManual<SessionState>(sessionProvider, (
      SessionState? previous,
      SessionState next,
    ) {
      notifyListeners();
    });
  }

  late final ProviderSubscription<SessionState> _subscription;

  @override
  void dispose() {
    _subscription.close();
    super.dispose();
  }
}
