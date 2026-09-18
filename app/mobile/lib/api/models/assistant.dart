/// XAMOTO — Assistant (§13, §16).
///
/// L'assistant explique une conclusion déjà calculée. Il ne diagnostique pas, et
/// il ne répond jamais dans une langue qu'il n'a pas : le serveur renvoie la
/// langue réellement utilisée et l'explication du repli.
library;

class AssistantLanguage {
  const AssistantLanguage({
    required this.requested,
    required this.effective,
    required this.fallback,
    this.noticeFr,
    this.noticeEn,
  });

  final String requested;
  final String effective;
  final bool fallback;
  final String? noticeFr;
  final String? noticeEn;

  factory AssistantLanguage.fromJson(Map<String, dynamic> json) => AssistantLanguage(
        requested: json['requested'] as String? ?? 'fr',
        effective: json['effective'] as String? ?? 'fr',
        fallback: json['fallback'] as bool? ?? false,
        noticeFr: json['noticeFr'] as String?,
        noticeEn: json['noticeEn'] as String?,
      );
}

class AssistantAnswer {
  const AssistantAnswer({
    required this.answerFr,
    required this.answerEn,
    required this.language,
    this.sources = const <String>[],
    this.usedEngine = true,
    this.confidenceNoteFr,
  });

  final String answerFr;
  final String answerEn;
  final AssistantLanguage language;

  /// Documents réellement utilisés, avec leur identifiant de source.
  final List<String> sources;

  /// Vrai quand la réponse vient du moteur et non d'un modèle génératif.
  final bool usedEngine;
  final String? confidenceNoteFr;

  String text(String locale) => locale == 'en' ? answerEn : answerFr;

  factory AssistantAnswer.fromJson(Map<String, dynamic> json) => AssistantAnswer(
        answerFr: json['answerFr'] as String? ?? '',
        answerEn: json['answerEn'] as String? ?? '',
        language: json['language'] is Map<String, dynamic>
            ? AssistantLanguage.fromJson(json['language'] as Map<String, dynamic>)
            : const AssistantLanguage(requested: 'fr', effective: 'fr', fallback: false),
        sources: (json['sources'] as List<dynamic>? ?? const <dynamic>[])
            .map((source) => source is Map<String, dynamic> ? (source['id'] as String? ?? source['titleFr'] as String? ?? '') : '$source')
            .where((label) => label.isNotEmpty)
            .toList(),
        usedEngine: json['usedEngine'] as bool? ?? true,
        confidenceNoteFr: json['confidenceNoteFr'] as String?,
      );
}
