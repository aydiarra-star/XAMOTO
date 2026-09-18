/// XAMOTO — Badges de niveaux (§10, §11, §33).
///
/// Ces badges ne sont pas décoratifs : ils portent l'information la plus
/// importante de l'écran. Un écran qui affiche une hypothèse sans son badge de
/// certitude est un écran qui ment.
library;

import 'package:flutter/material.dart';

import '../core/data_origin.dart';
import '../core/levels.dart';
import '../i18n/strings.dart';

class CertaintyBadge extends StatelessWidget {
  const CertaintyBadge({super.key, required this.certainty, required this.i18n});

  final CertaintyLevel certainty;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return _Badge(
      label: i18n.certainty(certainty),
      color: switch (certainty) {
        CertaintyLevel.confirmed => const Color(0xFF1B5E20),
        CertaintyLevel.stronglyCompatible => const Color(0xFF2E7D32),
        CertaintyLevel.possible => const Color(0xFF8D6E00),
        CertaintyLevel.undeterminable => const Color(0xFF6D6D6D),
        CertaintyLevel.unavailable => const Color(0xFF424242),
      },
    );
  }
}

class SafetyBadge extends StatelessWidget {
  const SafetyBadge({super.key, required this.safety, required this.i18n});

  final SafetyLevel safety;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    return _Badge(
      label: '${safety.icon} ${i18n.safety(safety)}',
      color: switch (safety) {
        SafetyLevel.normal => const Color(0xFF1B5E20),
        SafetyLevel.attention => const Color(0xFF8D6E00),
        SafetyLevel.important => const Color(0xFFE65100),
        SafetyLevel.critical => const Color(0xFFB71C1C),
      },
    );
  }
}

/// Provenance d'une valeur : affichée à côté de la mesure, jamais ailleurs.
class OriginTag extends StatelessWidget {
  const OriginTag({super.key, required this.origin, required this.i18n});

  final DataOrigin origin;
  final I18n i18n;

  @override
  Widget build(BuildContext context) {
    final isSimulated = origin.isSimulated;
    return _Badge(
      label: i18n.origin(origin),
      color: isSimulated ? const Color(0xFF4527A0) : const Color(0xFF37474F),
      dense: true,
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color, this.dense = false});

  final String label;
  final Color color;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 6 : 10, vertical: dense ? 2 : 4),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(dense ? 4 : 6)),
      child: Text(
        label,
        style: TextStyle(color: Colors.white, fontSize: dense ? 11 : 12, fontWeight: FontWeight.w600, letterSpacing: 0.4),
      ),
    );
  }
}
