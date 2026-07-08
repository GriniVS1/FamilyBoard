import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../app.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/photo.dart';
import '../../models/session.dart';
import '../../services/photos_service.dart';
import '../../state/photos_provider.dart';
import '../../state/session_provider.dart';
import '../../widgets/familyboard_logo.dart';

/// Re-encodes HEIC/large gallery photos down to a JPEG under the wall's 8 MiB
/// cap before they ever reach [PhotosService.uploadPhoto].
const double _pickerMaxDimension = 2560;
const int _pickerQuality = 85;

class PhotosScreen extends ConsumerStatefulWidget {
  const PhotosScreen({super.key});

  @override
  ConsumerState<PhotosScreen> createState() => _PhotosScreenState();
}

class _PhotosScreenState extends ConsumerState<PhotosScreen> {
  final List<Photo> _optimisticUploaded = <Photo>[];
  bool _uploading = false;
  int _uploadCurrent = 0;
  int _uploadTotal = 0;
  double _currentFileProgress = 0;

  Future<void> _pickAndUpload() async {
    final Session? session = ref.read(sessionProvider).session;
    if (session == null || _uploading) {
      return;
    }
    final ImagePicker picker = ImagePicker();
    final List<XFile> picked = await picker.pickMultiImage(
      maxWidth: _pickerMaxDimension,
      maxHeight: _pickerMaxDimension,
      imageQuality: _pickerQuality,
    );
    if (picked.isEmpty || !mounted) {
      return;
    }

    setState(() {
      _uploading = true;
      _uploadCurrent = 0;
      _uploadTotal = picked.length;
      _currentFileProgress = 0;
    });

    int tooLarge = 0;
    int unsupported = 0;
    int generic = 0;
    bool sessionRevoked = false;

    for (final XFile file in picked) {
      if (sessionRevoked) {
        break;
      }
      setState(() {
        _uploadCurrent += 1;
        _currentFileProgress = 0;
      });
      try {
        final Photo photo = await ref.read(photosServiceProvider).uploadPhoto(
              session: session,
              filePath: file.path,
              onSendProgress: (int sent, int total) {
                if (!mounted || total <= 0) {
                  return;
                }
                setState(() => _currentFileProgress = sent / total);
              },
            );
        if (!mounted) {
          return;
        }
        setState(() => _optimisticUploaded.add(photo));
      } on PhotosSessionRevokedException {
        sessionRevoked = true;
      } on PhotosTooLargeException {
        tooLarge += 1;
      } on PhotosUnsupportedTypeException {
        unsupported += 1;
      } on PhotosFetchException {
        generic += 1;
      }
    }

    if (!mounted) {
      return;
    }
    setState(() => _uploading = false);

    if (sessionRevoked) {
      await ref.read(sessionProvider.notifier).clear();
      return;
    }

    ref.invalidate(photosProvider);
    _optimisticUploaded.clear();
    _reportFailures(
        tooLarge: tooLarge, unsupported: unsupported, generic: generic);
  }

  void _reportFailures({
    required int tooLarge,
    required int unsupported,
    required int generic,
  }) {
    if (tooLarge == 0 && unsupported == 0 && generic == 0) {
      return;
    }
    final AppL10n l10n = AppL10n.of(context);
    final List<String> parts = <String>[
      if (tooLarge > 0) l10n.photosUploadTooLargeToast(tooLarge),
      if (unsupported > 0) l10n.photosUploadUnsupportedToast(unsupported),
      if (generic > 0) l10n.photosUploadGenericToast(generic),
    ];
    scaffoldMessengerKey.currentState?.showSnackBar(
      SnackBar(
        content: Text(parts.join(' ')),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _confirmDelete(Photo photo) async {
    final AppL10n l10n = AppL10n.of(context);
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) {
        return AlertDialog(
          content: Text(l10n.photosDeleteConfirm),
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
    final Session? session = ref.read(sessionProvider).session;
    if (session == null) {
      return;
    }
    try {
      await ref
          .read(photosServiceProvider)
          .deletePhoto(session: session, id: photo.id);
      if (!mounted) {
        return;
      }
      ref.invalidate(photosProvider);
    } on PhotosSessionRevokedException {
      if (!mounted) {
        return;
      }
      await ref.read(sessionProvider.notifier).clear();
    } on PhotosNotFoundException {
      if (!mounted) {
        return;
      }
      ref.invalidate(photosProvider);
    } on PhotosFetchException {
      if (!mounted) {
        return;
      }
      scaffoldMessengerKey.currentState?.showSnackBar(
        SnackBar(
          content: Text(AppL10n.of(context).photosDeleteErrorGeneric),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final Session? session = ref.watch(sessionProvider).session;
    final AsyncValue<List<Photo>> photosAsync = ref.watch(photosProvider);

    return Scaffold(
      appBar: AppBar(title: const FamilyBoardLogo(fontSize: 18)),
      floatingActionButton: FloatingActionButton(
        tooltip: l10n.photosUploadTooltip,
        onPressed: _uploading ? null : _pickAndUpload,
        child: const Icon(Icons.add_photo_alternate_outlined),
      ),
      body: SafeArea(
        child: session == null
            ? const SizedBox.shrink()
            : Column(
                children: <Widget>[
                  if (_uploading)
                    _UploadProgressBanner(
                      l10n: l10n,
                      current: _uploadCurrent,
                      total: _uploadTotal,
                      fileProgress: _currentFileProgress,
                    ),
                  Expanded(
                    child: photosAsync.when(
                      loading: () =>
                          const Center(child: CircularProgressIndicator()),
                      error: (Object err, StackTrace _) => _ErrorBody(
                        error: err,
                        l10n: l10n,
                        onRetry: () => ref.invalidate(photosProvider),
                        onSessionExpired: () async {
                          await ref.read(sessionProvider.notifier).clear();
                        },
                      ),
                      data: (List<Photo> photos) {
                        final List<Photo> merged = <Photo>[
                          ...photos,
                          ..._optimisticUploaded.where((Photo p) =>
                              !photos.any((Photo q) => q.id == p.id)),
                        ];
                        return _PhotosBody(
                          photos: merged,
                          session: session,
                          l10n: l10n,
                          onRefresh: () async {
                            ref.invalidate(photosProvider);
                            try {
                              await ref.read(photosProvider.future);
                            } catch (_) {}
                          },
                          onDelete: _confirmDelete,
                        );
                      },
                    ),
                  ),
                ],
              ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Upload progress banner
// ---------------------------------------------------------------------------

class _UploadProgressBanner extends StatelessWidget {
  const _UploadProgressBanner({
    required this.l10n,
    required this.current,
    required this.total,
    required this.fileProgress,
  });

  final AppL10n l10n;
  final int current;
  final int total;
  final double fileProgress;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.photosUploadingProgress(current, total),
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 6),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: fileProgress > 0 ? fileProgress : null,
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Body — grid or empty state
// ---------------------------------------------------------------------------

class _PhotosBody extends StatelessWidget {
  const _PhotosBody({
    required this.photos,
    required this.session,
    required this.l10n,
    required this.onRefresh,
    required this.onDelete,
  });

  final List<Photo> photos;
  final Session session;
  final AppL10n l10n;
  final Future<void> Function() onRefresh;
  final void Function(Photo photo) onDelete;

  @override
  Widget build(BuildContext context) {
    if (photos.isEmpty) {
      return RefreshIndicator(
        onRefresh: onRefresh,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: <Widget>[
            SizedBox(
              height: MediaQuery.of(context).size.height * 0.6,
              child: _EmptyState(l10n: l10n),
            ),
          ],
        ),
      );
    }

    final int crossAxisCount = MediaQuery.of(context).size.width >= 600 ? 3 : 2;

    return RefreshIndicator(
      onRefresh: onRefresh,
      child: GridView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(16),
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: crossAxisCount,
          crossAxisSpacing: 12,
          mainAxisSpacing: 12,
          childAspectRatio: 1,
        ),
        itemCount: photos.length,
        itemBuilder: (BuildContext context, int index) {
          final Photo photo = photos[index];
          return _PhotoTile(
            photo: photo,
            session: session,
            l10n: l10n,
            onDelete: () => onDelete(photo),
          );
        },
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Photo tile
// ---------------------------------------------------------------------------

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    required this.photo,
    required this.session,
    required this.l10n,
    required this.onDelete,
  });

  final Photo photo;
  final Session session;
  final AppL10n l10n;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final String url = '${session.effectiveUrl}${photo.path}';
    return ClipRRect(
      borderRadius: BorderRadius.circular(20),
      child: GestureDetector(
        onLongPress: onDelete,
        child: Stack(
          fit: StackFit.expand,
          children: <Widget>[
            Container(color: Theme.of(context).colorScheme.surface),
            Image.network(
              url,
              fit: BoxFit.cover,
              loadingBuilder:
                  (BuildContext ctx, Widget child, ImageChunkEvent? progress) {
                if (progress == null) {
                  return child;
                }
                return const Center(
                  child: SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                );
              },
              errorBuilder: (BuildContext ctx, Object error, StackTrace? st) {
                return Center(
                  child: Tooltip(
                    message: l10n.photosImageLoadError,
                    child: Icon(
                      Icons.broken_image_outlined,
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.3),
                    ),
                  ),
                );
              },
            ),
            Positioned(
              top: 4,
              right: 4,
              child: Material(
                color: Colors.black.withValues(alpha: 0.35),
                shape: const CircleBorder(),
                child: IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.white),
                  iconSize: 20,
                  tooltip: l10n.photosDeleteTooltip,
                  onPressed: onDelete,
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
              Icons.photo_library_outlined,
              size: 64,
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.2),
            ),
            const SizedBox(height: 16),
            Text(
              l10n.photosEmpty,
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
              l10n.photosEmptySubtitle,
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
    final bool isSessionError = error is PhotosSessionRevokedException;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Text(
              isSessionError
                  ? l10n.homeSessionExpired
                  : l10n.photosErrorGeneric,
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
