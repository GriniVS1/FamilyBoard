// Single source of truth for bottom-tab ordering. The branch order in
// `app.dart`'s `StatefulShellRoute.indexedStack`, the destinations in
// `AppShell`'s `NavigationBar`, and the invalidation mapping in
// `tab_refresh.dart` must all agree on these indices — keeping them as named
// constants (rather than repeating `0`, `1`, … at each call site) is what
// makes that agreement checkable at a glance.
const int homeTabIndex = 0;
const int calendarTabIndex = 1;
const int mealPlanTabIndex = 2;
const int groceryTabIndex = 3;
const int moreTabIndex = 4;
