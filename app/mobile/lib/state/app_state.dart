/// XAMOTO — État de l'application.
///
/// Un seul endroit détient ce que l'utilisateur voit : la langue, le véhicule
/// sélectionné, le dernier scan, le dernier diagnostic et ce qui reste à
/// synchroniser. Les écrans ne parlent pas au serveur directement — ils passent
/// par ici, ce qui évite deux comportements différents pour la même action.
library;

import 'package:flutter/foundation.dart';

import '../api/api_client.dart';
import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/diagnostic.dart';
import '../api/models/scan.dart';
import '../api/models/vehicle.dart';
import '../i18n/locale_controller.dart';
import '../i18n/strings.dart';
import '../obd/bluetooth_driver.dart';
import '../obd/scan_session.dart';
import '../storage/local_db.dart';
import '../storage/repositories.dart';
import '../storage/sync_queue.dart';
import 'sync_service.dart';

/// Où en est l'application vis-à-vis du réseau (§32).
enum ConnectionState { unknown, online, offline }

class AppState extends ChangeNotifier {
  AppState({required this.api, required this.locale, required LocalDatabase database})
      : _db = database,
        vehicles = VehicleRepository(database),
        scans = ScanRepository(database),
        diagnostics = DiagnosticRepository(database),
        pending = PendingRepository(database),
        sync = SyncService(api: api, pending: PendingRepository(database));

  final ApiClient api;
  final LocaleController locale;
  final LocalDatabase _db;

  final VehicleRepository vehicles;
  final ScanRepository scans;
  final DiagnosticRepository diagnostics;
  final PendingRepository pending;
  final SyncService sync;

  List<Vehicle> vehicleList = <Vehicle>[];
  Vehicle? selectedVehicle;
  ScanResult? lastScan;
  DiagnosticResult? lastDiagnostic;
  List<String> warnings = <String>[];
  ConnectionState connection = ConnectionState.unknown;
  int pendingCount = 0;
  bool loading = false;
  String? error;

  I18n get i18n => locale.i18n;

  Future<void> bootstrap() async {
    await locale.load();
    api.setLocale(locale.locale);
    await _loadVehicles();
    await refreshPending();
  }

  Future<void> _loadVehicles() async {
    loading = true;
    notifyListeners();
    try {
      final response = await api.get(Api.vehicles);
      final raw = (response['vehicles'] as List<dynamic>? ?? const <dynamic>[]).whereType<Map<String, dynamic>>().toList();
      final items = raw.map(Vehicle.fromJson).toList();
      vehicleList = items;
      connection = ConnectionState.online;
      // On conserve la réponse du serveur TELLE QUELLE : le mobile n'a pas à
      // « reconstruire » une fiche véhicule à partir de ses propres champs.
      for (final entry in raw) {
        await vehicles.save(Vehicle.fromJson(entry), payload: entry);
      }
      selectedVehicle = items.isNotEmpty ? items.first : null;
      if (selectedVehicle != null) await loadLatestDiagnostic();
    } on ApiException catch (apiError) {
      // Hors ligne : on montre ce que le téléphone a déjà, en le disant.
      connection = apiError.isOffline ? ConnectionState.offline : ConnectionState.unknown;
      vehicleList = await vehicles.all();
      selectedVehicle = vehicleList.isNotEmpty ? vehicleList.first : null;
      warnings = <String>[apiError.message];
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> selectVehicle(Vehicle vehicle) async {
    selectedVehicle = vehicle;
    await loadLatestDiagnostic();
    notifyListeners();
  }

  Future<void> loadLatestDiagnostic() async {
    final vehicle = selectedVehicle;
    if (vehicle == null) return;
    lastDiagnostic = await diagnostics.latest(vehicle.id);
  }

  /// Scan en mode DÉMONSTRATION : les données viennent du simulateur du serveur,
  /// qui les marque `simulated`. Le mobile n'invente rien lui-même.
  Future<ScanResult?> runSimulationScan(String scenario) async {
    final vehicle = selectedVehicle;
    if (vehicle == null) return null;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final response = await api.post(Api.scans, body: <String, Object?>{
        'vehicleId': vehicle.id,
        'mode': 'simulator',
        'scenario': scenario,
        'samples': 5,
      });
      final scan = ScanResult.fromJson(response);
      lastScan = scan;
      await scans.save(scan, vehicleId: vehicle.id);
      final diagnosticPayload = response['diagnostic'];
      if (diagnosticPayload is Map<String, dynamic>) {
        final diagnostic = DiagnosticResult.fromJson(diagnosticPayload);
        lastDiagnostic = diagnostic;
        await diagnostics.save(diagnostic, scanId: scan.sessionId);
      }
      connection = ConnectionState.online;
      return scan;
    } on ApiException catch (apiError) {
      error = apiError.message;
      connection = apiError.isOffline ? ConnectionState.offline : connection;
      return null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  /// Scan RÉEL : la lecture a lieu ici, le calcul sur le serveur (§7).
  Future<ScanResult?> runLocalScan({
    required BluetoothDriver driver,
    required BluetoothDeviceInfo device,
    void Function(String stage)? onProgress,
    String? scenario,
  }) async {
    final vehicle = selectedVehicle;
    if (vehicle == null) return null;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final session = LocalScanSession(driver: driver, device: device);
      onProgress?.call(i18n.t('Lecture du véhicule…', 'Reading the vehicle…'));
      final payload = await session.read(onProgress: onProgress);

      if (!payload.hasData) {
        error = i18n.t(
          'Aucune donnée n’a pu être lue. Aucun diagnostic n’a été produit.',
          'No data could be read. No diagnosis was produced.',
        );
        return null;
      }

      onProgress?.call(i18n.t('Analyse par le moteur XAMOTO…', 'Analysis by the XAMOTO engine…'));
      final response = await api.post(Api.scans, body: payload.toRequest(vehicle.id));
      final scan = ScanResult.fromJson(response);
      lastScan = scan;
      await scans.save(scan, vehicleId: vehicle.id);
      final diagnosticPayload = response['diagnostic'];
      if (diagnosticPayload is Map<String, dynamic>) {
        final diagnostic = DiagnosticResult.fromJson(diagnosticPayload);
        lastDiagnostic = diagnostic;
        await diagnostics.save(diagnostic, scanId: scan.sessionId);
      }
      connection = ConnectionState.online;
      return scan;
    } on ApiException catch (apiError) {
      if (apiError.isOffline) {
        // Le véhicule a été lu, mais le calcul n'a pas pu être fait : on garde la
        // mesure en file et on le dit. On ne conclut PAS localement.
        error = i18n.t(
          'Véhicule lu, mais le serveur est injoignable : le calcul attendra le réseau. XAMOTO ne conclut pas sans son moteur de règles.',
          'Vehicle read, but the server is unreachable: analysis will wait for the network. XAMOTO does not conclude without its rule engine.',
        );
        connection = ConnectionState.offline;
      } else {
        error = apiError.message;
      }
      return null;
    } on BluetoothDriverException catch (driverError) {
      error = driverError.messageFr;
      return null;
    } finally {
      loading = false;
      notifyListeners();
    }
  }

  Future<void> updateTestResult({
    required String diagnosticId,
    required String testKey,
    required String outcome,
    required bool confirmed,
    String? note,
  }) async {
    await diagnostics.saveTestResult(diagnosticId: diagnosticId, testKey: testKey, outcome: outcome, confirmed: confirmed, note: note);
    await sync.sendOrQueue(
      kind: PendingKind.observation,
      opKey: 'test:$diagnosticId:$testKey',
      path: Api.diagnosticTestResultPath(diagnosticId, testKey),
      body: <String, Object?>{'outcome': outcome, 'confirmed': confirmed, if (note != null) 'note': note},
    );
    await refreshPending();
  }

  Future<String?> askAssistant(String question) async {
    try {
      final response = await api.post(Api.assistantAsk, body: <String, Object?>{
        'question': question,
        if (selectedVehicle != null) 'vehicleId': selectedVehicle!.id,
        if (lastDiagnostic != null) 'diagnosticSessionId': lastDiagnostic!.id,
        'locale': locale.locale,
      });
      return response['answerFr'] as String? ?? response['answer'] as String?;
    } on ApiException catch (apiError) {
      error = apiError.message;
      notifyListeners();
      return null;
    }
  }

  Future<void> setLocale(String value) async {
    await locale.setLocale(value);
    api.setLocale(value);
    notifyListeners();
  }

  Future<void> refreshPending() async {
    pendingCount = await pending.countPending();
    notifyListeners();
  }

  Future<SyncReport> syncNow() async {
    final report = await sync.flush(vehicleId: selectedVehicle?.id);
    connection = report.offline ? ConnectionState.offline : ConnectionState.online;
    await refreshPending();
    return report;
  }

  @override
  void dispose() {
    _db.close();
    api.close();
    super.dispose();
  }
}
