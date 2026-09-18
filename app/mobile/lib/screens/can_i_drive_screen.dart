/// XAMOTO — « Puis-je rouler ? » (§12).
///
/// Trois choses ne doivent jamais manquer sur cet écran : la réponse, ce qu'il
/// faut vérifier avant de partir, et l'avertissement de non-garantie. Une
/// réponse rassurante sans avertissement serait un mensonge par omission.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/models/diagnostic.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/banners.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class CanIDriveScreen extends StatelessWidget {
  const CanIDriveScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final CanIDrive? answer = state.lastDiagnostic?.canIDrive;

    if (answer == null) {
      return Scaffold(
        appBar: AppBar(title: Text(i18n.t('Puis-je rouler ?', 'Can I drive?'))),
        body: EmptyState(
          title: i18n.t('Pas encore de réponse', 'No answer yet'),
          message: i18n.t(
            'Cette réponse s’appuie sur un diagnostic : lancez d’abord un scan.',
            'This answer relies on a diagnosis: run a scan first.',
          ),
        ),
      );
    }

    final en = i18n.locale == 'en';
    final level = answer.mustNotDrive;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Puis-je rouler ?', 'Can I drive?'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          SectionCard(
            title: en ? answer.headlineEn : answer.headlineFr,
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: level ? const Color(0xFFB71C1C) : const Color(0xFF1B5E20),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                level ? i18n.t('DÉCONSEILLÉ', 'NOT ADVISED') : i18n.t('AUTORISÉ SOUS CONDITIONS', 'ALLOWED WITH CONDITIONS'),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
              ),
            ),
            child: CertaintyBadge(certainty: answer.certainty, i18n: i18n),
          ),

          if ((en ? answer.whyEn : answer.whyFr).isNotEmpty)
            SectionCard(
              title: i18n.t('Pourquoi', 'Why'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  for (final reason in (en ? answer.whyEn : answer.whyFr)) Text('• $reason'),
                ],
              ),
            ),

          if ((en ? answer.toCheckEn : answer.toCheckFr).isNotEmpty)
            SectionCard(
              title: i18n.t('À vérifier avant de partir', 'Check before leaving'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  for (final item in (en ? answer.toCheckEn : answer.toCheckFr)) Text('• $item'),
                ],
              ),
            ),

          if ((en ? answer.avoidEn : answer.avoidFr).isNotEmpty)
            SectionCard(
              title: i18n.t('À éviter', 'To avoid'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  for (final item in (en ? answer.avoidEn : answer.avoidFr)) Text('• $item'),
                ],
              ),
            ),

          if (answer.missingData.isNotEmpty)
            SectionCard(
              title: i18n.t('Ce qui manque pour être plus sûr', 'What is missing to be more certain'),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  for (final item in answer.missingData) Text('• $item'),
                ],
              ),
            ),

          NoGuaranteeNotice(i18n: i18n),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}
