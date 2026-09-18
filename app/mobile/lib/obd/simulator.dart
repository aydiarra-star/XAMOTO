/// XAMOTO — Simulateur embarqué (§30, §31).
///
/// Il sert à une seule chose : permettre de montrer l'application SANS véhicule
/// et SANS réseau. Les données qu'il produit portent l'origine `simulated` et
/// l'interface affiche « MODE SIMULATION » — partout, sans exception (§47-2).
///
/// Ces données ne sont JAMAIS envoyées au serveur comme des mesures : le serveur
/// refuse une origine `simulated` dans un scan local, précisément pour rendre ce
/// mélange impossible.
library;

import 'pid_decoder.dart';

/// Les scénarios sont les MÊMES que ceux du serveur.
///
/// `tools/test/mobile_contract.test.ts` compare cette liste à
/// `obd/src/simulator/scenarios.ts` : proposer un scénario que le serveur ne
/// connaît pas ferait échouer la démonstration en mode connecté.
const List<String> kSimulatorScenarioIds = <String>[
  'normal_engine',
  'weak_battery',
  'high_temperature',
  'engine_fault',
  'multiple_dtc',
  'intermittent_fault',
  'no_start',
  'diesel_egr_dpf',
  'abs_fault',
];

class SimulatedReading {
  const SimulatedReading({
    required this.key,
    required this.value,
    required this.supported,
    this.origin = 'simulated',
  });

  final String key;
  final double? value;
  final bool supported;
  final String origin;
}

class SimulatedScan {
  const SimulatedScan({
    required this.scenario,
    required this.readings,
    required this.dtcCodes,
    required this.milOn,
    required this.narrativeFr,
    required this.narrativeEn,
  });

  final String scenario;
  final List<SimulatedReading> readings;
  final List<String> dtcCodes;
  final bool milOn;
  final String narrativeFr;
  final String narrativeEn;
}

/// Un état simulé simple, volontairement grossier : il montre des ordres de
/// grandeur, il ne prétend pas reproduire un moteur réel.
class ObdSimulatorSource {
  ObdSimulatorSource({required this.scenario}) {
    if (!kSimulatorScenarioIds.contains(scenario)) {
      throw ArgumentError('Scénario inconnu : $scenario');
    }
  }

  final String scenario;
  int _elapsedSeconds = 0;

  int get elapsedSeconds => _elapsedSeconds;

  /// Avance la simulation et renvoie l'état courant.
  SimulatedScan tick({int seconds = 5}) {
    _elapsedSeconds += seconds;
    final warm = (26 + (89 - 26) * (1 - _exp(-_elapsedSeconds / 240))).clamp(20, 130).toDouble();

    final coolant = scenario == 'high_temperature'
        ? 114.0
        : scenario == 'no_start'
            ? 24.0
            : double.parse(warm.toStringAsFixed(1));

    final running = !(scenario == 'no_start' && _elapsedSeconds < 40);
    final rpm = !running
        ? 0.0
        : scenario == 'engine_fault'
            ? 760.0
            : 780.0;

    final voltage = scenario == 'weak_battery'
        ? (running ? 12.9 : 11.6)
        : (running ? 14.25 : 12.55);

    final readings = <SimulatedReading>[
      SimulatedReading(key: 'engine_rpm', value: rpm, supported: true),
      SimulatedReading(key: 'coolant_temp', value: coolant, supported: true),
      SimulatedReading(key: 'battery_voltage', value: voltage, supported: true),
      SimulatedReading(key: 'engine_load', value: scenario == 'high_temperature' ? 42 : 22, supported: true),
      // Un PID que ce véhicule simulé ne fournit pas : il est listé comme non
      // disponible, jamais remplacé par une valeur (c'est le cœur du §47-1).
      SimulatedReading(key: 'oil_temp', value: null, supported: false),
    ];

    final dtcs = switch (scenario) {
      'engine_fault' => <String>['P0300', 'P0301'],
      'multiple_dtc' => <String>['P0171', 'P0300', 'P0420'],
      'diesel_egr_dpf' => <String>['P0401', 'P2002', 'P2463'],
      'no_start' => <String>['P0335', 'P0562'],
      'abs_fault' => <String>['C0035', 'C0040'],
      'intermittent_fault' => _elapsedSeconds >= 30 ? <String>['P0135'] : <String>[],
      _ => <String>[],
    };

    return SimulatedScan(
      scenario: scenario,
      readings: readings,
      dtcCodes: dtcs,
      milOn: dtcs.isNotEmpty,
      narrativeFr: _narrativeFr(dtcs.length),
      narrativeEn: _narrativeEn(dtcs.length),
    );
  }

  String _narrativeFr(int dtcCount) => switch (scenario) {
        'high_temperature' => 'Température de liquide élevée : arrêter le moteur et contrôler le refroidissement.',
        'weak_battery' => 'Batterie faible : la tension de repos est basse.',
        'abs_fault' => 'Le véhicule roule, mais un code de châssis est présent : aucune mesure de roue n’est disponible par l’OBD.',
        _ when dtcCount > 0 => '$dtcCount code(s) défaut enregistré(s).',
        _ => 'Aucun défaut enregistré sur ce véhicule simulé.',
      };

  String _narrativeEn(int dtcCount) => switch (scenario) {
        'high_temperature' => 'High coolant temperature: stop the engine and check cooling.',
        'weak_battery' => 'Weak battery: resting voltage is low.',
        'abs_fault' => 'The vehicle drives, but a chassis code is present: no wheel measurement is available over OBD.',
        _ when dtcCount > 0 => '$dtcCount fault code(s) stored.',
        _ => 'No fault stored on this simulated vehicle.',
      };

  double _exp(double value) {
    // Implémentation locale : évite d'importer `dart:math` pour une exponentielle.
    var sum = 0.0;
    var term = 1.0;
    for (var i = 1; i <= 20; i++) {
      term *= -value / i;
      sum += term;
    }
    return 1 + sum;
  }
}

/// Le simulateur ne doit jamais produire un PID que XAMOTO ne sait pas lire.
bool simulatorProducesKnownPids(SimulatedScan scan) =>
    scan.readings.every((reading) => PidCatalog.obdPid(reading.key) != null);
