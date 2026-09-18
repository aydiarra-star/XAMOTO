/// XAMOTO — Entretien.
///
/// Le plan d'entretien vient du serveur avec ses sources et ses plages. XAMOTO ne
/// connaît pas d'intervalle constructeur pour tous les véhicules : quand il n'en
/// a pas, il l'écrit au lieu de recopier une valeur approximative.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/vehicle.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  MaintenancePlan? _plan;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    final vehicle = state.selectedVehicle;
    if (vehicle == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final response = await state.api.get(Api.vehicleMaintenancePath(vehicle.id));
      setState(() {
        _plan = MaintenancePlan.fromJson(response);
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
      appBar: AppBar(title: Text(i18n.nav('nav.maintenance'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                ErrorBox(message: _error),
                if (_plan?.notice != null) Text(_plan!.notice!, style: const TextStyle(fontStyle: FontStyle.italic)),
                for (final item in _plan?.items ?? const <MaintenanceItem>[])
                  SectionCard(
                    title: en ? item.labelEn : item.labelFr,
                    subtitle: item.nextDueKm == null ? null : '${i18n.t('Prochain', 'Next')} : ${formatKm(item.nextDueKm)}',
                    trailing: _statusBadge(item.status, i18n),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        if (item.notesFr != null) Text(item.notesFr!),
                        if (item.explanationFr != null) Text(item.explanationFr!, style: const TextStyle(fontSize: 12)),
                        if (item.sourceId != null) ...<Widget>[
                          const SizedBox(height: 6),
                          Text('${i18n.t('Source', 'Source')} : ${item.sourceId}', style: const TextStyle(fontSize: 11)),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
    );
  }

  Widget _statusBadge(String status, I18n i18n) {
    final label = switch (status) {
      'ok' => i18n.t('À jour', 'Up to date'),
      'soon' => i18n.t('Bientôt', 'Soon'),
      'overdue' => i18n.t('En retard', 'Overdue'),
      _ => i18n.t('Inconnu', 'Unknown'),
    };
    final color = switch (status) {
      'ok' => const Color(0xFF1B5E20),
      'soon' => const Color(0xFF8D6E00),
      'overdue' => const Color(0xFFB71C1C),
      _ => const Color(0xFF424242),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 12)),
    );
  }
}
