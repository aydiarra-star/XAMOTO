/// XAMOTO — Session de lecture locale, dans le téléphone (§7).
///
/// C'est ici que passe la frontière décrite par le cahier des charges :
///
///   Application → couche OBD → abstraction de protocole → moteur de données →
///   moteur de diagnostic.
///
/// Les deux derniers étages vivent sur le SERVEUR. Le téléphone lit, transmet des
/// mesures brutes avec leur provenance, et reçoit une conclusion déjà calculée.
/// Conséquence pratique : un même véhicule donne la même conclusion sur le web et
/// sur le mobile, et aucune règle de diagnostic ne doit être recopiée ici.
library;

import 'dart:convert';

import 'bluetooth_driver.dart';
import 'dtc_reader.dart';
import 'elm327.dart';
import 'pid_decoder.dart';
import 'transport.dart';

/// Mesure transmise au serveur. `origin` dit d'où elle vient (§33).
class LocalReading {
  const LocalReading({required this.key, required this.value, required this.supported, required this.origin, this.unit});

  final String key;
  final double? value;
  final bool supported;
  final String origin;
  final String? unit;

  Map<String, Object?> toJson() => <String, Object?>{
        'key': key,
        'value': value,
        'supported': supported,
        'origin': origin,
        if (unit != null) 'unit': unit,
      };
}

class LocalScanPayload {
  const LocalScanPayload({
    required this.protocol,
    required this.milOn,
    required this.readings,
    required this.dtcs,
    required this.unsupportedPids,
    required this.warnings,
    this.device,
  });

  final String? protocol;
  final bool milOn;
  final List<LocalReading> readings;
  final List<RawDtc> dtcs;
  final List<String> unsupportedPids;
  final List<String> warnings;
  final Map<String, Object?>? device;

  /// Corps envoyé à `POST /api/scans` en mode `local`.
  Map<String, Object?> toRequest(String vehicleId) => <String, Object?>{
        'vehicleId': vehicleId,
        'mode': 'local',
        'local': <String, Object?>{
          'protocol': protocol,
          if (device != null) 'device': device,
          'milOn': milOn,
          'readings': readings.map((reading) => reading.toJson()).toList(),
          'dtcs': dtcs
              .map((dtc) => <String, Object?>{'code': dtc.code, 'status': dtc.status})
              .toList(),
          if (unsupportedPids.isNotEmpty) 'unsupportedPids': unsupportedPids,
          if (warnings.isNotEmpty) 'warnings': warnings,
        },
      };

  String toJsonString(String vehicleId) => jsonEncode(toRequest(vehicleId));

  bool get hasData => readings.any((reading) => reading.supported) || dtcs.isNotEmpty;
}

/// PID interrogés par défaut, dans l'ordre utile au diagnostic.
const List<String> kDefaultPidKeys = <String>[
  'engine_rpm',
  'coolant_temp',
  'battery_voltage',
  'engine_load',
  'throttle_position',
  'intake_air_temp',
  'maf_air_flow',
  'map_pressure',
  'short_fuel_trim_b1',
  'long_fuel_trim_b1',
  'fuel_level',
  'oil_temp',
];

class LocalScanSession {
  LocalScanSession({
    required this.driver,
    required this.device,
    this.pidKeys = kDefaultPidKeys,
    this.baudRate = 38400,
  });

  final BluetoothDriver driver;
  final BluetoothDeviceInfo device;
  final List<String> pidKeys;
  final int baudRate;

  /// Lit le véhicule et renvoie des mesures brutes, prêtes à être envoyées.
  ///
  /// [onProgress] reçoit une étape lisible — l'utilisateur voit ce qui se passe
  /// plutôt qu'une barre de progression muette.
  Future<LocalScanPayload> read({void Function(String stage)? onProgress}) async {
    final transport = BluetoothTransport(driver: driver, device: device, baudRate: baudRate);
    final session = Elm327Session(transport);
    final warnings = <String>[];

    try {
      onProgress?.call('Connexion à l’adaptateur…');
      await session.initialize();

      onProgress?.call('Lecture des PID supportés par le véhicule…');
      final blocks = await session.readSupportedPidBlocks();
      final supportedNumbers = <int>{};
      for (final block in blocks) {
        supportedNumbers.addAll(supportedPidNumbers(block));
      }

      onProgress?.call('Lecture des mesures…');
      final readings = <LocalReading>[];
      final unsupported = <String>[];

      for (final key in pidKeys) {
        final obdPid = PidCatalog.obdPid(key);
        if (obdPid == null) continue;
        final number = int.parse(obdPid, radix: 16);

        // Le véhicule a dit qu'il ne fournit pas ce PID : on ne le demande même
        // pas, et on le déclare non disponible.
        if (supportedNumbers.isNotEmpty && !supportedNumbers.contains(number)) {
          unsupported.add(key);
          readings.add(LocalReading(key: key, value: null, supported: false, origin: 'measured'));
          continue;
        }

        final response = await session.readPid(obdPid);
        if (response.isEmpty) {
          unsupported.add(key);
          readings.add(LocalReading(key: key, value: null, supported: false, origin: 'measured'));
          continue;
        }
        final decoded = decodeMode01(key, response);
        readings.add(
          LocalReading(
            key: key,
            value: decoded.value,
            supported: decoded.supported,
            unit: decoded.unit,
            origin: 'measured',
          ),
        );
        if (!decoded.supported) unsupported.add(key);
      }

      onProgress?.call('Lecture des codes défaut…');
      final dtcs = <RawDtc>[
        ...decodeDtcResponse(await session.readDtcs(mode: '03'), status: 'active'),
        ...decodeDtcResponse(await session.readDtcs(mode: '07'), status: 'pending'),
        ...decodeDtcResponse(await session.readDtcs(mode: '0A'), status: 'stored'),
      ];

      onProgress?.call('Lecture de l’état du voyant moteur…');
      final milOn = parseMilStatus(await session.readMilStatus());

      if (readings.every((reading) => !reading.supported) && dtcs.isEmpty) {
        warnings.add('Aucune donnée n’a pu être lue. Le diagnostic ne pourra rien conclure.');
      }

      return LocalScanPayload(
        protocol: session.protocol,
        milOn: milOn,
        readings: readings,
        dtcs: dtcs,
        unsupportedPids: unsupported,
        warnings: warnings,
        device: <String, Object?>{
          'id': device.address,
          'label': device.name.isEmpty ? 'Adaptateur OBD' : device.name,
          'kind': device.kind == BluetoothKind.ble ? 'bluetooth' : 'bluetooth',
        },
      );
    } finally {
      await session.disconnect();
    }
  }
}

/// État du voyant moteur (mode 01 PID 01, bit 7 du premier octet).
bool parseMilStatus(String payload) {
  final bytes = hexBytes(payload);
  if (bytes.length < 3 || bytes.first != 0x41) return false;
  return (bytes[2] & 0x80) != 0;
}

/// Nombre de codes défaut annoncé par le calculateur (PID 01, octet 1).
int parseMilDtcCount(String payload) {
  final bytes = hexBytes(payload);
  if (bytes.length < 3 || bytes.first != 0x41) return 0;
  return bytes[2] & 0x7F;
}
