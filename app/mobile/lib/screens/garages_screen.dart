/// XAMOTO — Garages (§21) et envoi d'un diagnostic.
///
/// XAMOTO ne classe pas les garages et ne juge pas les prix : il affiche ce qui
/// est déclaré, avec la provenance, et permet d'envoyer un résumé factuel. Le
/// partage n'a lieu qu'avec le consentement explicite de l'utilisateur (§47-8).
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/garage.dart';
import '../i18n/strings.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

class GaragesScreen extends StatefulWidget {
  const GaragesScreen({super.key});

  @override
  State<GaragesScreen> createState() => _GaragesScreenState();
}

class _GaragesScreenState extends State<GaragesScreen> {
  List<Garage> _garages = <Garage>[];
  String? _notice;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final state = context.read<AppState>();
    try {
      final response = await state.api.get(Api.garages, query: <String, String>{'country': 'SN'});
      setState(() {
        _garages = (response['garages'] as List<dynamic>? ?? const <dynamic>[])
            .whereType<Map<String, dynamic>>()
            .map(Garage.fromJson)
            .toList();
        _notice = response['noticeFr'] as String?;
        _loading = false;
      });
    } on ApiException catch (error) {
      setState(() {
        _error = error.message;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final I18n i18n = context.watch<AppState>().i18n;
    return Scaffold(
      appBar: AppBar(title: Text(i18n.nav('nav.garages'))),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(12),
              children: <Widget>[
                if (_notice != null) Text(_notice!, style: const TextStyle(fontStyle: FontStyle.italic)),
                ErrorBox(message: _error),
                for (final garage in _garages)
                  SectionCard(
                    title: garage.name,
                    subtitle: '${garage.city} · ${garage.country}${garage.verified ? ' · ${i18n.t('vérifié', 'verified')}' : ''}',
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        if (garage.specialties.isNotEmpty)
                          DataRow(label: i18n.t('Spécialités', 'Specialties'), value: garage.specialties.join(', ')),
                        if (garage.services.isNotEmpty)
                          DataRow(label: i18n.t('Prestations', 'Services'), value: garage.services.join(', ')),
                        DataRow(
                          label: i18n.t('Diagnostic XAMOTO accepté', 'XAMOTO diagnosis accepted'),
                          value: garage.acceptsXamotoDiagnostics ? i18n.t('oui', 'yes') : i18n.t('non renseigné', 'not provided'),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 8,
                          children: <Widget>[
                            if (garage.lat != null && garage.lon != null)
                              OutlinedButton.icon(
                                // Carte ouverte dans le navigateur : OpenStreetMap (§34).
                                onPressed: () => launchUrl(
                                  Uri.parse('https://www.openstreetmap.org/?mlat=${garage.lat}&mlon=${garage.lon}#map=17/${garage.lat}/${garage.lon}'),
                                ),
                                icon: const Icon(Icons.map),
                                label: Text(i18n.t('Voir sur la carte', 'View on map')),
                              ),
                            if (garage.phone != null)
                              OutlinedButton.icon(
                                onPressed: () => launchUrl(Uri.parse('tel:${garage.phone}')),
                                icon: const Icon(Icons.phone),
                                label: Text(garage.phone!),
                              ),
                          ],
                        ),
                      ],
                    ),
                  ),
              ],
            ),
    );
  }
}
