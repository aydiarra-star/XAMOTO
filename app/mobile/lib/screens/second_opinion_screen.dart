/// XAMOTO — Seconde opinion (§20).
///
/// L'utilisateur saisit le diagnostic qu'il a reçu. XAMOTO le confronte à ce
/// qu'il a réellement lu sur SON véhicule, puis rend trois listes :
/// ce qui est soutenu par les mesures, ce qui n'est ni confirmé ni écarté, et
/// les autres causes encore possibles.
///
/// Ce que cet écran ne fait pas, et le dit : juger le garage, sa compétence ou
/// son prix. Il produit des questions vérifiables et des tests à demander.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/second_opinion.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class SecondOpinionScreen extends StatefulWidget {
  const SecondOpinionScreen({super.key});

  @override
  State<SecondOpinionScreen> createState() => _SecondOpinionScreenState();
}

class _SecondOpinionScreenState extends State<SecondOpinionScreen> {
  final TextEditingController _diagnosis = TextEditingController();
  final TextEditingController _causes = TextEditingController();
  final TextEditingController _repair = TextEditingController();
  final TextEditingController _amount = TextEditingController();

  SecondOpinion? _opinion;
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _diagnosis.dispose();
    _causes.dispose();
    _repair.dispose();
    _amount.dispose();
    super.dispose();
  }

  Future<void> _ask() async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final diagnostic = state.lastDiagnostic;
    if (diagnostic == null) {
      setState(() => _error = i18n.t(
            'Aucun diagnostic enregistré : faites d’abord un scan. XAMOTO ne compare rien sans ses propres mesures.',
            'No stored diagnosis: run a scan first. XAMOTO compares nothing without its own measurements.',
          ));
      return;
    }
    if (_diagnosis.text.trim().length < 3) {
      setState(() => _error = i18n.t('Indiquez le diagnostic reçu du garage.', 'Enter the diagnosis received from the garage.'));
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _opinion = null;
    });
    try {
      final response = await state.api.post(Api.diagnosticSecondOpinionPath(diagnostic.id), body: <String, Object?>{
        'externalDiagnosis': _diagnosis.text.trim(),
        'externalCauses': _causes.text
            .split(',')
            .map((cause) => cause.trim())
            .where((cause) => cause.isNotEmpty)
            .toList(),
        if (_repair.text.trim().isNotEmpty) 'proposedRepair': _repair.text.trim(),
        if (_amount.text.trim().isNotEmpty) 'proposedAmount': double.tryParse(_amount.text.replaceAll(',', '.').trim()),
        'currency': 'XOF',
      });
      final payload = response['secondOpinion'];
      if (!mounted) return;
      setState(() {
        _opinion = payload is Map<String, dynamic> ? SecondOpinion.fromJson(payload) : null;
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

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final en = i18n.locale == 'en';
    final opinion = _opinion;
    final diagnosticId = state.lastDiagnostic?.id;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Seconde opinion', 'Second opinion'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          Text(i18n.t(
            'Décrivez ce que le garage vous a annoncé : XAMOTO le confronte aux mesures de votre véhicule et vous donne des questions à poser.',
            'Describe what the garage told you: XAMOTO compares it with your vehicle measurements and gives you questions to ask.',
          )),
          if (diagnosticId == null) ...<Widget>[
            const SizedBox(height: 8),
            Text(i18n.t(
              'Aucun diagnostic enregistré pour l’instant : lancez un scan pour que la comparaison soit possible.',
              'No diagnosis stored yet: run a scan so the comparison is possible.',
            )),
          ],
          ErrorBox(message: _error),
          SectionCard(
            title: i18n.t('Diagnostic reçu', 'Diagnosis received'),
            subtitle: i18n.t('XAMOTO ne juge pas le garage : il compare des éléments vérifiables.', 'XAMOTO does not judge the garage: it compares verifiable elements.'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                TextField(
                  controller: _diagnosis,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: i18n.t('Ce qui a été annoncé', 'What was announced'),
                    hintText: i18n.t('Ex. : « il faut changer la pompe à essence »', 'E.g.: “the fuel pump must be replaced”'),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _causes,
                  decoration: InputDecoration(
                    labelText: i18n.t('Causes annoncées', 'Announced causes'),
                    helperText: i18n.t('Séparées par des virgules', 'Separated by commas'),
                  ),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _repair,
                  decoration: InputDecoration(labelText: i18n.t('Réparation proposée', 'Proposed repair')),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _amount,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(labelText: i18n.t('Montant demandé (FCFA)', 'Amount requested (XOF)')),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: _busy || diagnosticId == null ? null : _ask,
                  child: Text(_busy ? i18n.t('Comparaison…', 'Comparing…') : i18n.t('Demander la seconde opinion', 'Ask for the second opinion')),
                ),
              ],
            ),
          ),
          if (opinion != null) ...<Widget>[
            SectionCard(
              title: i18n.t('Résumé', 'Summary'),
              child: Text(en ? (opinion.summaryEn ?? opinion.summaryFr ?? '') : (opinion.summaryFr ?? '')),
            ),
            if (opinion.confirmedElements.isNotEmpty)
              SectionCard(
                title: i18n.t('Soutenu par les mesures', 'Supported by the measurements'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    for (final element in opinion.confirmedElements)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(element.label),
                            if (element.why != null) Text(element.why!, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (opinion.unconfirmedElements.isNotEmpty)
              SectionCard(
                title: i18n.t('Ni confirmé ni écarté', 'Neither confirmed nor ruled out'),
                subtitle: i18n.t('Non vérifiable ne veut pas dire faux.', 'Unverifiable does not mean false.'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    for (final element in opinion.unconfirmedElements)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(element.label),
                            if (element.why != null) Text(element.why!, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (opinion.alternativeHypotheses.isNotEmpty)
              SectionCard(
                title: i18n.t('Autres causes encore possibles', 'Other possible causes'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    for (final hypothesis in opinion.alternativeHypotheses)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Expanded(child: Text(en ? hypothesis.labelEn : hypothesis.labelFr)),
                                const SizedBox(width: 8),
                                CertaintyBadge(certainty: hypothesis.certainty, i18n: i18n),
                              ],
                            ),
                            for (final reason in hypothesis.reasoning) Text('• $reason', style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (opinion.additionalTests.isNotEmpty)
              SectionCard(
                title: i18n.t('Tests qui permettraient de trancher', 'Tests that would settle it'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    for (final test in opinion.additionalTests)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(test.title),
                            if (test.objective != null) Text(test.objective!, style: Theme.of(context).textTheme.bodySmall),
                          ],
                        ),
                      ),
                  ],
                ),
              ),
            if (opinion.questionsFr.isNotEmpty)
              SectionCard(
                title: i18n.t('Questions à poser', 'Questions to ask'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    for (final question in opinion.questionsFr) Text('• $question'),
                  ],
                ),
              ),
            if (opinion.disclaimerFr != null)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Text(en ? (opinion.disclaimerEn ?? opinion.disclaimerFr!) : opinion.disclaimerFr!),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
