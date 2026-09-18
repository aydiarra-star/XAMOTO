/// XAMOTO — Rapport de diagnostic : partage et QR (§23, §28).
///
/// Un rapport contient des conclusions, pas des certitudes : chaque tableau du
/// document porte ses niveaux, et les données manquantes y figurent comme
/// manquantes.
///
/// Le partage est un ACTE explicite et réversible : l'utilisateur demande la
/// création du rapport, XAMOTO lui montre le lien et le code QR, et la
/// révocation est à un bouton. Effacer une preuve ou publier une donnée n'est
/// jamais un effet de bord.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/banners.dart';
import '../widgets/layout.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  String? _shareUrl;
  String? _reportId;
  String? _error;
  String? _notice;
  bool _busy = false;
  bool _revoked = false;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final diagnostic = state.lastDiagnostic;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.nav('nav.reports'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          if (diagnostic == null)
            Text(i18n.t('Aucun diagnostic à rapporter.', 'No diagnosis to report.'))
          else
            SectionCard(
              title: i18n.t('Créer le rapport', 'Create the report'),
              subtitle: i18n.t(
                'Le rapport reprend le diagnostic, les données manquantes et l’avertissement de non-garantie.',
                'The report includes the diagnosis, the missing data and the no-guarantee notice.',
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  FilledButton.icon(
                    onPressed: _busy ? null : () => _create(state),
                    icon: const Icon(Icons.description),
                    label: Text(i18n.t('Créer le rapport', 'Create the report')),
                  ),
                  if (_busy) const Padding(padding: EdgeInsets.only(top: 10), child: LinearProgressIndicator()),
                  if (_notice != null) ...<Widget>[
                    const SizedBox(height: 10),
                    Text(_notice!, style: const TextStyle(fontStyle: FontStyle.italic)),
                  ],
                  if (_reportId != null) ...<Widget>[
                    const SizedBox(height: 10),
                    DataRow(label: i18n.t('Référence', 'Reference'), value: _reportId!),
                  ],
                  if (_shareUrl != null && !_revoked) ...<Widget>[
                    const SizedBox(height: 10),
                    Text(i18n.t(
                      'Ce lien a été créé parce que vous l’avez demandé. Il ne contient aucune donnée personnelle et peut être révoqué à tout moment.',
                      'This link was created because you asked for it. It contains no personal data and can be revoked at any time.',
                    )),
                    const SizedBox(height: 10),
                    Center(
                      child: QrImageView(
                        data: _shareUrl!,
                        size: 180,
                        semanticsLabel: i18n.t('Code QR du rapport', 'Report QR code'),
                      ),
                    ),
                    const SizedBox(height: 8),
                    SelectableText(_shareUrl!),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _busy ? null : () => _revoke(state),
                      icon: const Icon(Icons.link_off),
                      label: Text(i18n.t('Révoquer le lien de partage', 'Revoke the sharing link')),
                    ),
                  ],
                  if (_revoked)
                    Padding(
                      padding: const EdgeInsets.only(top: 10),
                      child: Text(i18n.t(
                        'Le lien de partage a été révoqué. Le rapport reste disponible pour vous.',
                        'The sharing link has been revoked. The report remains available to you.',
                      )),
                    ),
                  ErrorBox(message: _error),
                ],
              ),
            ),
          NoGuaranteeNotice(i18n: i18n),
        ],
      ),
    );
  }

  Future<void> _create(AppState state) async {
    final diagnostic = state.lastDiagnostic;
    final vehicle = state.selectedVehicle;
    if (diagnostic == null || vehicle == null) return;

    setState(() {
      _busy = true;
      _error = null;
      _notice = null;
    });
    try {
      // `POST /api/reports` attend le VÉHICULE et la SESSION : le rapport
      // rassemble les données réellement disponibles au moment du diagnostic.
      final report = await state.api.post(Api.reports, body: <String, Object?>{
        'vehicleId': vehicle.id,
        'sessionId': diagnostic.id,
        'kind': 'diagnostic',
      });
      final id = report['id'] as String?;
      setState(() {
        _reportId = id;
        _shareUrl = report['publicUrl'] as String?;
        _notice = report['noticeFr'] as String?;
        _revoked = false;
      });
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Révocation : le lien cesse de fonctionner, le rapport reste à l'utilisateur.
  Future<void> _revoke(AppState state) async {
    final id = _reportId;
    if (id == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await state.api.delete(Api.reportSharePath(id));
      setState(() {
        _revoked = true;
        _shareUrl = null;
      });
    } on ApiException catch (error) {
      setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}
