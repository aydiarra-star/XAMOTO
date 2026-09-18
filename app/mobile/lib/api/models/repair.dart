/// XAMOTO — Réparations, comparaison avant/après (§19) et inspection (§24).
///
/// Règle de lecture : un verdict de comparaison n'est jamais « réparé » tout
/// court. Il porte un niveau de certitude (§10) et il est relativisé par le nombre
/// de kilomètres et de cycles de conduite effectués depuis l'intervention : un
/// défaut effacé au garage peut revenir après quelques trajets.
library;

import '../../core/format.dart';
import '../../core/levels.dart';

class RepairPart {
  const RepairPart({required this.label, this.quantity, this.reference});

  final String label;
  final double? quantity;
  final String? reference;

  factory RepairPart.fromJson(Map<String, dynamic> json) => RepairPart(
        label: json['label'] as String? ?? '',
        quantity: (json['quantity'] as num?)?.toDouble(),
        reference: json['reference'] as String?,
      );
}

class Repair {
  const Repair({
    required this.id,
    required this.vehicleId,
    required this.description,
    required this.partsReplaced,
    this.diagnosticSessionId,
    this.costAmount,
    this.currency = 'XOF',
    this.garageId,
    this.performedAt,
    this.odometerKm,
  });

  final String id;
  final String vehicleId;
  final String? diagnosticSessionId;
  final String description;
  final List<RepairPart> partsReplaced;

  /// `null` = coût non communiqué. XAMOTO n'estime pas un prix « normal ».
  final double? costAmount;
  final String currency;
  final String? garageId;
  final DateTime? performedAt;
  final int? odometerKm;

  String get costText => costAmount == null ? 'coût non renseigné' : '$currency ${formatNumber(costAmount, decimals: 0)}';
  String get odometerText => odometerKm == null ? 'kilométrage non renseigné' : formatKm(odometerKm);

  factory Repair.fromJson(Map<String, dynamic> json) => Repair(
        id: json['id'] as String? ?? '',
        vehicleId: json['vehicleId'] as String? ?? '',
        diagnosticSessionId: json['diagnosticSessionId'] as String?,
        description: json['description'] as String? ?? '',
        partsReplaced: (json['partsReplaced'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(RepairPart.fromJson)
            .toList(),
        costAmount: (json['costAmount'] as num?)?.toDouble(),
        currency: json['currency'] as String? ?? 'XOF',
        garageId: json['garageId'] as String?,
        performedAt: json['performedAt'] is String ? DateTime.tryParse(json['performedAt'] as String) : null,
        odometerKm: (json['odometerKm'] as num?)?.toInt(),
      );
}

class ChangedValue {
  const ChangedValue({required this.key, required this.label, this.before, this.after, this.unit = '', this.improved = false});

  final String key;
  final String label;
  final double? before;
  final double? after;
  final String unit;

  /// Le serveur juge « amélioré » selon le sens attendu du PID (une température ne
  /// s'améliore pas en montant). L'application affiche ce jugement, elle ne le refait pas.
  final bool improved;

  String get beforeText => before == null ? 'non disponible' : formatNumber(before, unit: unit);
  String get afterText => after == null ? 'non disponible' : formatNumber(after, unit: unit);

  factory ChangedValue.fromJson(Map<String, dynamic> json) => ChangedValue(
        key: json['key'] as String? ?? '',
        label: json['label'] as String? ?? '',
        before: (json['before'] as num?)?.toDouble(),
        after: (json['after'] as num?)?.toDouble(),
        unit: json['unit'] as String? ?? '',
        improved: json['improved'] as bool? ?? false,
      );
}

class RepairComparison {
  const RepairComparison({
    required this.id,
    required this.verdict,
    required this.certainty,
    required this.summaryFr,
    required this.summaryEn,
    required this.dtcBefore,
    required this.dtcAfter,
    required this.dtcResolved,
    required this.dtcRemaining,
    required this.dtcNew,
    required this.valuesChanged,
    required this.dataOrigin,
    this.createdAt,
  });

  final String id;

  /// 'resolved' | 'improved' | 'unchanged' | 'worse' | 'insufficient_data'
  final String verdict;
  final CertaintyLevel certainty;
  final String summaryFr;
  final String summaryEn;
  final List<String> dtcBefore;
  final List<String> dtcAfter;
  final List<String> dtcResolved;
  final List<String> dtcRemaining;
  final List<String> dtcNew;
  final List<ChangedValue> valuesChanged;
  final String dataOrigin;
  final DateTime? createdAt;

  factory RepairComparison.fromJson(Map<String, dynamic> json) => RepairComparison(
        id: json['id'] as String? ?? '',
        verdict: json['verdict'] as String? ?? 'insufficient_data',
        certainty: CertaintyLevel.parse(json['certainty'] as String?),
        summaryFr: json['summaryFr'] as String? ?? '',
        summaryEn: json['summaryEn'] as String? ?? '',
        dtcBefore: (json['dtcBefore'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        dtcAfter: (json['dtcAfter'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        dtcResolved: (json['dtcResolved'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        dtcRemaining: (json['dtcRemaining'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        dtcNew: (json['dtcNew'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        valuesChanged: (json['valuesChanged'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(ChangedValue.fromJson)
            .toList(),
        dataOrigin: json['dataOrigin'] as String? ?? 'unknown',
        createdAt: json['createdAt'] is String ? DateTime.tryParse(json['createdAt'] as String) : null,
      );
}

class InspectionItem {
  const InspectionItem({required this.key, required this.labelFr, required this.labelEn, required this.verdict, this.detail});

  final String key;
  final String labelFr;
  final String labelEn;

  /// 'ok' | 'attention' | 'red_flag' | 'not_tested'
  final String verdict;
  final String? detail;

  factory InspectionItem.fromJson(Map<String, dynamic> json) => InspectionItem(
        key: json['key'] as String? ?? '',
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        verdict: json['verdict'] as String? ?? 'not_tested',
        detail: json['detail'] as String?,
      );
}

/// Scores d'une inspection. `null` = la donnée n'a pas pu être établie : XAMOTO
/// écrit « non établi » plutôt que d'afficher un pourcentage inventé.
class InspectionScores {
  const InspectionScores({this.overall, this.engine, this.emissions, this.electrical, this.dataCoherence});

  final int? overall;
  final int? engine;
  final int? emissions;
  final int? electrical;
  final int? dataCoherence;

  String textOf(int? value) => value == null ? 'non établi' : '$value / 100';

  factory InspectionScores.fromJson(Map<String, dynamic> json) => InspectionScores(
        overall: (json['overall'] as num?)?.toInt(),
        engine: (json['engine'] as num?)?.toInt(),
        emissions: (json['emissions'] as num?)?.toInt(),
        electrical: (json['electrical'] as num?)?.toInt(),
        dataCoherence: (json['dataCoherence'] as num?)?.toInt(),
      );
}

class Inspection {
  const Inspection({
    required this.id,
    required this.scores,
    required this.checklist,
    required this.notes,
    this.sessionId,
    this.redFlags = const <String>[],
    this.sellerClaims = const <String>[],
    this.createdAt,
  });

  final String id;
  final String? sessionId;
  final InspectionScores scores;
  final List<InspectionItem> checklist;

  /// Points bloquants : ceux qui exigent une vérification avant tout achat.
  final List<String> redFlags;
  final List<String> notes;
  final List<String> sellerClaims;
  final DateTime? createdAt;

  factory Inspection.fromJson(Map<String, dynamic> json) => Inspection(
        id: json['id'] as String? ?? '',
        sessionId: json['sessionId'] as String?,
        scores: InspectionScores.fromJson(json['scores'] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        checklist: (json['checklist'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(InspectionItem.fromJson)
            .toList(),
        redFlags: (json['redFlags'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        notes: (json['notes'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        sellerClaims: (json['sellerClaims'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        createdAt: json['createdAt'] is String ? DateTime.tryParse(json['createdAt'] as String) : null,
      );
}
