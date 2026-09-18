/// XAMOTO — Accueil.
///
/// L'écran répond à trois questions, dans l'ordre où l'utilisateur se les pose :
/// où en est ma voiture ? puis-je rouler ? et que dois-je faire ensuite ?
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../core/levels.dart';
import '../i18n/strings.dart';
import '../routes.dart';
import '../state/app_state.dart';
import '../widgets/banners.dart';
import '../widgets/badges.dart';
import '../widgets/layout.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final I18n i18n = state.i18n;
    final vehicle = state.selectedVehicle;
    final diagnostic = state.lastDiagnostic;

    return Scaffold(
      appBar: AppBar(
        title: const Text('XAMOTO'),
        actions: <Widget>[
          IconButton(
            tooltip: i18n.t('Langue', 'Language'),
            icon: const Icon(Icons.language),
            onPressed: () => state.setLocale(i18n.locale == 'fr' ? 'en' : i18n.locale == 'en' ? 'wo' : 'fr'),
          ),
          IconButton(
            tooltip: i18n.t('Réglages', 'Settings'),
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.pushNamed(context, Routes.settings),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => state.syncNow(),
        child: ListView(
          padding: const EdgeInsets.all(12),
          children: <Widget>[
            Text(i18n.t('Comprendre · Diagnostiquer · Agir', 'Understand · Diagnose · Act'), style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),

            if (state.connection == ConnectionState.offline)
              OfflineBanner(i18n: i18n, pendingCount: state.pendingCount),
            ErrorBox(message: state.error),

            if (vehicle == null)
              SectionCard(
                title: i18n.t('Aucun véhicule sélectionné', 'No vehicle selected'),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(i18n.t(
                      'Ajoutez un véhicule pour obtenir un diagnostic. Sans véhicule, XAMOTO ne peut rien affirmer.',
                      'Add a vehicle to get a diagnosis. Without a vehicle, XAMOTO cannot assert anything.',
                    )),
                    const SizedBox(height: 8),
                    FilledButton(onPressed: () => Navigator.pushNamed(context, Routes.vehicles), child: Text(i18n.t('Ajouter un véhicule', 'Add a vehicle'))),
                  ],
                ),
              )
            else
              SectionCard(
                title: vehicle.displayName,
                subtitle: '${vehicle.plate} · ${vehicle.year} · ${vehicle.engine}',
                trailing: SafetyBadge(safety: diagnostic?.safety ?? SafetyLevel.normal, i18n: i18n),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    if (diagnostic == null)
                      Text(i18n.t('Aucun diagnostic enregistré pour ce véhicule.', 'No diagnosis stored for this vehicle.'))
                    else ...<Widget>[
                      Row(
                        children: <Widget>[
                          CertaintyBadge(certainty: diagnostic.certainty, i18n: i18n),
                          const SizedBox(width: 8),
                          Expanded(child: Text(i18n.locale == 'en' ? diagnostic.conclusionEn : diagnostic.conclusionFr)),
                        ],
                      ),
                    ],
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      children: <Widget>[
                        FilledButton.icon(
                          onPressed: () => Navigator.pushNamed(context, Routes.scan),
                          icon: const Icon(Icons.usb),
                          label: Text(i18n.t('Lancer un scan', 'Run a scan')),
                        ),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.pushNamed(context, Routes.canIDrive),
                          icon: const Icon(Icons.directions_car),
                          label: Text(i18n.t('Puis-je rouler ?', 'Can I drive?')),
                        ),
                        OutlinedButton.icon(
                          onPressed: () => Navigator.pushNamed(context, Routes.assistant),
                          icon: const Icon(Icons.question_answer),
                          label: Text(i18n.t('Assistant', 'Assistant')),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

            SectionCard(
              title: i18n.t('Ce que XAMOTO peut lire', 'What XAMOTO can read'),
              subtitle: i18n.t(
                'La lecture embarquée ne couvre pas tout le véhicule : freinage, airbags et climatisation sont hors de portée de l’OBD standard.',
                'On-board reading does not cover the whole vehicle: braking, airbags and air conditioning are out of reach of standard OBD.',
              ),
              child: NotReadableNotice(
                i18n: i18n,
                systems: <String>[
                  i18n.t('freinage', 'braking'),
                  i18n.t('airbags', 'airbags'),
                  i18n.t('climatisation', 'air conditioning'),
                ],
              ),
            ),

            SectionCard(
              title: i18n.t('Agir', 'Act'),
              subtitle: i18n.t(
                'Après un diagnostic, ces écrans servent à décider — et à vérifier ce qu’on vous annonce.',
                'After a diagnosis, these screens help you decide — and check what you are told.',
              ),
              child: Wrap(
                spacing: 8,
                runSpacing: 4,
                children: <Widget>[
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.maintenance),
                    icon: const Icon(Icons.build),
                    label: Text(i18n.t('Entretien', 'Maintenance')),
                  ),
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.postRepair),
                    icon: const Icon(Icons.check_circle_outline),
                    label: Text(i18n.t('Après réparation', 'After a repair')),
                  ),
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.secondOpinion),
                    icon: const Icon(Icons.compare_arrows),
                    label: Text(i18n.t('Seconde opinion', 'Second opinion')),
                  ),
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.quotes),
                    icon: const Icon(Icons.receipt_long),
                    label: Text(i18n.t('Devis', 'Quotes')),
                  ),
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.inspection),
                    icon: const Icon(Icons.fact_check_outlined),
                    label: Text(i18n.t('Inspection avant achat', 'Pre-purchase inspection')),
                  ),
                  TextButton.icon(
                    onPressed: () => Navigator.pushNamed(context, Routes.alerts),
                    icon: const Icon(Icons.notifications_none),
                    label: Text(i18n.t('Alertes', 'Alerts')),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        destinations: <NavigationDestination>[
          NavigationDestination(icon: const Icon(Icons.home), label: i18n.nav('nav.home')),
          NavigationDestination(icon: const Icon(Icons.directions_car), label: i18n.nav('nav.vehicles')),
          NavigationDestination(icon: const Icon(Icons.health_and_safety), label: i18n.nav('nav.diagnostic')),
          NavigationDestination(icon: const Icon(Icons.build), label: i18n.nav('nav.maintenance')),
          NavigationDestination(icon: const Icon(Icons.place), label: i18n.nav('nav.garages')),
        ],
        onDestinationSelected: (index) {
          switch (index) {
            case 1:
              Navigator.pushNamed(context, Routes.vehicles);
            case 2:
              Navigator.pushNamed(context, Routes.diagnostic);
            case 3:
              Navigator.pushNamed(context, Routes.maintenance);
            case 4:
              Navigator.pushNamed(context, Routes.garages);
            default:
              Navigator.pushNamed(context, Routes.home);
          }
        },
      ),
    );
  }
}
