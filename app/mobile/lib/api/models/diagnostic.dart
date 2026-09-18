/// XAMOTO — Diagnostic : constats, hypothèses, tests guidés, « Puis-je rouler ? ».
///
/// Le mobile AFFICHE ces objets, il ne les fabrique pas : ils viennent du moteur
/// déterministe du serveur (§9, §13). Chaque hypothèse porte son score, son
/// niveau de certitude et ses preuves.
library;

import '../../core/levels.dart';

class DiagnosticEvidence {
  const DiagnosticEvidence({required this.labelFr, required this.labelEn, this.dtc, this.pid});

  final String labelFr;
  final String labelEn;
  final String? dtc;
  final String? pid;

  factory DiagnosticEvidence.fromJson(Map<String, dynamic> json) => DiagnosticEvidence(
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        dtc: json['dtc'] as String?,
        pid: json['pid'] as String?,
      );
}

class DiagnosticHypothesis {
  const DiagnosticHypothesis({
    required this.causeKey,
    required this.labelFr,
    required this.labelEn,
    required this.score,
    required this.certainty,
    required this.reasoning,
    this.parts = const <String>[],
    this.confirmingTest,
    this.evidence = const <DiagnosticEvidence>[],
  });

  final String causeKey;
  final String labelFr;
  final String labelEn;
  final double score;
  final CertaintyLevel certainty;
  final List<String> reasoning;
  final List<String> parts;
  final String? confirmingTest;
  final List<DiagnosticEvidence> evidence;

  factory DiagnosticHypothesis.fromJson(Map<String, dynamic> json) => DiagnosticHypothesis(
        causeKey: json['causeKey'] as String? ?? '',
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        score: (json['score'] as num?)?.toDouble() ?? 0,
        certainty: CertaintyLevel.parse(json['certainty'] as String?),
        reasoning: (json['reasoning'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        parts: (json['parts'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        confirmingTest: json['confirmingTest'] as String?,
        evidence: (json['evidence'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(DiagnosticEvidence.fromJson)
            .toList(),
      );
}

class DiagnosticFinding {
  const DiagnosticFinding({
    required this.kind,
    required this.titleFr,
    required this.titleEn,
    required this.detailFr,
    required this.detailEn,
    required this.certainty,
    required this.safety,
  });

  final String kind;
  final String titleFr;
  final String titleEn;
  final String detailFr;
  final String detailEn;
  final CertaintyLevel certainty;
  final SafetyLevel safety;

  factory DiagnosticFinding.fromJson(Map<String, dynamic> json) => DiagnosticFinding(
        kind: json['kind'] as String? ?? '',
        titleFr: json['titleFr'] as String? ?? '',
        titleEn: json['titleEn'] as String? ?? '',
        detailFr: json['detailFr'] as String? ?? '',
        detailEn: json['detailEn'] as String? ?? '',
        certainty: CertaintyLevel.parse(json['certainty'] as String?),
        safety: SafetyLevel.parse(json['safety'] as String?),
      );
}

class CanIDrive {
  const CanIDrive({
    required this.level,
    required this.headlineFr,
    required this.headlineEn,
    required this.whyFr,
    required this.whyEn,
    required this.toCheckFr,
    required this.toCheckEn,
    required this.avoidFr,
    required this.avoidEn,
    required this.certainty,
    this.seeProfessionalFr,
    this.seeProfessionalEn,
    this.disclaimerFr,
    this.disclaimerEn,
    this.missingData = const <String>[],
  });

  final String level;
  final String headlineFr;
  final String headlineEn;
  final List<String> whyFr;
  final List<String> whyEn;
  final List<String> toCheckFr;
  final List<String> toCheckEn;
  final List<String> avoidFr;
  final List<String> avoidEn;
  final CertaintyLevel certainty;
  final String? seeProfessionalFr;
  final String? seeProfessionalEn;

  /// Avertissement de non-garantie (§12, §47-10) : toujours affiché.
  final String? disclaimerFr;
  final String? disclaimerEn;
  final List<String> missingData;

  bool get mustNotDrive => level == 'do_not_drive' || level == 'stop_now';

  static List<String> _strings(dynamic value) => (value as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList();

  factory CanIDrive.fromJson(Map<String, dynamic> json) => CanIDrive(
        level: json['level'] as String? ?? 'unknown',
        headlineFr: json['headlineFr'] as String? ?? '',
        headlineEn: json['headlineEn'] as String? ?? '',
        whyFr: _strings(json['whyFr']),
        whyEn: _strings(json['whyEn']),
        toCheckFr: _strings(json['toCheckFr']),
        toCheckEn: _strings(json['toCheckEn']),
        avoidFr: _strings(json['avoidFr']),
        avoidEn: _strings(json['avoidEn']),
        certainty: CertaintyLevel.parse(json['certainty'] as String?),
        seeProfessionalFr: json['seeProfessionalFr'] as String?,
        seeProfessionalEn: json['seeProfessionalEn'] as String?,
        disclaimerFr: json['disclaimerFr'] as String?,
        disclaimerEn: json['disclaimerEn'] as String?,
        missingData: _strings(json['missingData']),
      );
}

class DiagnosticResult {
  const DiagnosticResult({
    required this.id,
    required this.vehicleId,
    required this.mode,
    required this.certainty,
    required this.safety,
    required this.conclusionFr,
    required this.conclusionEn,
    required this.hypotheses,
    required this.findings,
    this.canIDrive,
    this.engineVersion,
    this.dataOrigin,
  });

  final String id;
  final String vehicleId;
  final String mode;
  final CertaintyLevel certainty;
  final SafetyLevel safety;
  final String conclusionFr;
  final String conclusionEn;
  final List<DiagnosticHypothesis> hypotheses;
  final List<DiagnosticFinding> findings;
  final CanIDrive? canIDrive;
  final String? engineVersion;
  final String? dataOrigin;

  bool get isIndeterminate => certainty == CertaintyLevel.undeterminable || certainty == CertaintyLevel.unavailable;

  factory DiagnosticResult.fromJson(Map<String, dynamic> json) {
    final hypotheses = (json['hypotheses'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(DiagnosticHypothesis.fromJson)
        .toList()
      ..sort((a, b) => b.score.compareTo(a.score));
    return DiagnosticResult(
      id: json['id'] as String? ?? '',
      vehicleId: json['vehicleId'] as String? ?? '',
      mode: json['mode'] as String? ?? 'standard',
      certainty: CertaintyLevel.parse(json['certainty'] as String?),
      safety: SafetyLevel.parse(json['safety'] as String?),
      conclusionFr: json['conclusionFr'] as String? ?? '',
      conclusionEn: json['conclusionEn'] as String? ?? '',
      hypotheses: hypotheses,
      findings: (json['findings'] as List<dynamic>? ?? const <dynamic>[])
          .whereType<Map<String, dynamic>>()
          .map(DiagnosticFinding.fromJson)
          .toList(),
      canIDrive: json['canIDrive'] is Map<String, dynamic> ? CanIDrive.fromJson(json['canIDrive'] as Map<String, dynamic>) : null,
      engineVersion: json['engineVersion'] as String?,
      dataOrigin: json['dataOrigin'] as String?,
    );
  }
}

class GuidedTest {
  const GuidedTest({
    required this.id,
    required this.testKey,
    required this.titleFr,
    required this.titleEn,
    required this.objectiveFr,
    required this.objectiveEn,
    required this.equipment,
    required this.safety,
    required this.status,
    required this.priority,
    this.durationMin,
    this.reasonFr,
    this.reasonEn,
  });

  final String id;
  final String testKey;
  final String titleFr;
  final String titleEn;
  final String objectiveFr;
  final String objectiveEn;
  final List<String> equipment;
  final SafetyLevel safety;

  /// 'proposed' | 'done' | 'skipped'
  final String status;
  final int priority;
  final int? durationMin;
  final String? reasonFr;
  final String? reasonEn;

  factory GuidedTest.fromJson(Map<String, dynamic> json) => GuidedTest(
        id: json['id'] as String? ?? '',
        testKey: json['testKey'] as String? ?? '',
        titleFr: json['titleFr'] as String? ?? '',
        titleEn: json['titleEn'] as String? ?? '',
        objectiveFr: json['objectiveFr'] as String? ?? '',
        objectiveEn: json['objectiveEn'] as String? ?? '',
        equipment: (json['equipment'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        safety: SafetyLevel.parse(json['safety'] as String?),
        status: json['status'] as String? ?? 'proposed',
        priority: (json['priority'] as num?)?.toInt() ?? 100,
        durationMin: (json['durationMin'] as num?)?.toInt(),
        reasonFr: json['reasonFr'] as String?,
        reasonEn: json['reasonEn'] as String?,
      );
}
