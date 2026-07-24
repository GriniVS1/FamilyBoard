import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/geocode_result.dart';
import '../../state/locale_provider.dart';
import '../../state/setup_onboarding_controller.dart';
import 'setup_error_text.dart';

class StepWeatherView extends ConsumerStatefulWidget {
  const StepWeatherView({super.key});

  @override
  ConsumerState<StepWeatherView> createState() => _StepWeatherViewState();
}

class _StepWeatherViewState extends ConsumerState<StepWeatherView> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _latController = TextEditingController();
  final TextEditingController _lonController = TextEditingController();

  Timer? _debounce;
  int _requestId = 0;
  List<GeocodeResult> _results = <GeocodeResult>[];
  bool _searching = false;
  bool _searchFailed = false;
  bool _showManualCoords = false;
  GeocodeResult? _picked;
  String? _localError;

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _latController.dispose();
    _lonController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String query) {
    _picked = null;
    _debounce?.cancel();
    final String trimmed = query.trim();
    if (trimmed.length < 2) {
      setState(() {
        _results = <GeocodeResult>[];
        _searching = false;
        _searchFailed = false;
      });
      return;
    }
    _debounce =
        Timer(const Duration(milliseconds: 350), () => _search(trimmed));
  }

  Future<void> _search(String query) async {
    final int requestId = ++_requestId;
    setState(() {
      _searching = true;
      _searchFailed = false;
    });
    final SetupOnboardingState state =
        ref.read(setupOnboardingControllerProvider);
    final String? baseUrl = state.baseUrl;
    if (baseUrl == null) {
      return;
    }
    final String lang =
        ref.read(localePrefProvider).locale?.languageCode ?? 'en';
    try {
      final List<GeocodeResult> results =
          await ref.read(setupServiceProvider).geocode(baseUrl, query, lang);
      if (requestId != _requestId || !mounted) {
        return;
      }
      setState(() {
        _results = results;
        _searching = false;
      });
    } on Object {
      if (requestId != _requestId || !mounted) {
        return;
      }
      setState(() {
        _results = <GeocodeResult>[];
        _searching = false;
        _searchFailed = true;
      });
    }
  }

  void _pick(GeocodeResult result) {
    setState(() {
      _picked = result;
      _searchController.text = result.shortLabel;
      _results = <GeocodeResult>[];
      _localError = null;
    });
  }

  Future<void> _next() async {
    final AppL10n l10n = AppL10n.of(context);
    double? lat;
    double? lon;
    String label;

    if (_showManualCoords &&
        (_latController.text.trim().isNotEmpty ||
            _lonController.text.trim().isNotEmpty)) {
      lat = double.tryParse(_latController.text.trim());
      lon = double.tryParse(_lonController.text.trim());
      if (lat == null ||
          lon == null ||
          lat < -90 ||
          lat > 90 ||
          lon < -180 ||
          lon > 180) {
        setState(() => _localError = l10n.setupWeatherInvalidCoords);
        return;
      }
      label = _searchController.text.trim().isNotEmpty
          ? _searchController.text.trim()
          : 'My Location';
    } else if (_picked != null) {
      lat = _picked!.latitude;
      lon = _picked!.longitude;
      label = _picked!.shortLabel;
    } else {
      setState(() => _localError = l10n.setupWeatherCoordsRequired);
      return;
    }

    setState(() => _localError = null);
    await ref.read(setupOnboardingControllerProvider.notifier).submitWeather(
          lat: lat,
          lon: lon,
          label: label,
        );
  }

  void _skip() {
    ref.read(setupOnboardingControllerProvider.notifier).skipWeather();
  }

  @override
  Widget build(BuildContext context) {
    final AppL10n l10n = AppL10n.of(context);
    final SetupOnboardingState state =
        ref.watch(setupOnboardingControllerProvider);

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Text(l10n.setupWeatherTitle,
              style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(l10n.setupWeatherDescription,
              style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 24),
          TextField(
            controller: _searchController,
            onChanged: _onQueryChanged,
            decoration: InputDecoration(
              labelText: l10n.setupWeatherCityLabel,
              hintText: l10n.setupWeatherSearchPlaceholder,
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    )
                  : null,
            ),
          ),
          if (_searchController.text.trim().length >= 2 &&
              (_results.isNotEmpty ||
                  _searchFailed ||
                  (!_searching && _results.isEmpty)))
            Container(
              margin: const EdgeInsets.only(top: 8),
              decoration: BoxDecoration(
                border:
                    Border.all(color: Theme.of(context).colorScheme.outline),
                borderRadius: BorderRadius.circular(16),
              ),
              child: _searchFailed
                  ? ListTile(title: Text(l10n.setupWeatherSearchError))
                  : _results.isEmpty && !_searching
                      ? ListTile(title: Text(l10n.setupWeatherNoResults))
                      : Column(
                          mainAxisSize: MainAxisSize.min,
                          children: _results
                              .map(
                                (GeocodeResult r) => ListTile(
                                  leading: const Icon(Icons.place_outlined),
                                  title: Text(r.displayLabel),
                                  onTap: () => _pick(r),
                                ),
                              )
                              .toList(),
                        ),
            ),
          const SizedBox(height: 8),
          TextButton.icon(
            icon: Icon(
              _showManualCoords ? Icons.expand_less : Icons.expand_more,
            ),
            label: Text(l10n.setupWeatherEnterManually),
            onPressed: () =>
                setState(() => _showManualCoords = !_showManualCoords),
          ),
          if (_showManualCoords) ...<Widget>[
            Row(
              children: <Widget>[
                Expanded(
                  child: TextField(
                    controller: _latController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true, signed: true),
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
                    ],
                    decoration: InputDecoration(
                        labelText: l10n.setupWeatherLatitudeLabel),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextField(
                    controller: _lonController,
                    keyboardType: const TextInputType.numberWithOptions(
                        decimal: true, signed: true),
                    inputFormatters: <TextInputFormatter>[
                      FilteringTextInputFormatter.allow(RegExp(r'[0-9.\-]')),
                    ],
                    decoration: InputDecoration(
                        labelText: l10n.setupWeatherLongitudeLabel),
                  ),
                ),
              ],
            ),
          ],
          if (_localError != null) ...<Widget>[
            const SizedBox(height: 12),
            Text(
              _localError!,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          ],
          if (state.error != null) ...<Widget>[
            const SizedBox(height: 16),
            SetupErrorText(kind: state.error!),
          ],
          const SizedBox(height: 24),
          Row(
            children: <Widget>[
              Expanded(
                child: OutlinedButton(
                  onPressed: state.submitting ? null : _skip,
                  child: Text(l10n.setupStepSkip),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: state.submitting ? null : _next,
                  child: state.submitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      : Text(l10n.setupStepNext),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
