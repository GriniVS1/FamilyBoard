import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../l10n/generated/app_localizations.dart';

class ScannedPairPayload {
  const ScannedPairPayload({
    required this.serverUrl,
    required this.code,
    this.altUrl,
  });

  final String serverUrl;
  final String code;

  /// Optional fallback URL (typically an mDNS hostname) carried by newer QR
  /// codes as the `alt` query parameter. Null for older QR codes.
  final String? altUrl;
}

class QrScannerView extends StatefulWidget {
  const QrScannerView({super.key, required this.onScanned});

  final void Function(ScannedPairPayload payload) onScanned;

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
      final ScannedPairPayload? parsed = _parse(raw);
      if (parsed != null) {
        _handled = true;
        unawaited(_controller.stop());
        widget.onScanned(parsed);
        return;
      }
    }
  }

  ScannedPairPayload? _parse(String raw) {
    final Uri? uri = Uri.tryParse(raw);
    if (uri == null) {
      return null;
    }
    if (uri.scheme != 'familyboard' || uri.host != 'pair') {
      return null;
    }
    final String? code = uri.queryParameters['code'];
    final String? url = uri.queryParameters['url'];
    if (code == null || code.isEmpty || url == null || url.isEmpty) {
      return null;
    }
    final String? alt = uri.queryParameters['alt'];
    return ScannedPairPayload(
      serverUrl: url,
      code: code,
      altUrl: alt != null && alt.isNotEmpty ? alt : null,
    );
  }
}
