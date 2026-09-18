/// XAMOTO — Devis de garage (§27).
///
/// Deux règles gouvernent ces objets, et elles expliquent chaque champ nullable :
///
///  1. **un montant absent reste absent.** `unitAmount` est nullable : l'écran
///     écrit « montant non renseigné » au lieu d'afficher un `0` qui passerait
///     pour un prix (§47-1). Le serveur refuse d'ailleurs une ligne sans montant.
///  2. **l'analyse ne juge pas.** `linkedToMeasuredData` dit seulement si la ligne
///     rejoint une donnée lue sur ce véhicule. Un devis hors périmètre OBD n'est
///     pas une faute : `questionToAsk` remplace le soupçon.
library;

import '../../core/format.dart';

class QuoteLine {
  const QuoteLine({
    required this.label,
    this.partReference,
    this.quantity,
    this.unitAmount,
    this.currency = 'XOF',
  });

  final String label;
  final String? partReference;

  /// `null` = quantité non communiquée. Affichée comme telle, jamais « 1 » inventé.
  final double? quantity;

  /// `null` = montant non communiqué. **Jamais remplacé par zéro.**
  final double? unitAmount;
  final String currency;

  bool get hasAmount => unitAmount != null;
  bool get hasQuantity => quantity != null;

  String get quantityText => hasQuantity ? formatNumber(quantity, decimals: 0) : 'non renseignée';

  String get unitAmountText =>
      hasAmount ? '$currency ${formatNumber(unitAmount, decimals: 0)}' : 'montant non renseigné';

  /// Total du poste : `null` dès qu'un des deux termes manque — on ne calcule pas
  /// un total sur une donnée absente.
  double? get lineTotal => hasAmount && hasQuantity ? unitAmount! * quantity! : null;

  String get lineTotalText {
    final total = lineTotal;
    return total == null ? 'non calculable' : '$currency ${formatNumber(total, decimals: 0)}';
  }

  factory QuoteLine.fromJson(Map<String, dynamic> json) => QuoteLine(
        label: json['label'] as String? ?? '',
        partReference: json['partReference'] as String?,
        quantity: (json['quantity'] as num?)?.toDouble(),
        unitAmount: (json['unitAmount'] as num?)?.toDouble(),
        currency: json['currency'] as String? ?? 'XOF',
      );
}

class Quote {
  const Quote({
    required this.id,
    required this.vehicleId,
    required this.garageId,
    required this.status,
    required this.lines,
    this.diagnosticSessionId,
    this.warrantyMonths,
    this.delayDays,
    this.factualSummary,
    this.requestedAt,
    this.receivedAt,
  });

  final String id;
  final String vehicleId;
  final String garageId;
  final String? diagnosticSessionId;

  /// 'draft' | 'requested' | 'received' | 'accepted' | 'declined'
  final String status;
  final List<QuoteLine> lines;
  final int? warrantyMonths;
  final int? delayDays;
  final String? factualSummary;
  final DateTime? requestedAt;
  final DateTime? receivedAt;

  /// Vrai seulement si TOUTES les lignes portent un montant : un total partiel
  /// présenté comme un total serait un chiffre faux.
  bool get totalIsComplete => lines.isNotEmpty && lines.every((line) => line.hasAmount);

  double? get total {
    if (!totalIsComplete) return null;
    var sum = 0.0;
    for (final line in lines) {
      final total = line.lineTotal;
      if (total == null) return null;
      sum += total;
    }
    return sum;
  }

  String get totalText {
    final value = total;
    if (value == null) {
      if (lines.isEmpty) return 'aucun poste';
      return 'total incomplet : un poste n’a pas de montant';
    }
    return '${lines.first.currency} ${formatNumber(value, decimals: 0)}';
  }

  factory Quote.fromJson(Map<String, dynamic> json) => Quote(
        id: json['id'] as String? ?? '',
        vehicleId: json['vehicleId'] as String? ?? '',
        garageId: json['garageId'] as String? ?? '',
        diagnosticSessionId: json['diagnosticSessionId'] as String?,
        status: json['status'] as String? ?? 'draft',
        lines: (json['lines'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(QuoteLine.fromJson)
            .toList(),
        warrantyMonths: (json['warrantyMonths'] as num?)?.toInt(),
        delayDays: (json['delayDays'] as num?)?.toInt(),
        factualSummary: json['factualSummary'] as String?,
        requestedAt: json['requestedAt'] is String ? DateTime.tryParse(json['requestedAt'] as String) : null,
        receivedAt: json['receivedAt'] is String ? DateTime.tryParse(json['receivedAt'] as String) : null,
      );
}

class QuoteAnalysisLine {
  const QuoteAnalysisLine({
    required this.label,
    required this.linkedToMeasuredData,
    this.quantity,
    this.unitAmount,
    this.currency = 'XOF',
    this.matchedElements = const <String>[],
    this.questionToAsk,
  });

  final String label;

  /// Vrai si la ligne rejoint un code défaut, une mesure ou un test du diagnostic
  /// de CE véhicule. Faux ne veut pas dire « inutile » : voir `questionToAsk`.
  final bool linkedToMeasuredData;
  final double? quantity;
  final double? unitAmount;
  final String currency;

  /// Ce qui relie la ligne aux données (code défaut, hypothèse, test). Vide si rien.
  final List<String> matchedElements;
  final String? questionToAsk;

  factory QuoteAnalysisLine.fromJson(Map<String, dynamic> json) => QuoteAnalysisLine(
        label: json['label'] as String? ?? '',
        linkedToMeasuredData: json['linkedToMeasuredData'] as bool? ?? false,
        quantity: (json['quantity'] as num?)?.toDouble(),
        unitAmount: (json['unitAmount'] as num?)?.toDouble(),
        currency: json['currency'] as String? ?? 'XOF',
        matchedElements: (json['matchedElements'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
        questionToAsk: json['questionToAsk'] as String?,
      );
}

class QuoteAnalysisSummary {
  const QuoteAnalysisSummary({
    required this.totalLines,
    required this.linesLinkedToMeasuredData,
    required this.linesNotLinked,
    required this.dataOrigin,
    required this.certainty,
  });

  final int totalLines;
  final int linesLinkedToMeasuredData;
  final int linesNotLinked;

  /// Provenance §33 des données utilisées pour l'analyse (`simulated`, `measured`…).
  final String dataOrigin;

  /// Niveau de certitude §10 de l'analyse — jamais une note, jamais un avis.
  final String certainty;

  factory QuoteAnalysisSummary.fromJson(Map<String, dynamic> json) => QuoteAnalysisSummary(
        totalLines: (json['totalLines'] as num?)?.toInt() ?? 0,
        linesLinkedToMeasuredData: (json['linesLinkedToMeasuredData'] as num?)?.toInt() ?? 0,
        linesNotLinked: (json['linesNotLinked'] as num?)?.toInt() ?? 0,
        dataOrigin: json['dataOrigin'] as String? ?? 'unknown',
        certainty: json['certainty'] as String? ?? 'unavailable',
      );
}

class QuoteAnalysis {
  const QuoteAnalysis({
    required this.analysis,
    required this.summary,
    this.noticeFr,
    this.questionsFr = const <String>[],
  });

  final List<QuoteAnalysisLine> analysis;
  final QuoteAnalysisSummary summary;

  /// Phrase de cadrage du serveur : elle dit ce que l'analyse ne fait PAS.
  final String? noticeFr;

  /// Questions à poser au garage, du point de vue du client.
  final List<String> questionsFr;

  factory QuoteAnalysis.fromJson(Map<String, dynamic> json) => QuoteAnalysis(
        analysis: (json['analysis'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(QuoteAnalysisLine.fromJson)
            .toList(),
        summary: QuoteAnalysisSummary.fromJson(json['summary'] as Map<String, dynamic>? ?? const <String, dynamic>{}),
        noticeFr: json['noticeFr'] as String?,
        questionsFr: (json['questionsFr'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
      );
}
