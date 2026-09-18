/// XAMOTO — Garages et pièces (§21, §22).
///
/// XAMOTO ne juge pas un garage et n'estime pas un prix « normal » : il affiche
/// ce qui est déclaré, avec sa provenance, et rappelle que la disponibilité des
/// pièces au Sénégal est une information déclarée, pas une garantie.
library;

import '../../core/format.dart';

class Garage {
  const Garage({
    required this.id,
    required this.name,
    required this.city,
    required this.country,
    required this.brands,
    required this.specialties,
    required this.services,
    required this.verified,
    this.phone,
    this.whatsapp,
    this.rating,
    this.acceptsXamotoDiagnostics = false,
    this.lat,
    this.lon,
  });

  final String id;
  final String name;
  final String city;
  final String country;
  final List<String> brands;
  final List<String> specialties;
  final List<String> services;
  final bool verified;
  final String? phone;
  final String? whatsapp;

  /// Note déclarée par la plateforme : jamais présentée comme un avis XAMOTO.
  final double? rating;
  final bool acceptsXamotoDiagnostics;
  final double? lat;
  final double? lon;

  factory Garage.fromJson(Map<String, dynamic> json) => Garage(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        city: json['city'] as String? ?? '',
        country: json['country'] as String? ?? '',
        brands: (json['brands'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        specialties: (json['specialties'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        services: (json['services'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
        verified: json['verified'] as bool? ?? false,
        phone: json['phone'] as String?,
        whatsapp: json['whatsapp'] as String?,
        rating: (json['rating'] as num?)?.toDouble(),
        acceptsXamotoDiagnostics: json['acceptsXamotoDiagnostics'] as bool? ?? false,
        lat: (json['lat'] as num?)?.toDouble(),
        lon: (json['lon'] as num?)?.toDouble(),
      );
}

class Part {
  const Part({
    required this.partKey,
    required this.nameFr,
    required this.nameEn,
    required this.category,
    required this.availabilitySn,
    this.typicalPriceXof,
    this.oemReferences = const <String>[],
  });

  final String partKey;
  final String nameFr;
  final String nameEn;
  final String category;

  /// 'available' | 'ordered' | 'rare' | 'unknown'
  final String availabilitySn;

  /// `null` = prix non déclaré. L'application écrit « non renseigné », jamais « 0 ».
  final int? typicalPriceXof;
  final List<String> oemReferences;

  String get priceText => typicalPriceXof == null ? 'prix non renseigné' : formatXof(typicalPriceXof);

  factory Part.fromJson(Map<String, dynamic> json) => Part(
        partKey: json['partKey'] as String? ?? '',
        nameFr: json['nameFr'] as String? ?? '',
        nameEn: json['nameEn'] as String? ?? '',
        category: json['category'] as String? ?? '',
        availabilitySn: json['availabilitySn'] as String? ?? 'unknown',
        typicalPriceXof: (json['typicalPriceXof'] as num?)?.toInt(),
        oemReferences: (json['oemReferences'] as List<dynamic>? ?? const <dynamic>[]).map((e) => '$e').toList(),
      );
}
