/// XAMOTO — Lecture et décodage des codes défaut (SAE J2012).
///
/// Un code défaut n'est pas un diagnostic (§9) : c'est une indication du
/// calculateur. XAMOTO le transmet tel quel, avec son statut, et laisse le moteur
/// du serveur décider ce qu'on peut en dire.
library;

class RawDtc {
  const RawDtc({required this.code, required this.status});

  final String code;

  /// 'active' | 'pending' | 'stored' | 'permanent'
  final String status;
}

/// Décode une réponse de mode 03 / 07 / 0A en codes défaut.
///
/// La réponse contient un nombre annoncé puis des paires d'octets :
/// `43 02 01 33 04 20` → 2 codes → P0133, P0420.
List<RawDtc> decodeDtcResponse(String payload, {required String status}) {
  final bytes = hexBytes(payload);
  if (bytes.length < 2) return <RawDtc>[];
  final mode = bytes.first;
  if (mode != 0x43 && mode != 0x47 && mode != 0x4A) return <RawDtc>[];

  final announced = bytes[1];
  final codes = <RawDtc>[];
  var index = 2;
  while (index + 1 < bytes.length && codes.length < announced) {
    final code = decodeDtcPair(bytes[index], bytes[index + 1]);
    if (code != null) codes.add(RawDtc(code: code, status: status));
    index += 2;
  }
  return codes;
}

/// Convertit deux octets en code normalisé, ou `null` si c'est un remplissage.
String? decodeDtcPair(int first, int second) {
  // 00 00 / FF FF : aucun code à cet emplacement, et non un « code zéro ».
  if ((first == 0 && second == 0) || (first == 0xFF && second == 0xFF)) return null;

  const letters = <String>['P', 'C', 'B', 'U'];
  final family = letters[(first >> 6) & 0x03];
  final digit = (first >> 4) & 0x03;
  final rest = ((first & 0x0F) << 8) | second;
  return '$family$digit${rest.toRadixString(16).toUpperCase().padLeft(3, '0')}';
}

/// Un code valide au sens de la norme ?
bool isValidDtc(String code) => RegExp(r'^[PCBU][0-3][0-9A-F]{3}$').hasMatch(code);

/// Famille d'un code — une indication, jamais une conclusion.
String dtcFamilyFr(String code) {
  if (code.isEmpty) return 'Code inconnu';
  switch (code[0]) {
    case 'P':
      return 'Groupe motopropulseur';
    case 'C':
      return 'Châssis (freinage, ABS, direction)';
    case 'B':
      return 'Carrosserie (airbags, confort)';
    case 'U':
      return 'Réseau de communication entre calculateurs';
    default:
      return 'Code inconnu';
  }
}

/// Message affiché pour un code que la base ne documente pas (§16).
///
/// XAMOTO ne « complète » jamais un code inconnu par une hypothèse plausible.
const String kUnknownDtcFr = 'Je ne dispose pas de cette donnée pour votre véhicule.';

List<int> hexBytes(String payload) {
  final cleaned = payload.toUpperCase().replaceAll(RegExp(r'[^0-9A-F]'), '');
  final bytes = <int>[];
  for (var i = 0; i + 1 < cleaned.length; i += 2) {
    bytes.add(int.parse(cleaned.substring(i, i + 2), radix: 16));
  }
  return bytes;
}
