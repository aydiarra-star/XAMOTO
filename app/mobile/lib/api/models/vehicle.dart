/// XAMOTO — Véhicule, entretien, alertes.
///
/// Aucune valeur n'est inventée à la lecture : un champ absent du serveur reste
/// `null`, et l'interface affiche « — » ou « non renseigné » (§33, §47-1).
library;

import '../../core/format.dart';

class VehicleSpec {
  const VehicleSpec({
    this.oilSpec,
    this.oilCapacityL,
    this.coolantSpec,
    this.timingType,
    this.timingIntervalKm,
    this.sparkPlugSpec,
    this.sparkPlugIntervalKm,
    this.commonIssues = const <String>[],
  });

  final String? oilSpec;
  final double? oilCapacityL;
  final String? coolantSpec;
  final String? timingType;
  final int? timingIntervalKm;
  final String? sparkPlugSpec;
  final int? sparkPlugIntervalKm;
  final List<String> commonIssues;

  factory VehicleSpec.fromJson(Map<String, dynamic> json) => VehicleSpec(
        oilSpec: json['oilSpec'] as String?,
        oilCapacityL: (json['oilCapacityL'] as num?)?.toDouble(),
        coolantSpec: json['coolantSpec'] as String?,
        timingType: json['timingType'] as String?,
        timingIntervalKm: (json['timingIntervalKm'] as num?)?.toInt(),
        sparkPlugSpec: json['sparkPlugSpec'] as String?,
        sparkPlugIntervalKm: (json['sparkPlugIntervalKm'] as num?)?.toInt(),
        commonIssues: (json['commonIssues'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
      );

  String get oilCapacityText => oilCapacityL == null ? 'non communiqué' : '${formatNumber(oilCapacityL, decimals: 1, unit: 'L')}';
}

class Vehicle {
  const Vehicle({
    required this.id,
    required this.brand,
    required this.model,
    required this.year,
    required this.engine,
    required this.fuelType,
    required this.gearbox,
    required this.plate,
    required this.odometerKm,
    required this.nickname,
    this.vin,
    this.permission,
    this.spec,
  });

  final String id;
  final String brand;
  final String model;
  final int year;
  final String engine;
  final String fuelType;
  final String gearbox;
  final String plate;
  final int odometerKm;
  final String nickname;
  final String? vin;

  /// 'owner' | 'shared' | ... — l'interface n'affiche pas une action non permise.
  final String? permission;
  final VehicleSpec? spec;

  String get displayName => nickname.isNotEmpty ? nickname : '$brand $model';

  factory Vehicle.fromJson(Map<String, dynamic> json) => Vehicle(
        id: json['id'] as String,
        brand: json['brand'] as String? ?? '',
        model: json['model'] as String? ?? '',
        year: (json['year'] as num?)?.toInt() ?? 0,
        engine: json['engine'] as String? ?? '',
        fuelType: json['fuelType'] as String? ?? '',
        gearbox: json['gearbox'] as String? ?? '',
        plate: json['plate'] as String? ?? '',
        odometerKm: (json['odometerKm'] as num?)?.toInt() ?? 0,
        nickname: json['nickname'] as String? ?? '',
        vin: json['vin'] as String?,
        permission: json['permission'] as String?,
        spec: json['spec'] is Map<String, dynamic> ? VehicleSpec.fromJson(json['spec'] as Map<String, dynamic>) : null,
      );
}

class MaintenanceItem {
  const MaintenanceItem({
    required this.kind,
    required this.labelFr,
    required this.labelEn,
    required this.status,
    this.nextDueKm,
    this.nextDueAt,
    this.notesFr,
    this.explanationFr,
    this.origin,
    this.sourceId,
  });

  final String kind;
  final String labelFr;
  final String labelEn;

  /// 'ok' | 'soon' | 'overdue' | 'unknown'
  final String status;
  final int? nextDueKm;
  final DateTime? nextDueAt;
  final String? notesFr;
  final String? explanationFr;
  final String? origin;
  final String? sourceId;

  bool get isOverdue => status == 'overdue';

  factory MaintenanceItem.fromJson(Map<String, dynamic> json) => MaintenanceItem(
        kind: json['kind'] as String? ?? '',
        labelFr: json['labelFr'] as String? ?? '',
        labelEn: json['labelEn'] as String? ?? '',
        status: json['status'] as String? ?? 'unknown',
        nextDueKm: (json['nextDueKm'] as num?)?.toInt(),
        nextDueAt: json['nextDueAt'] is String ? DateTime.tryParse(json['nextDueAt'] as String) : null,
        notesFr: json['notesFr'] as String?,
        explanationFr: json['explanationFr'] as String?,
        origin: json['origin'] as String?,
        sourceId: json['sourceId'] as String?,
      );
}

class MaintenancePlan {
  const MaintenancePlan({required this.items, this.notice});

  final List<MaintenanceItem> items;
  final String? notice;

  factory MaintenancePlan.fromJson(Map<String, dynamic> json) => MaintenancePlan(
        items: (json['plan'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(MaintenanceItem.fromJson)
            .toList(),
        notice: json['notice'] as String?,
      );
}

class VehicleAlert {
  const VehicleAlert({
    required this.id,
    required this.level,
    required this.kind,
    required this.titleFr,
    required this.titleEn,
    required this.bodyFr,
    required this.bodyEn,
    required this.createdAt,
    this.readAt,
  });

  final String id;
  final String level;
  final String kind;
  final String titleFr;
  final String titleEn;
  final String bodyFr;
  final String bodyEn;
  final DateTime? createdAt;
  final DateTime? readAt;

  bool get isUnread => readAt == null;

  factory VehicleAlert.fromJson(Map<String, dynamic> json) => VehicleAlert(
        id: json['id'] as String,
        level: json['level'] as String? ?? 'normal',
        kind: json['kind'] as String? ?? '',
        titleFr: json['titleFr'] as String? ?? '',
        titleEn: json['titleEn'] as String? ?? '',
        bodyFr: json['bodyFr'] as String? ?? '',
        bodyEn: json['bodyEn'] as String? ?? '',
        createdAt: json['createdAt'] is String ? DateTime.tryParse(json['createdAt'] as String) : null,
        readAt: json['readAt'] is String ? DateTime.tryParse(json['readAt'] as String) : null,
      );
}
