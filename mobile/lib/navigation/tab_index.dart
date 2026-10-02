// Single source of truth for bottom-tab ordering. The branch order in
// `app.dart`'s `StatefulShellRoute.indexedStack`, the destinations in
// `AppShell`'s navigation, and the invalidation mapping in `tab_refresh.dart`
// must all agree on these indices - keeping them as named constants (rather
// than repeating `0`, `1`, ... at each call site) is what makes that
// agreement checkable at a glance.
//
// R7.2: kid areas first. "Aufgaben" is fixed on slot 2, right after "Heute".
// Einkauf (Grocery) is an adult area and lives behind "Mehr" as a pushed route.
const int homeTabIndex = 0;
const int tasksTabIndex = 1;
const int calendarTabIndex = 2;
const int mealPlanTabIndex = 3;
const int moreTabIndex = 4;
