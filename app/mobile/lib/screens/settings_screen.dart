/// XAMOTO — Réglages : langue, synchronisation, état de la version wolof.
///
/// Deux informations sont volontairement placées ici plutôt que cachées :
/// l'état réel de la traduction wolof, et ce qui reste à synchroniser. Ce sont
/// les deux endroits où un produit a coutume de mentir par omission.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/banners.dart';
import '../widgets/layout.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final report = I18n.wolofReport();

    return Scaffold(
      appBar: AppBar(title: Text(i18n.t('Réglages', 'Settings'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          SectionCard(
            title: i18n.t('Langue', 'Language'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                for (final locale in I18n.locales)
                  RadioListTile<String>(
                    value: locale,
                    groupValue: state.locale.locale,
                    onChanged: (value) => state.setLocale(value ?? 'fr'),
                    title: Text(switch (locale) {
                      'en' => 'English',
                      'wo' => 'Wolof',
                      _ => 'Français',
                    }),
                  ),
                if (state.locale.isWolof) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(i18n.wolofNotice, style: const TextStyle(fontStyle: FontStyle.italic)),
                  const SizedBox(height: 8),
                  DataRow(label: i18n.t('Entrées du catalogue', 'Catalogue entries'), value: '${report.total}'),
                  DataRow(label: i18n.t('Affichables en wolof', 'Displayable in Wolof'), value: '${report.displayable}'),
                  DataRow(label: i18n.t('Relues par un locuteur natif', 'Reviewed by a native speaker'), value: '${report.reviewed}'),
                  DataRow(
                    label: i18n.t('Consignes de sécurité en attente de relecture', 'Safety strings awaiting review'),
                    value: '${report.safetyPending}',
                  ),
                  const SizedBox(height: 8),
                  Text(i18n.t(
                    'Une consigne de sécurité non relue n’est pas affichée en wolof : elle apparaît en français, et c’est écrit ici.',
                    'Safety guidance that has not been reviewed is not shown in Wolof: it appears in French, and that is stated here.',
                  ), style: const TextStyle(fontSize: 12)),
                ],
              ],
            ),
          ),

          SectionCard(
            title: i18n.t('Synchronisation', 'Synchronisation'),
            subtitle: i18n.t(
              'L’application fonctionne hors ligne : les observations partent dès que le réseau revient.',
              'The app works offline: observations are sent as soon as the network returns.',
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                DataRow(label: i18n.t('En attente', 'Waiting'), value: '${state.pendingCount}'),
                DataRow(
                  label: i18n.t('Connexion', 'Connection'),
                  value: switch (state.connection) {
                    ConnectionState.online => i18n.t('en ligne', 'online'),
                    ConnectionState.offline => i18n.t('hors ligne', 'offline'),
                    _ => i18n.t('inconnue', 'unknown'),
                  },
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  onPressed: () async {
                    final result = await state.syncNow();
                    if (!context.mounted) return;
                    // Le résumé est dans la langue de rédaction : la synchronisation
                    // n'est pas une consigne de sécurité, elle n'a pas à être traduite.
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(i18n.contentLocale == 'en' ? result.summaryEn : result.summaryFr)),
                    );
                  },
                  icon: const Icon(Icons.sync),
                  label: Text(i18n.t('Synchroniser maintenant', 'Sync now')),
                ),
              ],
            ),
          ),

          if (state.connection == ConnectionState.offline)
            OfflineBanner(i18n: i18n, pendingCount: state.pendingCount),

          SectionCard(
            title: i18n.t('À propos', 'About'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const Text('XAMOTO — Connaître sa voiture.'),
                Text(i18n.t('Comprendre · Diagnostiquer · Agir', 'Understand · Diagnose · Act')),
                const SizedBox(height: 8),
                Text(i18n.t(
                  'XAMOTO aide à comprendre un véhicule. Il ne remplace pas un professionnel et n’engage aucune garantie sur l’état du véhicule.',
                  'XAMOTO helps understand a vehicle. It does not replace a professional and gives no guarantee on the vehicle condition.',
                ), style: const TextStyle(fontSize: 12)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
