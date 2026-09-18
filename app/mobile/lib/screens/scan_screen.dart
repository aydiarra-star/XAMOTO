/// XAMOTO — Scan : deux chemins, jamais mélangés.
///
///   1. **Véhicule réel** : le téléphone lit le boîtier par Bluetooth, transmet
///      les mesures, le serveur calcule (§7).
///   2. **Démonstration** : le serveur fournit un scénario simulé, qui s'affiche
///      avec le bandeau MODE SIMULATION (§30).
///
/// Dans les deux cas, un PID non supporté est listé comme NON DISPONIBLE et
/// affiché avec la phrase d'indisponibilité — jamais remplacé par une valeur.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/models/scan.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../obd/bluetooth_driver.dart';
import '../routes.dart';
import '../state/app_state.dart';
import '../widgets/banners.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class ScanScreen extends StatefulWidget {
  const ScanScreen({super.key});

  @override
  State<ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<ScanScreen> {
  String _mode = 'demo';
  String _stage = '';
  String? _scenario = 'engine_fault';
  List<BluetoothDeviceInfo> _devices = <BluetoothDeviceInfo>[];
  BluetoothDeviceInfo? _device;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final ScanResult? scan = state.lastScan;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.nav('nav.diagnostic'))),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          SectionCard(
            title: i18n.t('Type de lecture', 'Reading type'),
            child: Column(
              children: <Widget>[
                SegmentedButton<String>(
                  segments: <ButtonSegment<String>>[
                    ButtonSegment<String>(value: 'demo', label: Text(i18n.t('Démonstration', 'Demo')), icon: const Icon(Icons.science)),
                    ButtonSegment<String>(value: 'ble', label: Text(i18n.t('Véhicule réel (Bluetooth)', 'Real vehicle (Bluetooth)')), icon: const Icon(Icons.bluetooth)),
                  ],
                  selected: <String>{_mode},
                  onSelectionChanged: (selection) => setState(() => _mode = selection.first),
                ),
                if (_mode == 'demo') ...<Widget>[
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: _scenario,
                    decoration: InputDecoration(labelText: i18n.t('Scénario simulé', 'Simulated scenario')),
                    items: <DropdownMenuItem<String>>[
                      for (final scenario in _scenarios)
                        DropdownMenuItem<String>(value: scenario, child: Text(_scenarioLabel(scenario))),
                    ],
                    onChanged: (value) => setState(() => _scenario = value),
                  ),
                ] else
                  _buildBluetoothSection(state, i18n),
                const SizedBox(height: 10),
                if (_stage.isNotEmpty) Text(_stage, style: const TextStyle(fontStyle: FontStyle.italic)),
                const SizedBox(height: 6),
                FilledButton.icon(
                  onPressed: _busy ? null : () => _run(state),
                  icon: const Icon(Icons.play_arrow),
                  label: Text(i18n.t('Lancer le scan', 'Run scan')),
                ),
                ErrorBox(message: state.error),
              ],
            ),
          ),

          if (scan != null) ...<Widget>[
            if (scan.isSimulated) SimulationBanner(i18n: i18n),
            SectionCard(
              title: i18n.t('Résultat de lecture', 'Reading result'),
              subtitle: '${scan.protocol} · ${formatDateTime(scan.startedAt)}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  DataRow(
                    label: i18n.t('Voyant moteur', 'MIL / check engine'),
                    value: scan.milOn ? i18n.t('allumé', 'on') : i18n.t('éteint', 'off'),
                  ),
                  DataRow(label: i18n.t('Codes défaut', 'Fault codes'), value: '${scan.dtcs.length}'),
                  DataRow(label: i18n.t('Mesures disponibles', 'Available readings'), value: '${scan.readings.where((r) => r.supported).length}'),
                  DataRow(label: i18n.t('PID non disponibles', 'Unsupported PIDs'), value: '${scan.unsupportedPids.length}'),
                  const Divider(height: 20),
                  for (final reading in scan.readings)
                    DataRow(
                      label: _labelFor(reading.key, i18n),
                      value: formatReading(reading.value, supported: reading.supported, decimals: 1, unit: reading.unit ?? ''),
                      trailing: OriginTag(origin: reading.origin, i18n: i18n),
                    ),
                  if (scan.unsupportedPids.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 8),
                    Text(i18n.t(
                      'Ces données ne sont pas fournies par ce véhicule : XAMOTO les affiche comme non disponibles, il ne les estime pas.',
                      'This vehicle does not provide these data: XAMOTO shows them as unavailable and does not estimate them.',
                    ), style: const TextStyle(fontSize: 12)),
                  ],
                  const SizedBox(height: 8),
                  OutlinedButton(
                    onPressed: () => Navigator.pushNamed(context, Routes.diagnostic),
                    child: Text(i18n.t('Voir le diagnostic', 'View diagnosis')),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  /// Liste des scénarios : les MÊMES identifiants que le serveur.
  static const List<String> _scenarios = <String>[
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

  String _scenarioLabel(String id) => switch (id) {
        'normal_engine' => 'Moteur normal',
        'weak_battery' => 'Batterie faible',
        'high_temperature' => 'Surchauffe',
        'engine_fault' => 'Ratés d’allumage',
        'multiple_dtc' => 'Plusieurs codes défaut',
        'intermittent_fault' => 'Défaut intermittent',
        'no_start' => 'Ne démarre pas',
        'diesel_egr_dpf' => 'Diesel — EGR / FAP',
        'abs_fault' => 'Freinage — code de châssis',
        _ => id,
      };

  String _labelFor(String key, I18n i18n) {
    // Les libellés viennent du serveur pour les diagnostics ; ici, un libellé
    // court suffit, et la clé technique reste affichée en dessous si besoin.
    const labels = <String, String>{
      'engine_rpm': 'Régime moteur',
      'coolant_temp': 'Température liquide',
      'battery_voltage': 'Tension batterie',
      'engine_load': 'Charge moteur',
      'throttle_position': 'Position papillon',
      'intake_air_temp': 'Température admission',
      'maf_air_flow': 'Débit d’air',
      'map_pressure': 'Pression admission',
      'short_fuel_trim_b1': 'Correction carburant court terme',
      'long_fuel_trim_b1': 'Correction carburant long terme',
      'fuel_level': 'Niveau de carburant',
      'oil_temp': 'Température d’huile',
    };
    return labels[key] ?? key;
  }

  Widget _buildBluetoothSection(AppState state, I18n i18n) {
    final driver = _driverForPlatform();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const SizedBox(height: 10),
        if (!driver.isAvailable)
          NotReadableNotice(i18n: i18n, systems: <String>[driver.unavailableReasonFr])
        else
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              OutlinedButton.icon(
                onPressed: () async {
                  final devices = await driver.listDevices();
                  setState(() {
                    _devices = devices;
                    _device = devices.isNotEmpty ? devices.first : null;
                  });
                },
                icon: const Icon(Icons.bluetooth_searching),
                label: Text(i18n.t('Chercher les appareils appairés', 'Find paired devices')),
              ),
              if (_devices.isNotEmpty) ...<Widget>[
                for (final device in _devices)
                  RadioListTile<String>(
                    value: device.address,
                    groupValue: _device?.address,
                    onChanged: (_) => setState(() => _device = device),
                    title: Text(device.name.isEmpty ? device.address : device.name),
                    subtitle: Text(
                      device.looksLikeObdAdapter
                          // Une présomption, pas une certitude : le nom ne prouve rien.
                          ? i18n.t('Nom d’adaptateur probable — à confirmer par un test de liaison', 'Likely adapter name — to be confirmed by a link test')
                          : device.address,
                    ),
                  ),
              ] else
                Text(i18n.t('Aucun appareil trouvé. Aucun appareil n’est inventé.', 'No device found. No device is invented.')),
            ],
          ),
      ],
    );
  }

  /// Le pilote réel est fourni par la plateforme (Android/iOS). Ici, aucun
  /// pilote n'est embarqué : l'application l'annonce au lieu de faire semblant.
  BluetoothDriver _driverForPlatform() => const _NoPlatformDriver();

  Future<void> _run(AppState state) async {
    setState(() {
      _busy = true;
      _stage = '';
    });
    try {
      if (_mode == 'demo') {
        await state.runSimulationScan(_scenario ?? 'engine_fault');
      } else {
        final driver = _driverForPlatform();
        final device = _device;
        if (device == null) {
          setState(() => _stage = 'Sélectionnez un adaptateur.');
          return;
        }
        await state.runLocalScan(driver: driver, device: device, onProgress: (stage) => setState(() => _stage = stage));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

/// Pilote absent : c'est la vérité de ce dépôt (aucun plugin Bluetooth n'est
/// compilé ici). Une implémentation réelle remplacera cette classe — elle devra
/// respecter le même contrat, et surtout annoncer honnêtement son état.
class _NoPlatformDriver implements BluetoothDriver {
  const _NoPlatformDriver();

  @override
  String get id => 'platform-none';

  @override
  bool get isAvailable => false;

  @override
  String get unavailableReasonFr => 'Aucun pilote Bluetooth n’est installé sur cet appareil.';

  @override
  String get unavailableReasonEn => 'No Bluetooth driver is installed on this device.';

  @override
  Future<List<BluetoothDeviceInfo>> listDevices({BluetoothKind? kind}) async => <BluetoothDeviceInfo>[];

  @override
  Future<BluetoothConnection> open(BluetoothDeviceInfo device, {int baudRate = 38400}) async =>
      throw BluetoothDriverException(unavailableReasonFr, messageEn: unavailableReasonEn);
}
