/// XAMOTO — Contrat des pilotes Bluetooth (§34).
///
/// Dart ne sait pas ouvrir une liaison SPP/BLE série tout seul : cela dépend de la
/// plateforme (Android, iOS). XAMOTO définit donc un contrat étroit, que chaque
/// plateforme implémente. Le reste de l'application ne connaît QUE ce contrat —
/// c'est le découplage exigé par le §7, et il a une conséquence pratique :
/// aucune couche métier ne dépend d'un modèle d'adaptateur.
///
/// Règle reprise du serveur : un pilote qui ne sait pas faire quelque chose le
/// dit. Il ne renvoie jamais une liste vide « en silence » ni un faux appareil.
library;

/// Type de liaison Bluetooth.
enum BluetoothKind {
  /// Bluetooth classique, profil série (SPP) — le cas courant des ELM327.
  spp,

  /// Bluetooth basse consommation (BLE) — adaptateurs récents.
  ble,
}

class BluetoothDeviceInfo {
  const BluetoothDeviceInfo({
    required this.address,
    required this.name,
    required this.kind,
    this.paired = false,
    this.rssi,
  });

  /// Adresse MAC (Android) ou identifiant opaque (iOS).
  final String address;
  final String name;
  final BluetoothKind kind;
  final bool paired;

  /// Puissance du signal — absente sur certaines plateformes.
  final int? rssi;

  /// Un nom d'adaptateur n'est qu'une PRÉSOMPTION : XAMOTO ne le présente jamais
  /// comme une certitude (voir `lib/obd/device_heuristics.dart` sur le serveur).
  bool get looksLikeObdAdapter {
    final upper = name.toUpperCase();
    const markers = <String>['ELM327', 'OBDII', 'OBD2', 'V-LINK', 'VGATE', 'KONNWEI', 'MINI OBD', 'VEEPEAK', 'OBDLINK'];
    return markers.any(upper.contains);
  }
}

/// Le contrat que TOUTE implémentation Bluetooth doit respecter.
abstract interface class BluetoothDriver {
  /// Identifiant du pilote, affiché à l'utilisateur (« Android SPP », etc.).
  String get id;

  /// Le pilote est-il disponible sur CET appareil (permission, matériel) ?
  bool get isAvailable;

  /// Pourquoi il ne l'est pas — affiché tel quel à l'utilisateur.
  String get unavailableReasonFr;
  String get unavailableReasonEn;

  /// Appareils déjà appairés / visibles. Peut renvoyer une liste vide : c'est une
  /// information honnête, pas un échec.
  Future<List<BluetoothDeviceInfo>> listDevices({BluetoothKind? kind});

  /// Ouvre la liaison série. Lève une [BluetoothDriverException] en cas d'échec.
  Future<BluetoothConnection> open(BluetoothDeviceInfo device, {int baudRate = 38400});
}

/// Liaison ouverte : on écrit des commandes ELM327, on lit les réponses.
abstract interface class BluetoothConnection {
  bool get isOpen;
  Future<void> write(String command);

  /// Lit jusqu'à recevoir le caractère d'invite `>` de l'ELM327.
  Future<String> readUntilPrompt({Duration timeout = const Duration(seconds: 4)});

  Future<void> close();
}

class BluetoothDriverException implements Exception {
  BluetoothDriverException(this.messageFr, {this.messageEn, this.hintFr});

  final String messageFr;
  final String? messageEn;

  /// Ce que l'utilisateur peut faire — jamais un code d'erreur brut.
  final String? hintFr;

  @override
  String toString() => 'BluetoothDriverException: $messageFr';
}
