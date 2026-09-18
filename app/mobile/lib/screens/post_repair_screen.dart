/// XAMOTO — Après réparation (§19).
///
/// L'écran sépare deux choses que l'on confond souvent :
///
///  - **ce qui a été fait** : une déclaration de l'utilisateur, enregistrée telle
///    quelle (`POST /api/repairs`) — XAMOTO n'a aucun moyen de la vérifier ;
///  - **ce que les mesures disent** : une comparaison avant/après calculée par le
///    moteur (`POST /api/diagnostics/:id/compare`), avec son verdict ET sa
///    certitude.
///
/// Un défaut effacé au garage peut revenir après quelques trajets : le nombre de
/// kilomètres et de cycles de conduite roulés depuis l'intervention fait partie
/// du verdict, il n'est pas décoratif.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/repair.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../storage/sync_queue.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class _DiagnosticOption {
  const _DiagnosticOption({required this.id, required this.label, required this.startedAt});

  final String id;
  final String label;
  final DateTime? startedAt;
}

class PostRepairScreen extends StatefulWidget {
  const PostRepairScreen({super.key});

  @override
  State<PostRepairScreen> createState() => _PostRepairScreenState();
}

class _PostRepairScreenState extends State<PostRepairScreen> {
  final TextEditingController _description = TextEditingController();
  final TextEditingController _cost = TextEditingController();
  final TextEditingController _odometer = TextEditingController();
  final TextEditingController _parts = TextEditingController();
  final TextEditingController _kmSince = TextEditingController();
  final TextEditingController _driveCycles = TextEditingController();

  List<Repair> _repairs = <Repair>[];
  List<_DiagnosticOption> _diagnostics = <_DiagnosticOption>[];
  RepairComparison? _comparison;
  String? _beforeId;
  String? _afterId;
  String? _error;
  String? _saved;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _description.dispose();
    _cost.dispose();
    _odometer.dispose();
    _parts.dispose();
    _kmSince.dispose();
    _driveCycles.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    final vehicle = state.selectedVehicle;
    if (vehicle == null) {
      setState(() => _loading = false);
      return;
    }
    await _fetch(state, vehicle.id);
  }

  Future<void> _fetch(AppState state, String vehicleId) async {
    try {
      final repairsResponse = await state.api.get(Api.repairs, query: <String, String>{'vehicleId': vehicleId});
      final diagnosticsResponse = await state.api.get(Api.diagnostics, query: <String, String>{'vehicleId': vehicleId, 'limit': '10'});
      if (!mounted) return;
      setState(() {
        _repairs = (repairsResponse['repairs'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(Repair.fromJson)
            .toList();
        _diagnostics = (diagnosticsResponse['diagnostics'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(
              (entry) => _DiagnosticOption(
                id: entry['id'] as String? ?? '',
                label: entry['conclusionFr'] as String? ?? '',
                startedAt: entry['startedAt'] is String ? DateTime.tryParse(entry['startedAt'] as String) : null,
              ),
            )
            .toList();
        _beforeId ??= _diagnostics.isEmpty ? null : _diagnostics.last.id;
        _loading = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  String _diagnosticLabel(_DiagnosticOption option) {
    final text = option.label.length > 50 ? option.label.substring(0, 50) : option.label;
    return '${formatDate(option.startedAt)} — $text';
  }

  /// La réparation est un fait DÉCLARÉ : elle est enregistrée même hors ligne,
  /// parce qu'elle ne dépend d'aucun calcul. Elle sera envoyée au retour du réseau.
  Future<void> _recordRepair() async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final vehicle = state.selectedVehicle;
    if (vehicle == null) return;
    if (_description.text.trim().length < 3) {
      setState(() => _error = i18n.t('Décrivez la réparation effectuée.', 'Describe the repair carried out.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _saved = null;
    });
    final parts = _parts.text
        .split(',')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .map((label) => <String, Object?>{'label': label, 'quantity': 1})
        .toList();
    final body = <String, Object?>{
      'vehicleId': vehicle.id,
      'diagnosticSessionId': _beforeId,
      'description': _description.text.trim(),
      'partsReplaced': parts,
      if (_cost.text.trim().isNotEmpty) 'costAmount': double.tryParse(_cost.text.replaceAll(',', '.').trim()),
      if (_odometer.text.trim().isNotEmpty) 'odometerKm': int.tryParse(_odometer.text.trim()),
    };
    try {
      final sent = await state.sync.sendOrQueue(
        kind: PendingKind.observation,
        opKey: 'repair:${vehicle.id}:${_description.text.trim()}',
        path: Api.repairs,
        body: body,
        vehicleId: vehicle.id,
      );
      final queued = !sent;
      await state.refreshPending();
      if (!mounted) return;
      setState(() {
        _busy = false;
        _saved = queued
            ? i18n.t('Réparation notée : elle partira au retour du réseau.', 'Repair noted: it will be sent when the network returns.')
            : i18n.t('Réparation enregistrée. Faites un nouveau scan, puis comparez.', 'Repair recorded. Run a new scan, then compare.');
        _description.clear();
        _parts.clear();
        _cost.clear();
        _odometer.clear();
      });
      if (!queued) await _fetch(state, vehicle.id);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.message;
      });
    }
  }

  Future<void> _compare() async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final before = _beforeId;
    final after = _afterId;
    if (before == null || after == null || before == after) {
      setState(() => _error = i18n.t(
            'Choisissez deux diagnostics différents : l’avant et l’après réparation.',
            'Choose two different diagnoses: before and after the repair.',
          ));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _comparison = null;
    });
    try {
      final response = await state.api.post(Api.diagnosticComparePath(before), body: <String, Object?>{
        'afterDiagnosticSessionId': after,
        'repairDescription': _description.text.trim().isEmpty
            ? i18n.t('Réparation déclarée', 'Declared repair')
            : _description.text.trim(),
        if (_kmSince.text.trim().isNotEmpty) 'kmSinceRepair': int.tryParse(_kmSince.text.trim()),
        if (_driveCycles.text.trim().isNotEmpty) 'driveCycles': int.tryParse(_driveCycles.text.trim()),
      });
      final comparison = response['comparison'];
      if (!mounted) return;
      setState(() {
        _comparison = comparison is Map<String, dynamic> ? RepairComparison.fromJson(comparison) : null;
        _busy = false;
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = error.message;
      });
    }
  }

  String _verdictLabel(I18n i18n, String verdict) {
    switch (verdict) {
      case 'resolved':
        return i18n.t('Défauts absents après réparation', 'Faults absent after the repair');
      case 'improved':
        return i18n.t('Situation améliorée, sans disparition complète', 'Improved, without full disappearance');
      case 'unchanged':
        return i18n.t('Défauts toujours présents', 'Faults still present');
      case 'worse':
        return i18n.t('Situation dégradée', 'Worse situation');
      case 'new_faults':
        return i18n.t('Nouveaux défauts apparus', 'New faults appeared');
      default:
        return i18n.t('Données insuffisantes pour conclure', 'Not enough data to conclude');
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final en = i18n.locale == 'en';
    final comparison = _comparison;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Après réparation', 'After a repair'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Text(i18n.t(
                  'XAMOTO enregistre ce qui a été fait, puis compare les mesures avant et après. Il ne déclare jamais une réparation « définitive ».',
                  'XAMOTO records what was done, then compares measurements before and after. It never declares a repair “permanent”.',
                )),
                ErrorBox(message: _error),
                if (_saved != null) Card(child: Padding(padding: const EdgeInsets.all(12), child: Text(_saved!))),
                SectionCard(
                  title: i18n.t('Ce qui a été fait', 'What was done'),
                  subtitle: i18n.t('Déclaré par vous : XAMOTO ne peut pas le vérifier.', 'Declared by you: XAMOTO cannot verify it.'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      TextField(
                        controller: _description,
                        decoration: InputDecoration(labelText: i18n.t('Réparation effectuée', 'Repair carried out')),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _parts,
                        decoration: InputDecoration(
                          labelText: i18n.t('Pièces remplacées', 'Parts replaced'),
                          helperText: i18n.t('Séparées par des virgules', 'Separated by commas'),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: TextField(
                              controller: _cost,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(labelText: i18n.t('Coût (FCFA)', 'Cost (XOF)')),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _odometer,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(labelText: i18n.t('Kilométrage', 'Odometer')),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _busy ? null : _recordRepair,
                        child: Text(i18n.t('Enregistrer la réparation', 'Record the repair')),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        i18n.t(
                          'XAMOTO n’estime aucun prix « normal » : le coût est celui que vous déclarez, rien d’autre.',
                          'XAMOTO estimates no “normal” price: the cost is the one you declare, nothing else.',
                        ),
                        style: const TextStyle(fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
                SectionCard(
                  title: i18n.t('Comparer avant / après', 'Compare before / after'),
                  subtitle: i18n.t(
                    'Le verdict dépend aussi des kilomètres et des cycles de conduite effectués depuis.',
                    'The verdict also depends on the kilometres and drive cycles completed since.',
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      DropdownButtonFormField<String>(
                        value: _beforeId,
                        decoration: InputDecoration(labelText: i18n.t('Diagnostic AVANT', 'Diagnosis BEFORE')),
                        items: <DropdownMenuItem<String>>[
                          for (final diagnostic in _diagnostics)
                            DropdownMenuItem<String>(value: diagnostic.id, child: Text(_diagnosticLabel(diagnostic))),
                        ],
                        onChanged: (value) => setState(() => _beforeId = value),
                      ),
                      const SizedBox(height: 8),
                      DropdownButtonFormField<String>(
                        value: _afterId,
                        decoration: InputDecoration(labelText: i18n.t('Diagnostic APRÈS', 'Diagnosis AFTER')),
                        items: <DropdownMenuItem<String>>[
                          for (final diagnostic in _diagnostics)
                            DropdownMenuItem<String>(value: diagnostic.id, child: Text(_diagnosticLabel(diagnostic))),
                        ],
                        onChanged: (value) => setState(() => _afterId = value),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: <Widget>[
                          Expanded(
                            child: TextField(
                              controller: _kmSince,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(labelText: i18n.t('Km depuis', 'Km since')),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _driveCycles,
                              keyboardType: TextInputType.number,
                              decoration: InputDecoration(labelText: i18n.t('Cycles de conduite', 'Drive cycles')),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      FilledButton.tonal(
                        onPressed: _busy ? null : _compare,
                        child: Text(i18n.t('Comparer les mesures', 'Compare the measurements')),
                      ),
                    ],
                  ),
                ),
                if (comparison != null)
                  SectionCard(
                    title: _verdictLabel(i18n, comparison.verdict),
                    subtitle: i18n.t('Origine des données', 'Data origin') + ' : ${comparison.dataOrigin}',
                    trailing: CertaintyBadge(certainty: comparison.certainty, i18n: i18n),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text(en ? comparison.summaryEn : comparison.summaryFr),
                        const SizedBox(height: 8),
                        DataRow(label: i18n.t('Défauts avant', 'Faults before'), value: comparison.dtcBefore.isEmpty ? i18n.t('aucun', 'none') : comparison.dtcBefore.join(', ')),
                        DataRow(label: i18n.t('Défauts après', 'Faults after'), value: comparison.dtcAfter.isEmpty ? i18n.t('aucun', 'none') : comparison.dtcAfter.join(', ')),
                        DataRow(label: i18n.t('Disparus', 'Cleared'), value: comparison.dtcResolved.isEmpty ? i18n.t('aucun', 'none') : comparison.dtcResolved.join(', ')),
                        DataRow(label: i18n.t('Toujours présents', 'Still present'), value: comparison.dtcRemaining.isEmpty ? i18n.t('aucun', 'none') : comparison.dtcRemaining.join(', ')),
                        DataRow(label: i18n.t('Nouveaux', 'New'), value: comparison.dtcNew.isEmpty ? i18n.t('aucun', 'none') : comparison.dtcNew.join(', ')),
                        if (comparison.valuesChanged.isNotEmpty) ...<Widget>[
                          const Divider(),
                          Text(i18n.t('Valeurs comparées', 'Compared values')),
                          for (final value in comparison.valuesChanged)
                            DataRow(
                              label: value.label,
                              value: '${value.beforeText} → ${value.afterText}',
                            ),
                        ],
                        const SizedBox(height: 6),
                        Text(
                          i18n.t(
                            'Un défaut peut revenir après plusieurs cycles de conduite : refaites un scan après avoir roulé.',
                            'A fault may return after several drive cycles: rescan after driving.',
                          ),
                          style: const TextStyle(fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                if (_repairs.isNotEmpty)
                  SectionCard(
                    title: i18n.t('Réparations enregistrées', 'Recorded repairs'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        for (final repair in _repairs)
                          Padding(
                            padding: const EdgeInsets.symmetric(vertical: 4),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text('${formatDate(repair.performedAt)} — ${repair.description}'),
                                Text(
                                  '${repair.costText} · ${repair.odometerText}'
                                  '${repair.partsReplaced.isEmpty ? '' : ' · ${repair.partsReplaced.map((part) => part.label).join(', ')}'}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
