/// XAMOTO — Formatage des valeurs affichées.
///
/// Deux règles : une valeur absente s'écrit « — » (jamais « 0 »), et une valeur
/// non supportée par le véhicule affiche le texte d'indisponibilité exigé (§16).
library;

import 'disclaimer.dart';

const String kMissingValue = '—';

String formatNumber(double? value, {int decimals = 1, String unit = ''}) {
  if (value == null) return kMissingValue;
  final text = value.toStringAsFixed(decimals);
  return unit.isEmpty ? text : '$text $unit';
}

String formatKm(int? km) {
  if (km == null || km <= 0) return kMissingValue;
  final digits = km.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return '${buffer.toString()} km';
}

/// Montants en francs CFA : jamais de décimale, jamais de conversion inventée.
String formatXof(int? amount) {
  if (amount == null) return kMissingValue;
  final digits = amount.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(' ');
    buffer.write(digits[i]);
  }
  return '${buffer.toString()} FCFA';
}

String formatDate(DateTime? date) {
  if (date == null) return kMissingValue;
  final day = date.day.toString().padLeft(2, '0');
  final month = date.month.toString().padLeft(2, '0');
  return '$day/$month/${date.year}';
}

String formatDateTime(DateTime? date) {
  if (date == null) return kMissingValue;
  final hour = date.hour.toString().padLeft(2, '0');
  final minute = date.minute.toString().padLeft(2, '0');
  return '${formatDate(date)} $hour:$minute';
}

/// Valeur d'un capteur : si le véhicule ne la fournit pas, on le dit.
String formatReading(double? value, {required bool supported, int decimals = 1, String unit = ''}) {
  if (!supported || value == null) return kInsufficientDataFr;
  return formatNumber(value, decimals: decimals, unit: unit);
}
