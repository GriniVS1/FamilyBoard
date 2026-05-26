import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/grocery.dart';
import '../../models/session.dart';
import '../../services/grocery_service.dart';
import '../../state/grocery_provider.dart';
import '../../state/session_provider.dart';
import '../../widgets/cached_at_pill.dart';
import '../../widgets/familyboard_logo.dart';
import '../../widgets/queue_badge.dart';

/// Display order for categories in the grouped list.
const List<GroceryCategory> _categoryOrder = <GroceryCategory>[
  GroceryCategory.uncategorized,
  GroceryCategory.produce,
  GroceryCategory.dairy,
  GroceryCategory.meat,
  GroceryCategory.bakery,
  GroceryCategory.pantry,
  GroceryCategory.frozen,
  GroceryCategory.drinks,
  GroceryCategory.other,
];

class GroceryScreen extends ConsumerStatefulWidget {
  const GroceryScreen({super.key});

  @override
  ConsumerState<GroceryScreen> createState() => _GroceryScreenState();
}

class _GroceryScreenState extends ConsumerState<GroceryScreen> {
  final TextEditingController _addController = TextEditingController();
  bool _addBusy = false;

  @override
  void dispose() {
    _addController.dispose();
    super.dispose();
  }

  // ---------------------------------------------------------------------------
  // Add item
  // ---------------------------------------------------------------------------

  Future<void> _submitNew() async {
    final String name = _addController.text.trim();
    if (name.isEmpty || _addBusy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    setState(() => _addBusy = true);
    try {
      await ref.read(groceryServiceProvider).create(session, name: name);
      if (!mounted) {
        return;
      }
      _addController.clear();
      ref.invalidate(groceryProvider);
    } on GrocerySessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on GroceryCapReachedException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).groceryErrorTooMany),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on GroceryFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).groceryErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) {
        setState(() => _addBusy = false);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Clear checked
  // ---------------------------------------------------------------------------

  Future<void> _clearChecked() async {
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    try {
      final int deleted =
          await ref.read(groceryServiceProvider).clearChecked(session);
      if (!mounted) {
        return;
      }
      ref.invalidate(groceryProvider);
      final AppL10n l10n = AppL10n.of(context);
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(l10n.groceryClearedToast(deleted)),
          behavior: SnackBarBehavior.floating,
        ),
      );
    } on GrocerySessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on GroceryFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).groceryErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final AsyncValue<GroceryResult> groceryAsync = ref.watch(groceryProvider);

    final bool hasChecked =
        groceryAsync.valueOrNull?.items.any((GroceryItem i) => i.checked) ??
            false;

    return Scaffold(
      appBar: AppBar(
        title: const FamilyBoardLogo(fontSize: 18),
        actions: <Widget>[
          const QueueBadge(),
          if (hasChecked)
            TextButton(
              onPressed: _clearChecked,
              child: Text(l10n.groceryClearChecked),
            ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _QuickAddRow(
              controller: _addController,
              busy: _addBusy,
              l10n: l10n,
              onSubmit: _submitNew,
            ),
            Expanded(
              child: groceryAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (Object err, StackTrace _) => _ErrorBody(
                  error: err,
                  l10n: l10n,
                  onRetry: () => ref.invalidate(groceryProvider),
                  onSessionExpired: () async {
                    await ref.read(sessionProvider.notifier).clear();
                  },
                ),
                data: (GroceryResult result) => _GroceryBody(
                  items: result.items,
                  staleAt: result.staleAt,
                  l10n: l10n,
                  onRefresh: () async {
                    ref.invalidate(groceryProvider);
                    try {
                      await ref.read(groceryProvider.future);
                    } catch (_) {}
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Quick-add row
// ---------------------------------------------------------------------------

class _QuickAddRow extends StatelessWidget {
  const _QuickAddRow({
    required this.controller,
    required this.busy,
    required this.l10n,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final bool busy;
  final AppL10n l10n;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: <Widget>[
          Expanded(
            child: TextField(
              controller: controller,
              enabled: !busy,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => onSubmit(),
              decoration: InputDecoration(
                hintText: l10n.groceryAddPlaceholder,
                isDense: true,
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            height: 52,
            width: 52,
            child: busy
                ? const Center(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  )
                : IconButton.filled(
                    icon: const Icon(Icons.add),
                    tooltip: l10n.groceryAddButton,
                    onPressed: onSubmit,
                  ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body — grouped list or empty state
// ---------------------------------------------------------------------------

class _GroceryBody extends StatelessWidget {
  const _GroceryBody({
    required this.items,
    required this.l10n,
    required this.onRefresh,
    this.staleAt,
  });

  final List<GroceryItem> items;
  final AppL10n l10n;
  final Future<void> Function() onRefresh;
  final DateTime? staleAt;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: <Widget>[
            if (staleAt != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: CachedAtPill(staleAt: staleAt),
              ),
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.4,
              child: _EmptyState(l10n: l10n),
            ),
          ],
        ),
      );
    }

    // Build groups: each category present in the items, in display order.
    final Map<GroceryCategory, List<GroceryItem>> grouped =
        <GroceryCategory, List<GroceryItem>>{};
    for (final GroceryItem item in items) {
      grouped.putIfAbsent(item.category, () => <GroceryItem>[]).add(item);
    }

    final List<GroceryCategory> presentCategories =
        _categoryOrder.where(grouped.containsKey).toList();

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(bottom: 24),
        itemCount:
            _countItems(presentCategories, grouped) + (staleAt != null ? 1 : 0),
        itemBuilder: (BuildContext context, int index) {
          if (staleAt != null && index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: CachedAtPill(staleAt: staleAt),
            );
          }
          final int adjustedIndex = staleAt != null ? index - 1 : index;
          return _buildItem(context, adjustedIndex, presentCategories, grouped);
        },
      ),
    );
  }

  /// Total list items = for each category: 1 header + N rows.
  int _countItems(
    List<GroceryCategory> categories,
    Map<GroceryCategory, List<GroceryItem>> grouped,
  ) {
    int count = 0;
    for (final GroceryCategory cat in categories) {
      count += 1 + (grouped[cat]?.length ?? 0);
    }
    return count;
  }

  Widget _buildItem(
    BuildContext context,
    int index,
    List<GroceryCategory> categories,
    Map<GroceryCategory, List<GroceryItem>> grouped,
  ) {
    int offset = 0;
    for (final GroceryCategory cat in categories) {
      final List<GroceryItem> rows = grouped[cat]!;
      // Sort: unchecked first, then checked.
      final List<GroceryItem> sorted = <GroceryItem>[
        ...rows.where((GroceryItem i) => !i.checked),
        ...rows.where((GroceryItem i) => i.checked),
      ];

      if (index == offset) {
        return _CategoryHeader(category: cat, l10n: l10n);
      }
      final int rowIndex = index - offset - 1;
      if (rowIndex < sorted.length) {
        return _GroceryRow(item: sorted[rowIndex], l10n: l10n);
      }
      offset += 1 + rows.length;
    }
    return const SizedBox.shrink();
  }
}

class _CategoryHeader extends StatelessWidget {
  const _CategoryHeader({required this.category, required this.l10n});

  final GroceryCategory category;
  final AppL10n l10n;

  String _label(AppL10n l10n) {
    switch (category) {
      case GroceryCategory.produce:
        return l10n.groceryCategoryProduce;
      case GroceryCategory.dairy:
        return l10n.groceryCategoryDairy;
      case GroceryCategory.pantry:
        return l10n.groceryCategoryPantry;
      case GroceryCategory.frozen:
        return l10n.groceryCategoryFrozen;
      case GroceryCategory.bakery:
        return l10n.groceryCategoryBakery;
      case GroceryCategory.meat:
        return l10n.groceryCategoryMeat;
      case GroceryCategory.drinks:
        return l10n.groceryCategoryDrinks;
      case GroceryCategory.other:
        return l10n.groceryCategoryOther;
      case GroceryCategory.uncategorized:
        return l10n.groceryCategoryUncategorized;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Text(
        _label(l10n).toUpperCase(),
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.5),
              fontWeight: FontWeight.w700,
              fontSize: 11,
              letterSpacing: 0.8,
            ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Grocery row — toggle + long-press delete
// ---------------------------------------------------------------------------

class _GroceryRow extends ConsumerStatefulWidget {
  const _GroceryRow({required this.item, required this.l10n});

  final GroceryItem item;
  final AppL10n l10n;

  @override
  ConsumerState<_GroceryRow> createState() => _GroceryRowState();
}

class _GroceryRowState extends ConsumerState<_GroceryRow> {
  bool _busy = false;
  bool _optimisticChecked = false;
  bool _optimisticOverride = false;

  bool get _isChecked =>
      _optimisticOverride ? _optimisticChecked : widget.item.checked;

  Future<void> _toggle() async {
    if (_busy) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    final bool newChecked = !_isChecked;
    setState(() {
      _busy = true;
      _optimisticChecked = newChecked;
      _optimisticOverride = true;
    });
    try {
      await ref.read(groceryServiceProvider).patch(
            session,
            id: widget.item.id,
            checked: newChecked,
          );
      if (!mounted) {
        return;
      }
      ref.invalidate(groceryProvider);
    } on GrocerySessionRevokedException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticOverride = false;
        _busy = false;
      });
      await ref.read(sessionProvider.notifier).clear();
    } on GroceryNotFoundException {
      if (!mounted) {
        return;
      }
      // Silently drop — item was removed elsewhere.
      ref.invalidate(groceryProvider);
    } on GroceryFetchException {
      if (!mounted) {
        return;
      }
      setState(() {
        _optimisticChecked = !newChecked;
        _optimisticOverride = true;
        _busy = false;
      });
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.groceryErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _delete() async {
    final AppL10n l10n = widget.l10n;
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          content: Text(l10n.groceryDeleteConfirm),
          actions: <Widget>[
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(false),
              child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
            ),
            FilledButton(
              onPressed: () => Navigator.of(ctx).pop(true),
              child: Text(MaterialLocalizations.of(ctx).deleteButtonTooltip),
            ),
          ],
        );
      },
    );
    if (confirmed != true || !mounted) {
      return;
    }
    final SessionState sessionState = ref.read(sessionProvider);
    final Session? session = sessionState.session;
    if (session == null) {
      return;
    }
    try {
      await ref
          .read(groceryServiceProvider)
          .delete(session, id: widget.item.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(groceryProvider);
    } on GrocerySessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on GroceryNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(groceryProvider);
    } on GroceryFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(widget.l10n.groceryErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool checked = _isChecked;
    final Color mutedColor =
        Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
      child: InkWell(
        onTap: _busy ? null : _toggle,
        onLongPress: _busy ? null : _delete,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          constraints: const BoxConstraints(minHeight: 52),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline,
            ),
          ),
          child: Row(
            children: <Widget>[
              GestureDetector(
                onTap: _busy ? null : _toggle,
                behavior: HitTestBehavior.opaque,
                child: Padding(
                  padding: const EdgeInsets.only(right: 12),
                  child: SizedBox(
                    width: 32,
                    height: 32,
                    child: _busy
                        ? const Center(
                            child: SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            ),
                          )
                        : Icon(
                            checked
                                ? Icons.check_circle_rounded
                                : Icons.radio_button_unchecked_rounded,
                            color: checked
                                ? mutedColor
                                : Theme.of(context).colorScheme.primary,
                            size: 24,
                          ),
                  ),
                ),
              ),
              Expanded(
                child: Text(
                  widget.item.displayLabel,
                  style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                        color: checked ? mutedColor : null,
                        decoration: checked ? TextDecoration.lineThrough : null,
                        decorationColor: mutedColor,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.l10n});

  final AppL10n l10n;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.shopping_cart_outlined,
              size: 64,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.2),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.groceryEmpty,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.5),
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              l10n.groceryEmptySubtitle,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.4),
                  ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({
    required this.error,
    required this.l10n,
    required this.onRetry,
    required this.onSessionExpired,
  });

  final Object error;
  final AppL10n l10n;
  final VoidCallback onRetry;
  final VoidCallback onSessionExpired;

  @override
  Widget build(BuildContext context) {
    final bool isSessionError = error is GrocerySessionRevokedException;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isSessionError ? l10n.homeSessionExpired : l10n.homeLoadError,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context).colorScheme.error,
                  ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: isSessionError ? onSessionExpired : onRetry,
              child: Text(l10n.homeRetry),
            ),
          ],
        ),
      ),
    );
  }
}
