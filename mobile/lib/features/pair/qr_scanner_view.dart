import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../l10n/generated/app_localizations.dart';

/// Either shape of FamilyBoard's `familyboard://` QR codes.
sealed class ScannedQrPayload {
  const ScannedQrPayload();
}

class ScannedPairPayload extends ScannedQrPayload {
  const ScannedPairPayload({
    required this.serverUrl,
    required this.code,
    this.altUrl,
    this.remoteUrl,
  });

  final String serverUrl;
  final String code;

  /// Optional fallback URL (typically an mDNS hostname) carried by newer QR
  /// codes as the `alt` query parameter. Null for older QR codes.
  final String? altUrl;

  /// Optional cloud-relay base URL carried by newer QR codes as the `remote`
  /// query parameter (percent-encoded). Null for older QR codes or walls
  /// without a relay configured.
  final String? remoteUrl;
}

/// `familyboard://setup?url=<lanUrl>&alt=<mdnsUrl>&installation=<id>` — shown
/// by the wall while first-run setup is still incomplete, handing the whole
/// wizard (family, members, admin PIN, weather, pairing) over to the app.
class ScannedSetupPayload extends ScannedQrPayload {
  const ScannedSetupPayload({
    required this.url,
    required this.installationId,
    this.altUrl,
  });

  /// LAN base URL to verify (via `GET /api/mobile/identity`) and drive setup
  /// against.
  final String url;

  /// The wall's `Installation.id` — verified against the identity endpoint
  /// BEFORE any setup request is sent, so a spoofed/wrong host is never
  /// trusted.
  final String installationId;

  /// Optional mDNS fallback tried when [url] is unreachable.
  final String? altUrl;
}

/// Parses a scanned QR value against both `familyboard://` formats: `pair`
/// (normal pairing, from the wall's Settings screen) and `setup` (app-first
/// onboarding, from the first-run wizard). Returns null for anything else,
/// including malformed URIs or unrecognised hosts.
ScannedQrPayload? parseFamilyBoardQr(String raw) {
  final Uri? uri = Uri.tryParse(raw);
  if (uri == null || uri.scheme != 'familyboard') {
    return null;
  }
  switch (uri.host) {
    case 'pair':
      return _parsePair(uri);
    case 'setup':
      return _parseSetup(uri);
    default:
      return null;
  }
}

ScannedPairPayload? _parsePair(Uri uri) {
  final String? code = uri.queryParameters['code'];
  final String? url = uri.queryParameters['url'];
  if (code == null || code.isEmpty || url == null || url.isEmpty) {
    return null;
  }
  final String? alt = uri.queryParameters['alt'];
  // Uri.queryParameters already percent-decodes values.
  final String? remote = uri.queryParameters['remote'];
  return ScannedPairPayload(
    serverUrl: url,
    code: code,
    altUrl: alt != null && alt.isNotEmpty ? alt : null,
    remoteUrl: remote != null && remote.isNotEmpty ? remote : null,
  );
}

ScannedSetupPayload? _parseSetup(Uri uri) {
  final String? url = uri.queryParameters['url'];
  final String? installation = uri.queryParameters['installation'];
  if (url == null ||
      url.isEmpty ||
      installation == null ||
      installation.isEmpty) {
    return null;
  }
  final String? alt = uri.queryParameters['alt'];
  return ScannedSetupPayload(
    url: url,
    installationId: installation,
    altUrl: alt != null && alt.isNotEmpty ? alt : null,
  );
}

class QrScannerView extends StatefulWidget {
  const QrScannerView({super.key, required this.onScanned});

  final void Function(ScannedQrPayload payload) onScanned;

  @override
  State<QrScannerView> createState() => _QrScannerViewState();
}

class _QrScannerViewState extends State<QrScannerView> {
  final MobileScannerController _controller = MobileScannerController(
    formats: <BarcodeFormat>[BarcodeFormat.qrCode],
    detectionSpeed: DetectionSpeed.normal,
  );
  bool _handled = false;

  @override
  void dispose() {
    unawaited(_controller.dispose());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        AspectRatio(
          aspectRatio: 1,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(20),
            child: MobileScanner(
              controller: _controller,
              onDetect: _onDetect,
              errorBuilder: (
                BuildContext context,
                MobileScannerException error,
              ) {
                return Container(
                  color: Theme.of(context).colorScheme.errorContainer,
                  padding: const EdgeInsets.all(16),
                  child: Center(
                    child: Text(
                      error.errorDetails?.message ?? 'Scanner error',
                      textAlign: TextAlign.center,
                    ),
                  ),
                );
              },
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          l10n.pairScanInstruction,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) {
      return;
    }
    for (final Barcode barcode in capture.barcodes) {
      final String? raw = barcode.rawValue;
      if (raw == null || raw.isEmpty) {
        continue;
      }
      final ScannedQrPayload? parsed = parseFamilyBoardQr(raw);
      if (parsed != null) {
        _handled = true;
        unawaited(_controller.stop());
        widget.onScanned(parsed);
        return;
      }
    }
  }
}
