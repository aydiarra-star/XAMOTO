/// XAMOTO — Scan OBD : mesures, codes défaut, scénarios de simulation.
///
/// Un PID non supporté n'est PAS une valeur : `supported: false` + `value: null`,
/// et l'application affiche la phrase d'indisponibilité exigée (§16, §47-1).
library;

import '../../core/data_origin.dart';

class ObdReading {
  const ObdReading({
    required this.key,
    required this.value,
    required this.supported,
    required this.unit,
    required this.origin,
  });

  final String key;
  final double? value;
  final bool supported;
  final String? unit;
  final DataOrigin origin;

  factory ObdReading.fromJson(Map<String, dynamic> json) => ObdReading(
        key: json['key'] as String? ?? '',
        value: (json['value'] as num?)?.toDouble(),
        supported: json['supported'] as bool? ?? false,
        unit: json['unit'] as String?,
        origin: DataOrigin.parse(json['origin'] as String?),
      );
}

class ObdDtc {
  const ObdDtc({required this.code, required this.status, this.occurrences, this.freezeFrame});

  final String code;

  /// 'active' | 'pending' | 'stored'
  final String status;
  final int? occurrences;
  final Map<String, dynamic>? freezeFrame;

  factory ObdDtc.fromJson(Map<String, dynamic> json) => ObdDtc(
        code: json['code'] as String? ?? '',
        status: json['status'] as String? ?? 'stored',
        occurrences: (json['occurrences'] as num?)?.toInt(),
        freezeFrame: json['freezeFrame'] as Map<String, dynamic>?,
      );
}

class ScanResult {
  const ScanResult({
    required this.sessionId,
    required this.source,
    required this.protocol,
    required this.milOn,
    required this.readings,
    required this.dtcs,
    required this.unsupportedPids,
    required this.warnings,
    required this.startedAt,
    this.diagnosticSessionId,
    this.scenario,
    this.simulationNotice,
    this.device,
  });

  final String sessionId;

  /// 'simulator' | 'obd' — jamais mélangés.
  final String source;
  final String protocol;
  final bool milOn;
  final List<ObdReading> readings;
  final List<ObdDtc> dtcs;
  final List<String> unsupportedPids;
  final List<String> warnings;
  final DateTime? startedAt;
  final String? diagnosticSessionId;
  final String? scenario;
  final String? simulationNotice;
  final String? device;

  bool get isSimulated => source == 'simulator';

  factory ScanResult.fromJson(Map<String, dynamic> json) => ScanResult(
        sessionId: json['sessionId'] as String? ?? '',
        source: json['source'] as String? ?? 'obd',
        protocol: json['protocol'] as String? ?? '',
        milOn: json['milOn'] as bool? ?? false,
        readings: (json['readings'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(ObdReading.fromJson)
            .toList(),
        dtcs: (json['dtcs'] as List<dynamic>? ?? const <dynamic>[]).whereType<Map<String, dynamic>>().map(ObdDtc.fromJson).toList(),
        unsupportedPids: (json['unsupportedPids'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        warnings: (json['warnings'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        startedAt: json['startedAt'] is String ? DateTime.tryParse(json['startedAt'] as String) : null,
        diagnosticSessionId: json['diagnosticSessionId'] as String?,
        scenario: json['scenario'] as String?,
        simulationNotice: json['simulationNotice'] as String?,
        device: json['device'] as String?,
      );
}

class ScanSummary {
  const ScanSummary({
    required this.id,
    required this.vehicleId,
    required this.source,
    required this.startedAt,
    required this.milOn,
    required this.pidCount,
    required this.dtcCount,
    this.scenario,
  });

  final String id;
  final String vehicleId;
  final String source;
  final DateTime? startedAt;
  final bool milOn;
  final int pidCount;
  final int dtcCount;
  final String? scenario;

  factory ScanSummary.fromJson(Map<String, dynamic> json) => ScanSummary(
        id: json['id'] as String,
        vehicleId: json['vehicleId'] as String? ?? '',
        source: json['source'] as String? ?? 'obd',
        startedAt: json['startedAt'] is String ? DateTime.tryParse(json['startedAt'] as String) : null,
        milOn: json['milOn'] as bool? ?? false,
        pidCount: (json['pidCount'] as num?)?.toInt() ?? 0,
        dtcCount: (json['dtcCount'] as num?)?.toInt() ?? 0,
        scenario: json['scenario'] as String?,
      );
}

class SimulatorScenario {
  const SimulatorScenario({
    required this.id,
    required this.labelFr,
    required this.labelEn,
    required this.descriptionFr,
    required this.descriptionEn,
    required this.symptoms,
  });

  final String id;
  final String labelFr;
  final String labelEn;
  final String descriptionFr;
  final String descriptionEn;
  final List<String> symptoms;

  factory SimulatorScenario.fromJson(Map<String, dynamic> json) => SimulatorScenario(
        id: json['id'] as String,
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        descriptionFr: json['descriptionFr'] as String? ?? '',
        descriptionEn: json['descriptionEn'] as String? ?? '',
        symptoms: (json['symptoms'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
      );
}
