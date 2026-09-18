/// XAMOTO — Devis de garage (§27).
///
/// Trois règles gouvernent cet écran, et elles expliquent chaque détail :
///
///  1. **Aucun montant écrit à la place du garage.** Une ligne dont le montant
///     reste vide bloque l'enregistrement : un « 0 » enregistré deviendrait un
///     prix, donc une donnée inventée (§47-1).
///  2. **Aucun jugement de valeur.** Ni « cher », ni « anormal », ni comparaison
///     entre garages : seulement ce qui rejoint une donnée lue sur le véhicule.
///  3. **Un devis sans lien mesuré n'est pas une faute.** Freinage, climatisation
///     ou carrosserie ne sont pas lisibles par l'OBD : le rappel est affiché avec
///     l'analyse, pas caché.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/garage.dart';
import '../api/models/quote.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

/// Diagnostic enregistré, réduit à ce dont un devis a besoin.
class _DiagnosticOption {
  const _DiagnosticOption({required this.id, required this.label, required this.startedAt});

  final String id;
  final String label;
  final DateTime? startedAt;
}

/// Ligne en cours de saisie : trois champs, dont un SEUL est obligatoire
/// (le libellé). Le montant vide est une information, pas un manque à combler.
class _DraftLine {
  _DraftLine({String label = ''})
      : label = TextEditingController(text: label),
        quantity = TextEditingController(text: '1'),
        amount = TextEditingController();

  final TextEditingController label;
  final TextEditingController quantity;
  final TextEditingController amount;

  void dispose() {
    label.dispose();
    quantity.dispose();
    amount.dispose();
  }
}

class QuotesScreen extends StatefulWidget {
  const QuotesScreen({super.key});

  @override
  State<QuotesScreen> createState() => _QuotesScreenState();
}

class _QuotesScreenState extends State<QuotesScreen> {
  List<Quote> _quotes = <Quote>[];
  List<Garage> _garages = <Garage>[];
  List<_DiagnosticOption> _diagnostics = <_DiagnosticOption>[];
  final Map<String, QuoteAnalysis> _analyses = <String, QuoteAnalysis>{};
  final Map<String, String> _analysisErrors = <String, String>{};
  final List<_DraftLine> _lines = <_DraftLine>[_DraftLine()];
  String? _garageId;
  String? _diagnosticId;
  String? _error;
  String? _blockedReason;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    for (final line in _lines) {
      line.dispose();
    }
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

  /// Chargement sans `BuildContext` : il peut donc être appelé après un `await`
  /// (par exemple juste après l'enregistrement d'un devis).
  Future<void> _fetch(AppState state, String vehicleId) async {
    try {
      final quotesResponse = await state.api.get(Api.quotes, query: <String, String>{'vehicleId': vehicleId});
      final garagesResponse = await state.api.get(Api.garages, query: <String, String>{'country': 'SN'});
      final diagnosticsResponse = await state.api.get(Api.diagnostics, query: <String, String>{'vehicleId': vehicleId, 'limit': '10'});
      if (!mounted) return;
      setState(() {
        _quotes = (quotesResponse['quotes'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(Quote.fromJson)
            .toList();
        _garages = (garagesResponse['garages'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(Garage.fromJson)
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

  String _garageName(String id) {
    for (final garage in _garages) {
      if (garage.id == id) return '${garage.name} — ${garage.city}';
    }
    return id;
  }

  String _statusLabel(I18n i18n, String status) {
    switch (status) {
      case 'draft':
        return i18n.t('Brouillon', 'Draft');
      case 'requested':
        return i18n.t('Demandé', 'Requested');
      case 'received':
        return i18n.t('Reçu', 'Received');
      case 'accepted':
        return i18n.t('Accepté', 'Accepted');
      case 'declined':
        return i18n.t('Refusé', 'Declined');
      default:
        return status;
    }
  }

  String _short(String text) => text.length > 60 ? text.substring(0, 60) : text;

  /// Reprend les pièces citées par le diagnostic sélectionné : les libellés
  /// seulement. Les montants restent vides — c'est le garage qui les donne.
  void _prefillFromDiagnostic() {
    final selected = _diagnosticId;
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    if (selected == null) {
      setState(() => _blockedReason = i18n.t('Choisissez d’abord le diagnostic concerné.', 'First choose the relevant diagnosis.'));
      return;
    }
    final diagnostic = state.lastDiagnostic;
    if (diagnostic == null || diagnostic.id != selected) {
      setState(() => _blockedReason = i18n.t(
            'Ouvrez d’abord le diagnostic concerné : XAMOTO n’invente pas la liste des pièces.',
            'Open the relevant diagnosis first: XAMOTO does not invent the list of parts.',
          ));
      return;
    }
    final labels = <String>{};
    for (final hypothesis in diagnostic.hypotheses) {
      for (final part in hypothesis.parts) {
        labels.add(part.replaceAll('_', ' '));
      }
    }
    if (labels.isEmpty) {
      setState(() => _blockedReason = i18n.t(
            'Ce diagnostic ne cite aucune pièce précise : saisissez les postes du devis.',
            'This diagnosis cites no specific part: enter the quote lines.',
          ));
      return;
    }
    for (final line in _lines) {
      line.dispose();
    }
    setState(() {
      _blockedReason = null;
      _lines
        ..clear()
        ..addAll(labels.map((label) => _DraftLine(label: label)));
    });
  }

  Future<void> _save() async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final vehicle = state.selectedVehicle;
    if (vehicle == null) {
      setState(() => _blockedReason = i18n.t('Aucun véhicule sélectionné.', 'No vehicle selected.'));
      return;
    }
    final garageId = _garageId;
    if (garageId == null) {
      setState(() => _blockedReason = i18n.t('Choisissez le garage qui a remis ce devis.', 'Choose the garage that issued this quote.'));
      return;
    }

    final lines = <Map<String, Object?>>[];
    for (final line in _lines) {
      final label = line.label.text.trim();
      if (label.isEmpty) continue;
      final amount = double.tryParse(line.amount.text.replaceAll(',', '.').trim());
      if (amount == null) {
        // Refus explicite : on n'enregistre pas un poste sans montant en le
        // remplaçant par zéro. C'est la règle 1 de cet écran.
        setState(() => _blockedReason = i18n.t(
              'Enregistrement impossible : le poste « $label » n’a pas de montant. XAMOTO ne l’invente pas et n’écrit pas 0 à la place.',
              'Cannot save: the line “$label” has no amount. XAMOTO does not invent it and does not write 0 instead.',
            ));
        return;
      }
      lines.add(<String, Object?>{
        'label': label,
        'quantity': double.tryParse(line.quantity.text.replaceAll(',', '.').trim()) ?? 1,
        'unitAmount': amount,
        'currency': 'XOF',
      });
    }
    if (lines.isEmpty) {
      setState(() => _blockedReason = i18n.t('Indiquez au moins un poste du devis.', 'Enter at least one quote line.'));
      return;
    }

    setState(() {
      _saving = true;
      _blockedReason = null;
      _error = null;
    });
    try {
      await state.api.post(Api.quotes, body: <String, Object?>{
        'vehicleId': vehicle.id,
        'garageId': garageId,
        'diagnosticSessionId': _diagnosticId,
        'title': i18n.t('Devis reçu', 'Received quote'),
        'status': 'received',
        'lines': lines,
      });
      for (final line in _lines) {
        line.dispose();
      }
      setState(() {
        _lines
          ..clear()
          ..add(_DraftLine());
        _saving = false;
      });
      await _fetch(state, vehicle.id);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _saving = false;
      });
    }
  }

  Future<void> _analyse(Quote quote) async {
    final state = context.read<AppState>();
    try {
      final response = await state.api.post(Api.quoteAnalysisPath(quote.id), body: const <String, Object?>{});
      if (!mounted) return;
      setState(() {
        _analyses[quote.id] = QuoteAnalysis.fromJson(response);
        _analysisErrors.remove(quote.id);
      });
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _analysisErrors[quote.id] = error.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final vehicle = state.selectedVehicle;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Devis', 'Quotes'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Text(i18n.t(
                  'XAMOTO enregistre ce que le garage a écrit. Il ne complète aucun montant et ne juge aucun prix.',
                  'XAMOTO records what the garage wrote. It fills in no amount and judges no price.',
                )),
                ErrorBox(message: _error),
                if (vehicle == null)
                  EmptyState(
                    title: i18n.t('Aucun véhicule', 'No vehicle'),
                    message: i18n.t('Un devis se rapporte toujours à un véhicule précis.', 'A quote always refers to a specific vehicle.'),
                  )
                else ...<Widget>[
                  SectionCard(
                    title: i18n.t('Ajouter un devis reçu', 'Add a received quote'),
                    subtitle: i18n.t('Les montants viennent du garage, jamais de XAMOTO.', 'Amounts come from the garage, never from XAMOTO.'),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        DropdownButtonFormField<String>(
                          value: _garageId,
                          decoration: InputDecoration(labelText: i18n.t('Garage', 'Garage')),
                          items: <DropdownMenuItem<String>>[
                            for (final garage in _garages)
                              DropdownMenuItem<String>(value: garage.id, child: Text('${garage.name} — ${garage.city}')),
                          ],
                          onChanged: (value) => setState(() => _garageId = value),
                        ),
                        const SizedBox(height: 8),
                        DropdownButtonFormField<String>(
                          value: _diagnosticId,
                          decoration: InputDecoration(labelText: i18n.t('Rattaché au diagnostic', 'Linked to the diagnosis')),
                          items: <DropdownMenuItem<String>>[
                            for (final diagnostic in _diagnostics)
                              DropdownMenuItem<String>(
                                value: diagnostic.id,
                                child: Text('${formatDate(diagnostic.startedAt)} — ${_short(diagnostic.label)}'),
                              ),
                          ],
                          onChanged: (value) => setState(() => _diagnosticId = value),
                        ),
                        const SizedBox(height: 8),
                        TextButton(
                          onPressed: _prefillFromDiagnostic,
                          child: Text(i18n.t('Reprendre les pièces citées par le diagnostic', 'Use the parts cited by the diagnosis')),
                        ),
                        for (var index = 0; index < _lines.length; index++)
                          Padding(
                            padding: const EdgeInsets.only(top: 6),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Expanded(
                                  flex: 4,
                                  child: TextField(
                                    controller: _lines[index].label,
                                    decoration: InputDecoration(labelText: i18n.t('Poste', 'Line')),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  flex: 1,
                                  child: TextField(
                                    controller: _lines[index].quantity,
                                    keyboardType: TextInputType.number,
                                    decoration: InputDecoration(labelText: i18n.t('Qté', 'Qty')),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  flex: 2,
                                  child: TextField(
                                    controller: _lines[index].amount,
                                    keyboardType: TextInputType.number,
                                    decoration: InputDecoration(labelText: i18n.t('Montant (FCFA)', 'Amount (XOF)')),
                                  ),
                                ),
                                IconButton(
                                  tooltip: i18n.t('Retirer ce poste', 'Remove this line'),
                                  onPressed: _lines.length == 1 ? null : () => _removeLine(index),
                                  icon: const Icon(Icons.delete_outline),
                                ),
                              ],
                            ),
                          ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 8,
                          children: <Widget>[
                            TextButton.icon(
                              onPressed: () => setState(() => _lines.add(_DraftLine())),
                              icon: const Icon(Icons.add),
                              label: Text(i18n.t('Ajouter un poste', 'Add a line')),
                            ),
                            FilledButton(
                              onPressed: _saving ? null : _save,
                              child: Text(_saving ? i18n.t('Enregistrement…', 'Saving…') : i18n.t('Enregistrer le devis', 'Save the quote')),
                            ),
                          ],
                        ),
                        if (_blockedReason != null) ...<Widget>[
                          const SizedBox(height: 6),
                          Text(_blockedReason!, style: const TextStyle(color: Color(0xFF8E1B12))),
                        ],
                        const SizedBox(height: 6),
                        Text(
                          i18n.t(
                            'Un poste sans montant n’est pas enregistré : XAMOTO préfère un devis incomplet à un prix inventé.',
                            'A line without an amount is not saved: XAMOTO prefers an incomplete quote to an invented price.',
                          ),
                          style: const TextStyle(fontStyle: FontStyle.italic),
                        ),
                      ],
                    ),
                  ),
                  if (_quotes.isEmpty)
                    SectionCard(
                      title: i18n.t('Aucun devis enregistré', 'No quote recorded'),
                      child: Text(i18n.t(
                        'Ajoutez le devis remis par le garage pour le confronter aux mesures du véhicule.',
                        'Add the quote issued by the garage to confront it with the vehicle measurements.',
                      )),
                    )
                  else
                    for (final quote in _quotes)
                      SectionCard(
                        title: _garageName(quote.garageId),
                        subtitle: '${_statusLabel(i18n, quote.status)} · ${formatDate(quote.receivedAt ?? quote.requestedAt)}',
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            for (final line in quote.lines)
                              DataRow(
                                label: line.hasQuantity ? '${line.label} × ${line.quantityText}' : line.label,
                                value: line.unitAmountText,
                              ),
                            const SizedBox(height: 4),
                            DataRow(label: i18n.t('Total', 'Total'), value: quote.totalText),
                            if (quote.factualSummary != null && quote.factualSummary!.isNotEmpty) ...<Widget>[
                              const SizedBox(height: 4),
                              Text(quote.factualSummary!, style: const TextStyle(fontStyle: FontStyle.italic)),
                            ],
                            const SizedBox(height: 8),
                            OutlinedButton.icon(
                              onPressed: () => _analyse(quote),
                              icon: const Icon(Icons.fact_check_outlined),
                              label: Text(i18n.t('Confronter aux mesures du véhicule', 'Confront with the vehicle measurements')),
                            ),
                            ErrorBox(message: _analysisErrors[quote.id]),
                            if (_analyses[quote.id] != null) ..._analysisWidgets(i18n, _analyses[quote.id]!),
                          ],
                        ),
                      ),
                ],
              ],
            ),
    );
  }

  void _removeLine(int index) {
    setState(() {
      _lines.removeAt(index).dispose();
    });
  }

  List<Widget> _analysisWidgets(I18n i18n, QuoteAnalysis analysis) {
    return <Widget>[
      const Divider(),
      Text(i18n.t('Ce que les données du véhicule soutiennent', 'What the vehicle data supports')),
      const SizedBox(height: 4),
      DataRow(
        label: i18n.t('Postes soutenus par une mesure', 'Lines supported by a measurement'),
        value: '${analysis.summary.linesLinkedToMeasuredData} / ${analysis.summary.totalLines}',
      ),
      DataRow(label: i18n.t('Postes sans lien avec une mesure', 'Lines with no link to a measurement'), value: '${analysis.summary.linesNotLinked}'),
      DataRow(label: i18n.t('Origine des données', 'Data origin'), value: analysis.summary.dataOrigin),
      DataRow(label: i18n.t('Certitude de cette analyse', 'Certainty of this analysis'), value: analysis.summary.certainty),
      const SizedBox(height: 6),
      for (final line in analysis.analysis)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Icon(
                    line.linkedToMeasuredData ? Icons.check_circle_outline : Icons.help_outline,
                    size: 18,
                    color: line.linkedToMeasuredData ? const Color(0xFF2E7D32) : const Color(0xFF6D6D6D),
                  ),
                  const SizedBox(width: 6),
                  Expanded(child: Text(line.label)),
                ],
              ),
              if (line.matchedElements.isNotEmpty)
                Text(
                  '${i18n.t('Soutenu par', 'Supported by')} : ${line.matchedElements.join(', ')}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              if (line.questionToAsk != null && line.questionToAsk!.isNotEmpty)
                Text('${i18n.t('À demander', 'To ask')} : ${line.questionToAsk}', style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      if (analysis.noticeFr != null) ...<Widget>[
        const SizedBox(height: 6),
        Text(analysis.noticeFr!, style: const TextStyle(fontStyle: FontStyle.italic)),
      ],
      if (analysis.questionsFr.isNotEmpty) ...<Widget>[
        const SizedBox(height: 6),
        Text(i18n.t('Questions à poser au garage', 'Questions to ask the garage')),
        for (final question in analysis.questionsFr) Text('• $question'),
      ],
      const SizedBox(height: 6),
      Text(
        i18n.t(
          'Un poste sans lien avec les mesures n’est pas une faute : freinage, climatisation et carrosserie ne sont pas lisibles en OBD.',
          'A line with no link to the measurements is not a fault: braking, air conditioning and bodywork are not readable over OBD.',
        ),
        style: const TextStyle(fontStyle: FontStyle.italic),
      ),
    ];
  }
}
