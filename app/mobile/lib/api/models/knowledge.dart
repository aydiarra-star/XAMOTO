/// XAMOTO — Base de connaissances exposée par le serveur (§15).
///
/// `SystemCoverage` est la partie la plus importante du point de vue produit :
/// elle dit ce que l'OBD donne, ce qu'il ne donne PAS, et pourquoi. Un système
/// non lisible n'est jamais présenté comme sain.
library;

import '../../core/levels.dart';

class Symptom {
  const Symptom({required this.key, required this.labelFr, required this.labelEn, required this.systems, required this.safety});

  final String key;
  final String labelFr;
  final String labelEn;
  final List<String> systems;
  final SafetyLevel safety;

  factory Symptom.fromJson(Map<String, dynamic> json) => Symptom(
        key: json['key'] as String? ?? '',
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        systems: (json['systems'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        safety: SafetyLevel.parse(json['safety'] as String?),
      );
}

/// Niveau de lecture réelle d'un système par l'OBD.
enum ObdReadability {
  codesAndData('codes_and_data', 'Codes + mesures', 'Codes + data'),
  codesOnly('codes_only', 'Codes seulement', 'Codes only'),
  limited('limited', 'Lecture partielle', 'Partial reading'),
  notAccessible('not_accessible', 'Non accessible', 'Not accessible');

  const ObdReadability(this.wire, this.fr, this.en);

  final String wire;
  final String fr;
  final String en;

  static ObdReadability parse(String? raw) {
    for (final value in ObdReadability.values) {
      if (value.wire == raw) return value;
    }
    return ObdReadability.limited;
  }

  bool get isAccessible => this != ObdReadability.notAccessible;
}

class SystemCoverage {
  const SystemCoverage({
    required this.system,
    required this.readability,
    required this.whatObdGivesFr,
    required this.whatObdGivesEn,
    required this.limitsFr,
    required this.limitsEn,
    required this.tests,
    required this.sourceId,
    this.ruleIds = const <String>[],
  });

  final String system;
  final ObdReadability readability;
  final String whatObdGivesFr;
  final String whatObdGivesEn;
  final String limitsFr;
  final String limitsEn;

  /// Tests guidés utiles pour ce système (identifiants techniques).
  final List<String> tests;
  final String sourceId;

  /// Règles dédiées du moteur qui traitent ce système.
  final List<String> ruleIds;

  factory SystemCoverage.fromJson(Map<String, dynamic> json) => SystemCoverage(
        system: json['system'] as String? ?? '',
        readability: ObdReadability.parse(json['readability'] as String?),
        whatObdGivesFr: json['whatObdGivesFr'] as String? ?? '',
        whatObdGivesEn: json['whatObdGivesEn'] as String? ?? '',
        limitsFr: json['limitsFr'] as String? ?? '',
        limitsEn: json['limitsEn'] as String? ?? '',
        tests: (json['tests'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        sourceId: json['sourceId'] as String? ?? '',
        ruleIds: (json['ruleIds'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
      );
}

class DtcKnowledge {
  const DtcKnowledge({
    required this.code,
    required this.technical,
    required this.simpleFr,
    required this.simpleEn,
    required this.system,
    required this.severity,
    required this.canDriveDefault,
    this.likelyCauses = const <String>[],
    this.relatedTests = const <String>[],
    this.sourceId,
  });

  final String code;
  final String technical;
  final String simpleFr;
  final String simpleEn;
  final String system;
  final SafetyLevel severity;
  final String canDriveDefault;
  final List<String> likelyCauses;
  final List<String> relatedTests;
  final String? sourceId;

  factory DtcKnowledge.fromJson(Map<String, dynamic> json) => DtcKnowledge(
        code: json['code'] as String? ?? '',
        technical: json['technical'] as String? ?? '',
        simpleFr: json['simpleFr'] as String? ?? '',
        simpleEn: json['simpleEn'] as String? ?? '',
        system: json['system'] as String? ?? '',
        severity: SafetyLevel.parse(json['severity'] as String?),
        canDriveDefault: json['canDriveDefault'] as String? ?? 'with_caution',
        likelyCauses: (json['likelyCauses'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map((cause) => cause['labelFr'] as String? ?? '')
            .where((label) => label.isNotEmpty)
            .toList(),
        relatedTests: (json['relatedTests'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        sourceId: json['sourceId'] as String?,
      );
}
