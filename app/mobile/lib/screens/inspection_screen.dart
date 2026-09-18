/// XAMOTO — Inspection avant achat (§24).
///
/// Une inspection XAMOTO est **technique** : elle porte sur ce que le véhicule a
/// communiqué à l'outil au moment du contrôle. Elle ne dit jamais « bonne
/// affaire » ni « véhicule sain » : un moteur peut avoir un défaut mécanique
/// invisible en OBD, et cela figure dans les notes rendues par le serveur.
///
/// Un score `null` s'affiche « non établi » : on n'écrit pas 0 à la place d'une
/// mesure qui n'a pas pu être faite.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/repair.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

class InspectionScreen extends StatefulWidget {
  const InspectionScreen({super.key});

  @override
  State<InspectionScreen> createState() => _InspectionScreenState();
}

class _InspectionScreenState extends State<InspectionScreen> {
  final TextEditingController _odometer = TextEditingController();
  final List<Inspection> _inspections = <Inspection>[];
  String? _error;
  String? _notice;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _odometer.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    final vehicle = state.selectedVehicle;
    if (vehicle == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final response = await state.api.get(Api.vehicleInspectionsPath(vehicle.id));
      if (!mounted) return;
      setState(() {
        _inspections
          ..clear()
          ..addAll(
            (response['inspections'] as List<dynamic>? ?? const <dynamic>[])
                .whereType<Map<String, dynamic>>()
                .map(Inspection.fromJson),
          );
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

  Future<void> _run() async {
    final state = context.read<AppState>();
    final vehicle = state.selectedVehicle;
    if (vehicle == null) return;
    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      final response = await state.api.post(
        Api.vehicleInspectionPath(vehicle.id),
        body: <String, Object?>{
          'diagnosticSessionId': state.lastDiagnostic?.id,
          if (_odometer.text.trim().isNotEmpty) 'displayedOdometerKm': int.tryParse(_odometer.text.trim()),
        },
      );
      final payload = response['inspection'];
      if (!mounted) return;
      setState(() {
        _busy = false;
        _notice = response['notice'] as String?;
        if (payload is Map<String, dynamic>) {
          _inspections.insert(0, Inspection.fromJson(payload));
        }
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
      case 'ok':
        return i18n.t('Conforme', 'Within range');
      case 'attention':
        return i18n.t('À surveiller', 'Watch');
      case 'red_flag':
        return i18n.t('Point bloquant', 'Blocking point');
      default:
        return i18n.t('Non testé', 'Not tested');
    }
  }

  Color _verdictColor(String verdict) {
    switch (verdict) {
      case 'ok':
        return const Color(0xFF2E7D32);
      case 'attention':
        return const Color(0xFF8D6E00);
      case 'red_flag':
        return const Color(0xFFB71C1C);
      default:
        return const Color(0xFF6D6D6D);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final en = i18n.locale == 'en';
    final vehicle = state.selectedVehicle;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Inspection avant achat', 'Pre-purchase inspection'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Text(i18n.t(
                  'Cette inspection est technique. XAMOTO ne porte aucun jugement commercial sur le véhicule ni sur le vendeur.',
                  'This inspection is technical. XAMOTO makes no commercial judgement about the vehicle or the seller.',
                )),
                ErrorBox(message: _error),
                if (vehicle == null)
                  EmptyState(
                    title: i18n.t('Aucun véhicule', 'No vehicle'),
                    message: i18n.t('Choisissez le véhicule à inspecter.', 'Choose the vehicle to inspect.'),
                  )
                else ...<Widget>[
                  SectionCard(
                    title: i18n.t('Lancer une inspection', 'Run an inspection'),
                    subtitle: i18n.t(
                      'Elle s’appuie sur le dernier diagnostic et sur le kilométrage affiché au compteur.',
                      'It relies on the latest diagnosis and on the odometer reading.',
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        TextField(
                          controller: _odometer,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: i18n.t('Kilométrage affiché', 'Displayed odometer'),
                            helperText: i18n.t('Ce que le compteur affiche, pas une estimation', 'What the odometer shows, not an estimate'),
                          ),
                        ),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: _busy ? null : _run,
                          child: Text(_busy ? i18n.t('Inspection…', 'Inspecting…') : i18n.t('Inspecter ce véhicule', 'Inspect this vehicle')),
                        ),
                      ],
                    ),
                  ),
                  if (_notice != null)
                    Card(child: Padding(padding: const EdgeInsets.all(12), child: Text(_notice!))),
                  if (_inspections.isEmpty)
                    SectionCard(
                      title: i18n.t('Aucune inspection enregistrée', 'No inspection recorded'),
                      child: Text(i18n.t('Une inspection demande un diagnostic récent : lancez un scan si besoin.', 'An inspection needs a recent diagnosis: run a scan if needed.')),
                    )
                  else
                    for (final inspection in _inspections)
                      SectionCard(
                        title: i18n.t('Rapport d’inspection', 'Inspection report'),
                        subtitle: formatDate(inspection.createdAt),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _scoreRow(i18n, i18n.t('Note globale', 'Overall'), inspection.scores.overall),
                            _scoreRow(i18n, i18n.t('Moteur', 'Engine'), inspection.scores.engine),
                            _scoreRow(i18n, i18n.t('Émissions', 'Emissions'), inspection.scores.emissions),
                            _scoreRow(i18n, i18n.t('Électrique', 'Electrical'), inspection.scores.electrical),
                            _scoreRow(i18n, i18n.t('Cohérence des données', 'Data coherence'), inspection.scores.dataCoherence),
                            if (inspection.redFlags.isNotEmpty) ...<Widget>[
                              const Divider(),
                              Text(i18n.t('Points bloquants', 'Blocking points'), style: const TextStyle(fontWeight: FontWeight.w700)),
                              for (final flag in inspection.redFlags) Text('• $flag'),
                            ],
                            const Divider(),
                            for (final item in inspection.checklist)
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 4),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Row(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: <Widget>[
                                        Expanded(child: Text(en ? item.labelEn : item.labelFr)),
                                        const SizedBox(width: 8),
                                        Text(
                                          _verdictLabel(i18n, item.verdict),
                                          style: TextStyle(color: _verdictColor(item.verdict), fontWeight: FontWeight.w600),
                                        ),
                                      ],
                                    ),
                                    if (item.detail != null) Text(item.detail!, style: Theme.of(context).textTheme.bodySmall),
                                  ],
                                ),
                              ),
                            if (inspection.notes.isNotEmpty) ...<Widget>[
                              const Divider(),
                              for (final note in inspection.notes)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 2),
                                  child: Text(note, style: const TextStyle(fontStyle: FontStyle.italic)),
                                ),
                            ],
                          ],
                        ),
                      ),
                ],
              ],
            ),
    );
  }

  Widget _scoreRow(I18n i18n, String label, int? value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label)),
          SizedBox(
            width: 110,
            child: value == null
                ? Text(i18n.t('non établi', 'not established'), textAlign: TextAlign.right)
                : LinearProgressIndicator(value: value / 100, minHeight: 6),
          ),
          const SizedBox(width: 8),
          Text(value == null ? '—' : '$value / 100'),
        ],
      ),
    );
  }
}
