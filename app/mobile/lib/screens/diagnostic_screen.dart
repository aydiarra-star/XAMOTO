/// XAMOTO — Diagnostic.
///
/// Cet écran affiche une conclusion produite par le moteur du serveur. Il ne
/// calcule rien, ne classe rien et ne « complète » rien : s'il manque une donnée,
/// il le dit, et s'il n'y a pas de conclusion possible, il l'écrit aussi.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../i18n/strings.dart';
import '../routes.dart';
import '../state/app_state.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class DiagnosticScreen extends StatelessWidget {
  const DiagnosticScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final diagnostic = state.lastDiagnostic;

    if (diagnostic == null) {
      return Scaffold(
        appBar: AppBar(title: Text(i18n.nav('nav.diagnostic'))),
        body: EmptyState(
          title: i18n.t('Aucun diagnostic enregistré', 'No stored diagnosis'),
          message: i18n.t(
            'Lancez un scan : sans mesure, XAMOTO n’a rien à analyser.',
            'Run a scan: without measurements, XAMOTO has nothing to analyse.',
          ),
          action: FilledButton(onPressed: () => Navigator.pushNamed(context, Routes.scan), child: Text(i18n.t('Aller au scan', 'Go to scan'))),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(i18n.nav('nav.diagnostic')),
        actions: <Widget>[
          IconButton(
            tooltip: i18n.t('Rapport', 'Report'),
            icon: const Icon(Icons.picture_as_pdf),
            onPressed: () => Navigator.pushNamed(context, Routes.report),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          SectionCard(
            title: i18n.t('Conclusion', 'Conclusion'),
            trailing: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                CertaintyBadge(certainty: diagnostic.certainty, i18n: i18n),
                const SizedBox(height: 4),
                SafetyBadge(safety: diagnostic.safety, i18n: i18n),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(i18n.locale == 'en' ? diagnostic.conclusionEn : diagnostic.conclusionFr),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.pushNamed(context, Routes.canIDrive),
                  child: Text(i18n.t('Puis-je rouler ?', 'Can I drive?')),
                ),
              ],
            ),
          ),

          if (diagnostic.findings.isNotEmpty)
            SectionCard(
              title: i18n.t('Ce que XAMOTO observe', 'What XAMOTO observes'),
              child: Column(
                children: <Widget>[
                  for (final finding in diagnostic.findings)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(i18n.locale == 'en' ? finding.titleEn : finding.titleFr),
                      subtitle: Text(i18n.locale == 'en' ? finding.detailEn : finding.detailFr),
                      trailing: CertaintyBadge(certainty: finding.certainty, i18n: i18n),
                    ),
                ],
              ),
            ),

          SectionCard(
            title: i18n.t('Hypothèses', 'Hypotheses'),
            subtitle: i18n.t(
              'Classées par score. Aucune n’est une certitude : chacune dit son niveau.',
              'Ranked by score. None is a certainty: each states its level.',
            ),
            child: Column(
              children: <Widget>[
                if (diagnostic.hypotheses.isEmpty)
                  Text(i18n.t(
                    'Aucune cause ne peut être proposée à partir des données disponibles.',
                    'No cause can be proposed from the available data.',
                  )),
                for (final hypothesis in diagnostic.hypotheses)
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(i18n.locale == 'en' ? hypothesis.labelEn : hypothesis.labelFr),
                    subtitle: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('${i18n.t('Score', 'Score')} : ${(hypothesis.score * 100).round()} %'),
                        if (hypothesis.reasoning.isNotEmpty) Text(hypothesis.reasoning.first),
                        if (hypothesis.confirmingTest != null)
                          Text(
                            i18n.t('Test nécessaire avant de conclure', 'Test required before concluding'),
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                      ],
                    ),
                    trailing: CertaintyBadge(certainty: hypothesis.certainty, i18n: i18n),
                  ),
                const SizedBox(height: 8),
                OutlinedButton(
                  onPressed: () => Navigator.pushNamed(context, Routes.guidedTests),
                  child: Text(i18n.t('Voir les tests guidés', 'View guided tests')),
                ),
              ],
            ),
          ),

          if (diagnostic.isIndeterminate)
            SectionCard(
              title: i18n.t('Données insuffisantes', 'Insufficient data'),
              child: Text(i18n.t(
                'XAMOTO préfère écrire « je ne sais pas » plutôt que de proposer une cause qu’aucune donnée ne soutient.',
                'XAMOTO prefers to say “I don’t know” rather than propose a cause no data supports.',
              )),
            ),
        ],
      ),
    );
  }
}
