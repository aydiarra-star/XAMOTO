/// XAMOTO — Erreurs d'API, traduites en français compréhensible.
///
/// Une panne réseau n'est pas une panne de voiture : l'application doit le dire
/// clairement et proposer de continuer hors ligne (§32) au lieu d'afficher une
/// erreur technique.
library;

class ApiException implements Exception {
  ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.details,
  });

  /// 'offline' | 'unauthorized' | 'invalid_input' | 'not_found' | 'server' | ...
  final String code;
  final String message;
  final int? statusCode;
  final Object? details;

  bool get isOffline => code == 'offline';
  bool get isUnauthorized => code == 'unauthorized';

  factory ApiException.offline() => ApiException(
        code: 'offline',
        message: 'Serveur injoignable. XAMOTO continue hors ligne : les données seront synchronisées plus tard.',
      );

  factory ApiException.unauthorized() => ApiException(
        code: 'unauthorized',
        message: 'Session expirée. Reconnectez-vous pour synchroniser vos données.',
        statusCode: 401,
      );

  factory ApiException.server(int status, String message) => ApiException(
        code: status >= 500 ? 'server' : 'invalid_input',
        message: message,
        statusCode: status,
      );

  @override
  String toString() => 'ApiException($code): $message';
}
