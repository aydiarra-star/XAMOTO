/// XAMOTO — Client HTTP du serveur XAMOTO.
///
/// Le mobile n'exécute AUCUN diagnostic ici : il envoie des mesures, il reçoit
/// des conclusions déjà calculées par le moteur du serveur (§9). Cette séparation
/// est ce qui garantit qu'une même mesure donne la même conclusion sur le web et
/// sur le téléphone.
library;

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'api_error.dart';

class ApiClient {
  ApiClient({required String baseUrl, http.Client? httpClient, Duration? timeout})
      : _baseUrl = baseUrl.endsWith('/') ? baseUrl.substring(0, baseUrl.length - 1) : baseUrl,
        _http = httpClient ?? http.Client(),
        _timeout = timeout ?? const Duration(seconds: 20);

  final String _baseUrl;
  final http.Client _http;
  final Duration _timeout;

  String? _token;
  String _locale = 'fr';

  String get baseUrl => _baseUrl;
  bool get hasToken => _token != null && _token!.isNotEmpty;

  void setToken(String? token) => _token = token;

  /// Langue envoyée à l'assistant : le serveur renvoie le repli expliqué.
  void setLocale(String locale) => _locale = locale;

  Map<String, String> get _headers => <String, String>{
        'content-type': 'application/json',
        'accept': 'application/json',
        'x-xamoto-locale': _locale,
        if (hasToken) 'authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> get(String path, {Map<String, String>? query}) async {
    final uri = _uri(path, query);
    return _send(() => _http.get(uri, headers: _headers));
  }

  Future<Map<String, dynamic>> post(String path, {Object? body, Map<String, String>? query}) async {
    final uri = _uri(path, query);
    return _send(() => _http.post(uri, headers: _headers, body: body == null ? null : jsonEncode(body)));
  }

  Future<Map<String, dynamic>> patch(String path, {Object? body}) async {
    final uri = _uri(path, null);
    return _send(() => _http.patch(uri, headers: _headers, body: body == null ? null : jsonEncode(body)));
  }

  /// Suppression / révocation. XAMOTO n'efface jamais une donnée en silence :
  /// l'appelant doit avoir demandé l'action explicitement.
  Future<Map<String, dynamic>> delete(String path) async {
    final uri = _uri(path, null);
    return _send(() => _http.delete(uri, headers: _headers));
  }

  Uri _uri(String path, Map<String, String>? query) {
    final uri = Uri.parse('$_baseUrl$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: <String, String>{...uri.queryParameters, ...query});
  }

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() request) async {
    try {
      final response = await request().timeout(_timeout);
      return _decode(response);
    } on SocketException {
      throw ApiException.offline();
    } on TimeoutException {
      throw ApiException.offline();
    } on http.ClientException {
      throw ApiException.offline();
    }
  }

  Map<String, dynamic> _decode(http.Response response) {
    Map<String, dynamic> body = <String, dynamic>{};
    if (response.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(response.body);
        if (decoded is Map<String, dynamic>) body = decoded;
      } on FormatException {
        throw ApiException.server(response.statusCode, 'Réponse illisible du serveur.');
      }
    }

    if (response.statusCode == 401) throw ApiException.unauthorized();
    if (response.statusCode >= 400) {
      final error = body['error'];
      final message = error is Map<String, dynamic> ? (error['message'] as String? ?? 'Erreur serveur.') : 'Erreur serveur.';
      throw ApiException.server(response.statusCode, message);
    }
    return body;
  }

  void close() => _http.close();
}
