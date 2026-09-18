/// XAMOTO — Abstraction de transport (§7).
///
/// La couche OBD ne connaît que cette interface : Wi-Fi, Bluetooth ou simulation
/// se branchant derrière. Le moteur de diagnostic, lui, ne voit que des mesures.
library;

import 'bluetooth_driver.dart';

abstract interface class ObdTransport {
  String get kind;

  Future<void> connect();
  Future<void> write(String command);
  Future<String> readUntilPrompt({Duration timeout});
  Future<void> disconnect();
  bool get isConnected;
}

/// Transport Bluetooth : délègue au pilote de la plateforme.
class BluetoothTransport implements ObdTransport {
  BluetoothTransport({required this.driver, required this.device, this.baudRate = 38400});

  final BluetoothDriver driver;
  final BluetoothDeviceInfo device;
  final int baudRate;

  BluetoothConnection? _connection;

  @override
  String get kind => 'bluetooth';

  @override
  bool get isConnected => _connection?.isOpen ?? false;

  @override
  Future<void> connect() async {
    if (isConnected) return;
    if (!driver.isAvailable) {
      throw BluetoothDriverException(driver.unavailableReasonFr, messageEn: driver.unavailableReasonEn);
    }
    _connection = await driver.open(device, baudRate: baudRate);
  }

  @override
  Future<void> write(String command) async {
    final connection = _connection;
    if (connection == null || !connection.isOpen) {
      throw BluetoothDriverException('Liaison Bluetooth fermée. Reconnectez l’adaptateur.');
    }
    await connection.write(command);
  }

  @override
  Future<String> readUntilPrompt({Duration timeout = const Duration(seconds: 4)}) async {
    final connection = _connection;
    if (connection == null || !connection.isOpen) {
      throw BluetoothDriverException('Liaison Bluetooth fermée. Reconnectez l’adaptateur.');
    }
    return connection.readUntilPrompt(timeout: timeout);
  }

  @override
  Future<void> disconnect() async {
    await _connection?.close();
    _connection = null;
  }
}
