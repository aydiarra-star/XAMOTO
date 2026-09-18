/// XAMOTO — Bandeaux d'honnêteté : simulation, hors ligne, système non lisible.
///
/// Ces bandeaux ne sont pas des avertissements juridiques : ce sont des
/// informations dont l'utilisateur a besoin pour interpréter ce qu'il lit.
library;

import 'package:flutter/material.dart';

import '../core/disclaimer.dart';
import '../core/levels.dart';
import '../i18n/strings.dart';

/// §47-2 : une donnée simulée est signalée AVANT d'être lue.
class SimulationBanner extends StatelessWidget {
  const SimulationBanner({super.key, required this.i18n});

  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF4527A0), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(i18n.t(kSimulationFr, kSimulationEn), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 1)),
          const SizedBox(height: 4),
          Text(i18n.t(kSimulationNoticeFr, kSimulationNoticeEn), style: const TextStyle(color: Colors.white)),
        ],
      ),
    );
  }
}

/// §32 : le mode hors ligne est un état normal, annoncé.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({super.key, required this.i18n, required this.pendingCount, this.oldestMinutes});

  final I18n i18n;
  final int pendingCount;
  final int? oldestMinutes;

  @override
  Widget build(BuildContext context) {
    final detail = pendingCount == 0
        ? i18n.t('Aucune donnée en attente.', 'No data waiting.')
        : i18n.t('$pendingCount opération(s) en attente d’envoi.', '$pendingCount operation(s) waiting to be sent.');
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFF37474F), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(i18n.t('HORS LIGNE', 'OFFLINE'), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, letterSpacing: 1)),
          const SizedBox(height: 4),
          Text(detail, style: const TextStyle(color: Colors.white)),
        ],
      ),
    );
  }
}

/// §15 : ce que l'OBD ne lit pas est annoncé, et n'est jamais « sain ».
class NotReadableNotice extends StatelessWidget {
  const NotReadableNotice({super.key, required this.i18n, required this.systems});

  final I18n i18n;
  final List<String> systems;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xFFFFF3E0), borderRadius: BorderRadius.circular(8)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(i18n.t(kNotReadableFr, kNotReadableEn), style: const TextStyle(fontWeight: FontWeight.w600)),
          if (systems.isNotEmpty) ...<Widget>[
            const SizedBox(height: 6),
            Text(i18n.t('Systèmes concernés : ${systems.join(', ')}', 'Systems involved: ${systems.join(', ')}')),
          ],
        ],
      ),
    );
  }
}

/// Avertissement de non-garantie (§12, §47-10) : il accompagne « Puis-je rouler ? ».
class NoGuaranteeNotice extends StatelessWidget {
  const NoGuaranteeNotice({super.key, required this.i18n});

  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Text(
        i18n.t(kNoGuaranteeFr, kNoGuaranteeEn),
        style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic),
      ),
    );
  }
}

/// Bandeau du niveau de sécurité global : la couleur ne remplace jamais le texte.
class SafetySummaryBar extends StatelessWidget {
  const SafetySummaryBar({super.key, required this.safety, required this.i18n});

  final SafetyLevel safety;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.black.withValues(alpha: 0.05), borderRadius: BorderRadius.circular(8)),
      child: Row(
        children: <Widget>[
          Text(safety.icon, style: const TextStyle(fontSize: 20)),
          const SizedBox(width: 8),
          Expanded(child: Text('${i18n.safety(safety)}', style: const TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}
