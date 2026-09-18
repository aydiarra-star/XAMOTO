/// XAMOTO — Véhicules : la fiche qui sert de socle à tout le reste.
///
/// Un véhicule sans données d'entretien utile est un véhicule sans historique :
/// XAMOTO le dit plutôt que de « remplir » avec des intervalles inventés.
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_error.dart';
import '../api/endpoints.dart';
import '../api/models/vehicle.dart';
import '../core/format.dart';
import '../i18n/strings.dart';
import '../routes.dart';
import '../state/app_state.dart';
import '../widgets/layout.dart';

class VehiclesScreen extends StatelessWidget {
  const VehiclesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;

    return Scaffold(
      appBar: AppBar(title: Text(i18n.nav('nav.vehicles'))),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openAddSheet(context),
        icon: const Icon(Icons.add),
        label: Text(i18n.t('Ajouter', 'Add')),
      ),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: <Widget>[
          if (state.vehicleList.isEmpty) Text(i18n.t('Aucun véhicule enregistré.', 'No vehicle stored.')),
          for (final vehicle in state.vehicleList)
            SectionCard(
              title: vehicle.displayName,
              subtitle: '${vehicle.brand} ${vehicle.model} · ${vehicle.year} · ${vehicle.plate}',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  DataRow(label: i18n.t('Kilométrage', 'Odometer'), value: formatKm(vehicle.odometerKm)),
                  DataRow(label: i18n.t('Moteur', 'Engine'), value: vehicle.engine.isEmpty ? kMissingValue : vehicle.engine),
                  DataRow(label: i18n.t('Boîte', 'Gearbox'), value: vehicle.gearbox.isEmpty ? kMissingValue : vehicle.gearbox),
                  DataRow(label: i18n.t('VIN', 'VIN'), value: vehicle.vin ?? i18n.t('non renseigné', 'not provided')),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: <Widget>[
                      OutlinedButton(
                        onPressed: () async {
                          await context.read<AppState>().selectVehicle(vehicle);
                          if (context.mounted) Navigator.pushNamed(context, Routes.scan);
                        },
                        child: Text(i18n.t('Scanner ce véhicule', 'Scan this vehicle')),
                      ),
                      OutlinedButton(
                        onPressed: () async {
                          await context.read<AppState>().selectVehicle(vehicle);
                          if (context.mounted) Navigator.pushNamed(context, Routes.maintenance);
                        },
                        child: Text(i18n.t('Entretien', 'Maintenance')),
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

  Future<void> _openAddSheet(BuildContext context) async {
    final state = context.read<AppState>();
    final I18n i18n = state.i18n;
    final brand = TextEditingController();
    final model = TextEditingController();
    final year = TextEditingController();
    final plate = TextEditingController();
    final odometer = TextEditingController();

    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(sheetContext).viewInsets.bottom, left: 16, right: 16, top: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(i18n.t('Nouveau véhicule', 'New vehicle'), style: Theme.of(sheetContext).textTheme.titleLarge),
            TextField(controller: brand, decoration: InputDecoration(labelText: i18n.t('Marque', 'Brand'))),
            TextField(controller: model, decoration: InputDecoration(labelText: i18n.t('Modèle', 'Model'))),
            TextField(controller: year, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: i18n.t('Année', 'Year'))),
            TextField(controller: plate, decoration: InputDecoration(labelText: i18n.t('Immatriculation', 'Plate'))),
            TextField(controller: odometer, keyboardType: TextInputType.number, decoration: InputDecoration(labelText: i18n.t('Kilométrage', 'Odometer (km)'))),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: () async {
                try {
                  await state.api.post(Api.vehicles, body: <String, Object?>{
                    'brand': brand.text.trim(),
                    'model': model.text.trim(),
                    'year': int.tryParse(year.text.trim()) ?? 0,
                    'plate': plate.text.trim(),
                    'odometerKm': int.tryParse(odometer.text.trim()) ?? 0,
                  });
                  await state.syncNow();
                  if (sheetContext.mounted) Navigator.pop(sheetContext);
                } on ApiException catch (error) {
                  // Une erreur de saisie s'affiche ; elle n'est jamais absorbée.
                  if (sheetContext.mounted) {
                    ScaffoldMessenger.of(sheetContext).showSnackBar(SnackBar(content: Text(error.message)));
                  }
                }
              },
              child: Text(i18n.t('Enregistrer', 'Save')),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}
