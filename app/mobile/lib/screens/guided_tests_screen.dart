/// XAMOTO — Tests guidés (§17).
///
/// Un test ne se termine que si l'utilisateur CONFIRME ce qu'il a observé (§47-8).
/// Sans confirmation, le test reste « proposé » : XAMOTO ne remplit jamais un
/// résultat à la place de quelqu'un qui n'a pas regardé.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/diagnostic.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class GuidedTestsScreen extends StatefulWidget {
  const GuidedTestsScreen({super.key});

  @override
  State<GuidedTestsScreen> createState() => _GuidedTestsScreenState();
}

class _GuidedTestsScreenState extends State<GuidedTestsScreen> {
  List<GuidedTest> _tests = <GuidedTest>[];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    final diagnosticId = state.lastDiagnostic?.id;
    if (diagnosticId == null) {
      setState(() {
        _loading = false;
        _error = null;
      });
      return;
    }
    try {
      final response = await state.api.get(Api.diagnosticTestsPath(diagnosticId));
      setState(() {
        _tests = (response['tests'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(GuidedTest.fromJson)
            .toList();
        _loading = false;
      });
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final en = i18n.locale == 'en';

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Tests guidés', 'Guided tests'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Text(i18n.t(
                  'Chaque test dit ce qu’il cherche, avec quel matériel, et ce qu’il ne peut pas conclure.',
                  'Each test states what it looks for, with which equipment, and what it cannot conclude.',
                )),
                ErrorBox(message: _error),
                for (final test in _tests)
                  SectionCard(
                    title: en ? test.titleEn : test.titleFr,
                    subtitle: '${en ? test.objectiveEn : test.objectiveFr}${test.durationMin == null ? '' : ' · ${test.durationMin} min'}',
                    trailing: SafetyBadge(safety: test.safety, i18n: i18n),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        if (test.equipment.isNotEmpty)
                          Text('${i18n.t('Matériel', 'Equipment')} : ${test.equipment.join(', ')}'),
                        if (test.reasonFr != null && test.reasonFr!.isNotEmpty) ...<Widget>[
                          const SizedBox(height: 4),
                          Text(en ? (test.reasonEn ?? test.reasonFr!) : test.reasonFr!),
                        ],
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: <Widget>[
                            FilledButton(
                              onPressed: () => _recordOutcome(test, 'ok'),
                              child: Text(i18n.t('Conforme', 'Within range')),
                            ),
                            OutlinedButton(
                              onPressed: () => _recordOutcome(test, 'out_of_range'),
                              child: Text(i18n.t('Hors plage', 'Out of range')),
                            ),
                            TextButton(
                              onPressed: () => _recordOutcome(test, 'not_applicable'),
                              child: Text(i18n.t('Non applicable', 'Not applicable')),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  /// Enregistre un résultat — avec confirmation obligatoire.
  Future<void> _recordOutcome(GuidedTest test, String outcome) async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final diagnosticId = state.lastDiagnostic?.id;
    if (diagnosticId == null) return;

    var confirmed = false;
    String? note;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => StatefulBuilder(
        builder: (builderContext, setDialogState) => AlertDialog(
          title: Text(i18n.t('Confirmez ce que vous avez observé', 'Confirm what you observed')),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              CheckboxListTile(
                value: confirmed,
                onChanged: (value) => setDialogState(() => confirmed = value ?? false),
                title: Text(i18n.t(
                  'J’ai réellement réalisé ce test et j’en confirme le résultat.',
                  'I actually performed this test and confirm the result.',
                )),
              ),
              TextField(
                decoration: InputDecoration(labelText: i18n.t('Note (facultatif)', 'Note (optional)')),
                onChanged: (value) => note = value,
              ),
            ],
          ),
          actions: <Widget>[
            TextButton(onPressed: () => Navigator.pop(dialogContext, false), child: Text(i18n.t('Annuler', 'Cancel'))),
            FilledButton(onPressed: () => Navigator.pop(dialogContext, confirmed), child: Text(i18n.t('Enregistrer', 'Save'))),
          ],
        ),
      ),
    );

    if (accepted != true || !confirmed) return;
    await state.updateTestResult(diagnosticId: diagnosticId, testKey: test.testKey, outcome: outcome, confirmed: true, note: note);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(i18n.t('Résultat enregistré.', 'Result saved.'))),
    );
    await _load();
  }
}
