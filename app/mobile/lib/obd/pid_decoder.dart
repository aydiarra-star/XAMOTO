/// XAMOTO — Décodage des PID standard (SAE J1979).
///
/// Règle absolue (§47-1) : un octet de remplissage (0x00, 0xFF) ne devient JAMAIS
/// une valeur. Il devient `null` et `supported: false`, et l'application affiche
/// « Je ne dispose pas de cette donnée pour votre véhicule. »
///
/// Les formules sont celles de la norme, pas des valeurs constructeur.
library;

class PidValue {
  const PidValue({required this.key, required this.value, required this.unit, required this.supported});

  final String key;

  /// `null` = non disponible. Jamais 0 par défaut : 0 est une mesure.
  final double? value;
  final String unit;
  final bool supported;

  static const PidValue unsupported = PidValue(key: '', value: null, unit: '', supported: false);
}

/// Une mesure est-elle un remplissage (donc une absence de donnée) ?
bool isUnavailable(List<int> bytes) {
  if (bytes.isEmpty) return true;
  if (bytes.every((b) => b == 0x00)) return true;
  if (bytes.every((b) => b == 0xFF)) return true;
  return false;
}

/// PID suivis par l'application, avec leur formule normalisée.
class PidCatalog {
  const PidCatalog._();

  /// `key` → (PID OBD, unité, décodeur, nombre d'octets).
  static const Map<String, String> obdPidByKey = <String, String>{
    'engine_load': '04',
    'coolant_temp': '05',
    'short_fuel_trim_b1': '06',
    'long_fuel_trim_b1': '07',
    'intake_air_temp': '0F',
    'maf_air_flow': '10',
    'throttle_position': '11',
    'runtime_since_start': '1F',
    'distance_with_mil': '21',
    'fuel_pressure': '0A',
    'map_pressure': '0B',
    'engine_rpm': '0C',
    'vehicle_speed': '0D',
    'timing_advance': '0E',
    'fuel_level': '2F',
    'barometric_pressure': '33',
    'ambient_temp': '46',
    'oil_temp': '5C',
    'battery_voltage': '42',
    'egr_command': '2C',
    'misfire_count': '3C',
    // PID présents dans le socle XAMOTO mais dont la formule n'est pas
    // normalisée par la SAE : le mobile les demande et transmet la réponse sans
    // l'interpréter. Il ne devine pas une valeur qu'il ne sait pas décoder.
    'dpf_pressure_delta': '7A',
    'o2_b1s1_voltage': '14',
    'o2_b1s2_voltage': '15',
    'throttle_actuator_command': '4C',
  };

  static const Map<String, String> unitByKey = <String, String>{
    'engine_load': '%',
    'coolant_temp': '°C',
    'short_fuel_trim_b1': '%',
    'long_fuel_trim_b1': '%',
    'intake_air_temp': '°C',
    'ambient_temp': '°C',
    'oil_temp': '°C',
    'maf_air_flow': 'g/s',
    'throttle_position': '%',
    'runtime_since_start': 's',
    'distance_with_mil': 'km',
    'fuel_pressure': 'kPa',
    'map_pressure': 'kPa',
    'barometric_pressure': 'kPa',
    'engine_rpm': 'tr/min',
    'vehicle_speed': 'km/h',
    'timing_advance': '°',
    'fuel_level': '%',
    'battery_voltage': 'V',
    'egr_command': '%',
    'misfire_count': 'comptes',
    'dpf_pressure_delta': 'kPa',
    'o2_b1s1_voltage': 'V',
    'o2_b1s2_voltage': 'V',
    'throttle_actuator_command': '%',
  };

  static String? obdPid(String key) => obdPidByKey[key];
  static String? unit(String key) => unitByKey[key];

  /// Décode les octets de données d'un PID (sans l'écho ni l'en-tête de mode).
  static double? decode(String key, List<int> b) {
    if (isUnavailable(b)) return null;
    switch (key) {
      case 'engine_load':
      case 'throttle_position':
      case 'fuel_level':
      case 'egr_command':
      case 'throttle_actuator_command':
        return b[0] * 100 / 255;
      case 'coolant_temp':
      case 'intake_air_temp':
      case 'ambient_temp':
        return b[0] - 40;
      case 'oil_temp':
        return b[0] - 40;
      case 'short_fuel_trim_b1':
      case 'long_fuel_trim_b1':
        return b[0] * 100 / 128 - 100;
      case 'engine_rpm':
        return ((b[0] * 256) + b[1]) / 4;
      case 'vehicle_speed':
        return b[0].toDouble();
      case 'maf_air_flow':
        return ((b[0] * 256) + b[1]) / 100;
      case 'map_pressure':
      case 'barometric_pressure':
        return b[0].toDouble();
      case 'fuel_pressure':
        return b[0] * 3;
      case 'timing_advance':
        return b[0] / 2 - 64;
      case 'runtime_since_start':
        return ((b[0] * 256) + b[1]).toDouble();
      case 'distance_with_mil':
        return ((b[0] * 256) + b[1]).toDouble();
      case 'battery_voltage':
        // PID 42 : tension de commande du calculateur, formule normalisée.
        return ((b[0] * 256) + b[1]) / 1000;
      case 'misfire_count':
        return ((b[0] * 256) + b[1]).toDouble();
      case 'o2_b1s1_voltage':
      case 'o2_b1s2_voltage':
        return b[0] / 200;
      default:
        // Aucune formule connue : on ne devine pas une valeur (§47-1).
        return null;
    }
  }
}

/// Décodage d'une réponse ELM327 de mode 01.
///
/// `41 0C 1A F8` → PID 0C (régime), octets 1A F8 → 1726 tr/min.
PidValue decodeMode01(String key, String payload) {
  final bytes = parseHexBytes(payload);
  if (bytes.length < 2 || bytes.first != 0x41) {
    return PidValue(key: key, value: null, unit: PidCatalog.unit(key) ?? '', supported: false);
  }
  final pid = bytes[1];
  final expected = PidCatalog.obdPid(key);
  if (expected == null || int.parse(expected, radix: 16) != pid) {
    return PidValue(key: key, value: null, unit: PidCatalog.unit(key) ?? '', supported: false);
  }
  final data = bytes.sublist(2);
  final value = PidCatalog.decode(key, data);
  return PidValue(key: key, value: value, unit: PidCatalog.unit(key) ?? '', supported: value != null);
}

/// Convertit une suite hexadécimale (avec ou sans espaces) en octets.
List<int> parseHexBytes(String payload) {
  final cleaned = payload.toUpperCase().replaceAll(RegExp(r'[^0-9A-F]'), '');
  final bytes = <int>[];
  for (var i = 0; i + 1 < cleaned.length; i += 2) {
    bytes.add(int.parse(cleaned.substring(i, i + 2), radix: 16));
  }
  return bytes;
}

/// PID supportés renvoyés par le mode 01 PID 00 / 20 / 40 (masques de 32 bits).
///
/// Un bit à 0 signifie « ce véhicule ne fournit pas ce PID ». L'application liste
/// ces PID comme NON DISPONIBLES ; elle ne les inventera jamais.
Set<int> supportedPidNumbers(String payload) {
  final bytes = parseHexBytes(payload);
  if (bytes.length < 6 || bytes.first != 0x41) return <int>{};
  final base = bytes[1];
  final supported = <int>{};
  for (var i = 0; i < 4; i++) {
    final byte = bytes[i + 2];
    for (var bit = 0; bit < 8; bit++) {
      if ((byte >> (7 - bit)) & 1 == 1) {
        supported.add(base + 1 + (i * 8) + bit);
      }
    }
  }
  return supported;
}
