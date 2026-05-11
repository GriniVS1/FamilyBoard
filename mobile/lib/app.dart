import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/home/home_screen.dart';
import 'features/pair/pair_screen.dart';
import 'features/splash/splash_screen.dart';
import 'l10n/generated/app_localizations.dart';
import 'state/session_provider.dart';
import 'theme.dart';

class FamilyBoardApp extends ConsumerWidget {
  const FamilyBoardApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final GoRouter router = ref.watch(_routerProvider);
    return MaterialApp.router(
      onGenerateTitle: (BuildContext ctx) => AppL10n.of(ctx).appTitle,
      theme: FamilyBoardTheme.light(),
      darkTheme: FamilyBoardTheme.dark(),
      themeMode: ThemeMode.system,
      localizationsDelegates: const <LocalizationsDelegate<Object>>[
        AppL10n.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppL10n.supportedLocales,
      routerConfig: router,
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

  final Ref _ref;
}

final Provider<GoRouter> _routerProvider = Provider<GoRouter>((Ref ref) {
  final _RouterRefresh refresh = _RouterRefresh(ref);
  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (BuildContext context, GoRouterState state) {
      final SessionState sessionState = ref.read(sessionProvider);
      final String location = state.matchedLocation;
      if (!sessionState.loaded) {
        return location == '/splash' ? null : '/splash';
      }
      if (sessionState.hasSession) {
        if (location == '/splash' || location == '/pair') {
          return '/home';
        }
        return null;
      }
      if (location == '/splash' || location == '/home') {
        return '/pair';
      }
      return null;
    },
    routes: <RouteBase>[
      GoRoute(
        path: '/splash',
        builder: (BuildContext context, GoRouterState state) =>
            const SplashScreen(),
      ),
      GoRoute(
        path: '/pair',
        builder: (BuildContext context, GoRouterState state) =>
            const PairScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (BuildContext context, GoRouterState state) =>
            const HomeScreen(),
      ),
    ],
  );
});
