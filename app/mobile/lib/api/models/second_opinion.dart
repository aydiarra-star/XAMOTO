/// XAMOTO — Seconde opinion (§20).
///
/// Un diagnostic reçu d'un garage est confronté à ce que XAMOTO a réellement lu
/// sur le véhicule. Trois catégories, jamais deux :
///
///  - `confirmedElements` : ce que les mesures soutiennent ;
///  - `unconfirmedElements` : ce qui n'est ni confirmé ni écarté — la formulation
///    compte, parce que « non vérifiable » n'est pas « faux » ;
///  - `alternativeHypotheses` : les autres causes encore possibles, avec leur score.
///
/// Aucun jugement n'est porté sur le professionnel, son travail ou son prix.
library;

import '../../core/levels.dart';

class SecondOpinionElement {
  const SecondOpinionElement({required this.label, this.certainty, this.why});

  final String label;
  final CertaintyLevel? certainty;
  final String? why;

  factory SecondOpinionElement.fromJson(Map<String, dynamic> json) => SecondOpinionElement(
        label: json['label'] as String? ?? '',
        certainty: json['certainty'] is String ? CertaintyLevel.parse(json['certainty'] as String?) : null,
        why: json['why'] as String?,
      );
}

class AlternativeHypothesis {
  const AlternativeHypothesis({
    required this.causeKey,
    required this.labelFr,
    required this.labelEn,
    required this.score,
    required this.certainty,
    this.reasoning = const <String>[],
  });

  final String causeKey;
  final String labelFr;
  final String labelEn;
  final double score;
  final CertaintyLevel certainty;
  final List<String> reasoning;

  factory AlternativeHypothesis.fromJson(Map<String, dynamic> json) => AlternativeHypothesis(
        causeKey: json['causeKey'] as String? ?? '',
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        score: (json['score'] as num?)?.toDouble() ?? 0,
        certainty: CertaintyLevel.parse(json['certainty'] as String?),
        reasoning: (json['reasoning'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
      );
}

class AdditionalTest {
  const AdditionalTest({required this.testKey, required this.title, this.objective, this.priority});

  final String testKey;
  final String title;
  final String? objective;
  final int? priority;

  factory AdditionalTest.fromJson(Map<String, dynamic> json) => AdditionalTest(
        testKey: json['testKey'] as String? ?? '',
        title: json['title'] as String? ?? '',
        objective: json['objective'] as String?,
        priority: (json['priority'] as num?)?.toInt(),
      );
}

class SecondOpinion {
  const SecondOpinion({
    required this.confirmedElements,
    required this.unconfirmedElements,
    required this.alternativeHypotheses,
    required this.additionalTests,
    this.summaryFr,
    this.summaryEn,
    this.disclaimerFr,
    this.disclaimerEn,
    this.questionsFr = const <String>[],
  });

  final List<SecondOpinionElement> confirmedElements;
  final List<SecondOpinionElement> unconfirmedElements;
  final List<AlternativeHypothesis> alternativeHypotheses;
  final List<AdditionalTest> additionalTests;
  final String? summaryFr;
  final String? summaryEn;

  /// Phrase du serveur : elle dit explicitement que XAMOTO ne juge pas le garage.
  final String? disclaimerFr;
  final String? disclaimerEn;

  /// Questions à poser au garage. Elles ne sont pas rhétoriques : elles portent
  /// sur ce qui est vérifiable (codes lus, test ayant conduit au diagnostic).
  final List<String> questionsFr;

  factory SecondOpinion.fromJson(Map<String, dynamic> json) => SecondOpinion(
        confirmedElements: (json['confirmedElements'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(SecondOpinionElement.fromJson)
            .toList(),
        unconfirmedElements: (json['unconfirmedElements'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(SecondOpinionElement.fromJson)
            .toList(),
        alternativeHypotheses: (json['alternativeHypotheses'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(AlternativeHypothesis.fromJson)
            .toList(),
        additionalTests: (json['additionalTests'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(AdditionalTest.fromJson)
            .toList(),
        summaryFr: json['summaryFr'] as String?,
        summaryEn: json['summaryEn'] as String?,
        disclaimerFr: json['disclaimerFr'] as String?,
        disclaimerEn: json['disclaimerEn'] as String?,
        questionsFr: (json['questionsFr'] as List<dynamic>? ?? const <dynamic>[]).map((item) => '$item').toList(),
      );
}
