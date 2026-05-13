import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/calendar/calendar_screen.dart';
import 'features/grocery/grocery_screen.dart';
import 'features/home/home_screen.dart';
import 'features/meal_plan/meal_plan_screen.dart';
import 'features/notes/notes_screen.dart';
import 'features/pair/pair_screen.dart';
import 'features/splash/splash_screen.dart';
import 'l10n/generated/app_localizations.dart';
import 'models/notification_payload.dart';
import 'services/fcm_service.dart';
import 'state/session_provider.dart';
import 'theme.dart';

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

  @override
  void initState() {
    super.initState();
    _router = _buildRouter();
    _bootstrapFcmListeners();
  }

  GoRouter _buildRouter() {
    final _RouterRefresh refresh = _RouterRefresh(ref);
    return GoRouter(
      initialLocation: '/splash',
      refreshListenable: refresh,
      redirect: (BuildContext context, GoRouterState routerState) {
        final SessionState sessionState = ref.read(sessionProvider);
        final String location = routerState.matchedLocation;
        if (!sessionState.loaded) {
          return location == '/splash' ? null : '/splash';
        }
        if (sessionState.hasSession) {
          if (location == '/splash' || location == '/pair') {
            return '/home';
          }
          return null;
        }
        if (location == '/splash' ||
            location == '/home' ||
            location == '/calendar' ||
            location == '/notes' ||
            location == '/grocery' ||
            location == '/meal-plan') {
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
          path: '/home',
          builder: (BuildContext context, GoRouterState routerState) =>
              const HomeScreen(),
        ),
        GoRoute(
          path: '/calendar',
          builder: (BuildContext context, GoRouterState routerState) =>
              const CalendarScreen(),
        ),
        GoRoute(
          path: '/notes',
          builder: (BuildContext context, GoRouterState routerState) =>
              const NotesScreen(),
        ),
        GoRoute(
          path: '/grocery',
          builder: (BuildContext context, GoRouterState routerState) =>
              const GroceryScreen(),
        ),
        GoRoute(
          path: '/meal-plan',
          builder: (BuildContext context, GoRouterState routerState) =>
              const MealPlanScreen(),
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
    final String target =
        knownRoutes.contains(payload.url) ? payload.url : '/home';
    _router.go(target);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      onGenerateTitle: (BuildContext ctx) => AppL10n.of(ctx).appTitle,
      theme: FamilyBoardTheme.light(),
      darkTheme: FamilyBoardTheme.dark(),
      themeMode: ThemeMode.system,
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
    );
  }
}

class _RouterRefresh extends ChangeNotifier {
  _RouterRefresh(this._ref) {
    _ref.listen<SessionState>(
      sessionProvider,
      (SessionState? previous, SessionState next) {
        notifyListeners();
      },
    );
  }

  final WidgetRef _ref;
}
