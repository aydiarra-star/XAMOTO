/// XAMOTO — Alertes (§22).
///
/// Une alerte XAMOTO n'est pas une notification marketing : elle signale une
/// évolution mesurée (sécurité, entretien dû, défaut réapparu) et renvoie à sa
/// source. L'écran n'invente aucun niveau : le serveur envoie `level`, qui
/// devient un badge de sécurité (§11).
///
/// « Marquer comme lu » est le seul geste d'écriture : XAMOTO ne supprime pas
/// une alerte de sécurité, il la laisse dans l'historique du véhicule.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/vehicle.dart';
import '../core/format.dart';
import '../core/levels.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  List<VehicleAlert> _alerts = <VehicleAlert>[];
  int _unread = 0;
  String? _error;
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    try {
      final response = await state.api.get(Api.alerts);
      if (!mounted) return;
      setState(() {
        _alerts = (response['alerts'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(VehicleAlert.fromJson)
            .toList();
        _unread = (response['unread'] as num?)?.toInt() ?? _alerts.where((alert) => alert.isUnread).length;
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

  Future<void> _markAllRead() async {
    final state = context.read<AppState>();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await state.api.post(Api.alertsRead, body: const <String, Object?>{'all': true});
      if (!mounted) return;
      setState(() => _busy = false);
      await _load();
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

    return Scaffold(
      appBar: AppBar(
        title: Text(i18n.t('Alertes', 'Alerts')),
        actions: <Widget>[
          if (_unread > 0)
            TextButton(
              onPressed: _busy ? null : _markAllRead,
              child: Text(i18n.t('Tout lire', 'Mark all read')),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                Text(i18n.t(
                  'Une alerte reprend une donnée mesurée ou une échéance d’entretien. Elle indique toujours d’où elle vient.',
                  'An alert reflects a measured value or a maintenance due date. It always states where it comes from.',
                )),
                ErrorBox(message: _error),
                if (_alerts.isEmpty)
                  EmptyState(
                    title: i18n.t('Aucune alerte', 'No alert'),
                    message: i18n.t('L’absence d’alerte ne veut pas dire « véhicule sain » : cela veut dire qu’aucun signal n’a été mesuré.', 'No alert does not mean “healthy vehicle”: it means no signal was measured.'),
                  )
                else
                  for (final alert in _alerts)
                    SectionCard(
                      title: en ? alert.titleEn : alert.titleFr,
                      subtitle: formatDateTime(alert.createdAt),
                      trailing: SafetyBadge(safety: SafetyLevel.parse(alert.level), i18n: i18n),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          Text(en ? alert.bodyEn : alert.bodyFr),
                          const SizedBox(height: 6),
                          Text(
                            alert.isUnread ? i18n.t('Non lue', 'Unread') : i18n.t('Lue', 'Read'),
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
              ],
            ),
    );
  }
}
