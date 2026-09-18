# XAMOTO Mobile (Flutter/Dart)

Application mobile de XAMOTO : lire le véhicule par Bluetooth, travailler hors ligne,
et afficher les conclusions du **même** moteur de diagnostic que le web.

## ⚠️ Statut : code écrit, non compilé ici

Ce dépôt n'a **pas** pu exécuter `flutter pub get`, `flutter analyze` ni
`flutter test` : l'environnement de développement n'a accès qu'au registre npm et à
GitHub (vérifié : `pub.dev` et `storage.googleapis.com` injoignables, aucun `dart`
ni `flutter` installé). Le code Dart est donc **livré sans exécution**.

Ce qui a été fait à la place, et qui est vérifié automatiquement :

| Vérification | Où | Ce qu'elle attrape |
| --- | --- | --- |
| **Contrat de routes** | `npm run test:e2e` | Un chemin ou un verbe HTTP appelé par le mobile qui n'existe pas côté serveur (a déjà trouvé `GET /api/knowledge/dtc/:code`, inexistant, et l'usage de `POST` là où la synchronisation attend `GET`) |
| **Phrases exigées** | `npm test` | Une phrase du §16 reformulée sur mobile → refus |
| **Écrans** | `npm test` | Un écran déclaré dans `routes.dart` sans fichier, ou non branché dans `app.dart` |
| **Catalogue wolof** | `npm test` | Un mot wolof recopié à la main, ou un catalogue embarqué différent de `shared/src/i18n.ts` |
| **Scénarios simulés** | `npm test` | Un scénario proposé sur mobile que le serveur ne connaît pas |
| **Dart statique** | `npm test` | Un délimiteur oublié, un symbole `Api.x` / `Routes.x` inexistant, un import cassé — sans compilateur (12 suites, 192 tests au total) |

## Première exécution sur un poste équipé — pas à pas

Le dossier ne contient **que** le code Dart (`lib/`, `test/`, `pubspec.yaml`) : les
dossiers de plateforme ne sont pas versionnés, parce qu'ils sont générés par le SDK
et qu'aucun SDK n'a pu les produire ici. La toute première étape est donc de les
créer — c'est la commande qui manque à qui essaie `flutter run` directement.

```bash
cd app/mobile
flutter create --platforms=android,ios --org com.xamoto .   # génère android/ et ios/ (n'écrase pas lib/)
flutter pub get                                             # résout pubspec.yaml
flutter analyze                                             # doit sortir sans erreur
flutter test                                                # 4 fichiers de test/ (niveaux, PID, file d'attente, wolof)
flutter run --dart-define=XAMOTO_API=http://10.0.2.2:3000   # émulateur Android → serveur local
```

Points à connaître avant d'interpréter un résultat :

- **L'adresse du serveur** est le seul réglage : `XAMOTO_API`. Depuis un émulateur
  Android, `10.0.2.2` désigne la machine hôte ; depuis un téléphone réel, c'est
  l'adresse IP de votre ordinateur sur le même réseau (et le port 3000 doit être
  joignable). Lancé depuis ce dépôt : `npm start` (API) ou `npm run dev` (API + web).
- **Trois imports inutilisés connus** subsistent dans du code antérieur
  (`guided_tests_screen.dart`, `maintenance_screen.dart`, `vehicles_screen.dart`) :
  `flutter analyze` les signale, ils ne cassent pas l'exécution, et ils sont listés
  dans `tools/test/dart_static.test.ts`. Le jour où l'analyseur tourne, retirez-les
  et videz cette liste : le test refusera tout NOUVEL import inutilisé.
- **Le Bluetooth ne se teste pas sur émulateur** : il faut un téléphone et un
  adaptateur ELM327 réel. Sans adaptateur, l'application fonctionne en mode
  démonstration (simulateur côté serveur, bandeau « MODE SIMULATION »).
- **Aucun écran ne doit être considéré comme vérifié avant `flutter analyze` +
  `flutter test`** : c'est la règle du projet, pas une précaution de style.

Le reste de cette page décrit ce qui reste à faire, dans l'ordre :

```bash
cd app/mobile
flutter pub get
flutter analyze          # les règles sont dans analysis_options.yaml
flutter test             # test/ contient les vérifications de logique pure
flutter run              # sur un appareil avec adaptateur ELM327
```

Tant que ces quatre commandes n'ont pas tourné, le code mobile est **proposé**, pas
livré. Aucun écran ne doit être considéré comme vérifié avant.

## Architecture

```
lib/
├── api/            # client HTTP, points d'entrée, modèles (lecture seule du serveur)
├── core/           # niveaux (§10, §11), provenance (§33), phrases exigées (§16), formatage
├── obd/            # couche OBD locale : transport, ELM327, PID, DTC, session, simulateur
├── storage/        # SQLite local : véhicules, scans, diagnostics, file d'attente
├── state/          # état applicatif partagé + synchronisation
├── i18n/           # textes fr/en + catalogue wolof GÉNÉRÉ
└── screens/        # 17 écrans
```

### Les 17 écrans

| Écran | Section | Ce qu'il fait |
| --- | --- | --- |
| `login_screen` | §34 | Connexion, mode démonstration |
| `home_screen` | §1 | État du véhicule, « puis-je rouler ? », entrées « Agir » |
| `vehicles_screen` | §6 | Ajout et sélection des véhicules |
| `scan_screen` | §7, §8 | Scan réel (Bluetooth) ou simulé, toujours étiqueté |
| `diagnostic_screen` | §9, §10 | Constats, hypothèses, certitude et sécurité |
| `can_i_drive_screen` | §12 | Réponse justifiée, sans garantie |
| `guided_tests_screen` | §17 | Tests guidés, résultat **confirmé** par l'utilisateur |
| `assistant_screen` | §13 | Assistant explicatif anti-hallucination |
| `maintenance_screen` | §22 | Plan d'entretien et échéances |
| `garages_screen` | §21 | Annuaire, carte, partage consenti |
| `report_screen` | §25 | Rapport partageable et QR |
| `settings_screen` | §40 | Langue, synchronisation, données locales |
| `quotes_screen` | §27 | Devis reçu : saisie sans montant inventé, analyse factuelle |
| `post_repair_screen` | §19 | Réparation déclarée puis comparaison avant/après |
| `second_opinion_screen` | §20 | Diagnostic reçu confronté aux mesures, questions à poser |
| `inspection_screen` | §24 | Inspection avant achat, scores et points bloquants |
| `alerts_screen` | §22 | Alertes mesurées, marquage comme lu |

Deux règles communes à ces trois derniers écrans, parce qu'ils sont ceux où l'on
est tenté d'inventer : **aucun montant n'est écrit à la place du garage** (une
ligne de devis sans montant bloque l'enregistrement au lieu de recevoir un `0`),
et **un devis sans lien avec une mesure n'est pas une faute** (freinage,
climatisation, carrosserie ne sont pas lisibles en OBD).

### La frontière qui compte (§7, §9)

```
Téléphone                                  Serveur
─────────                                  ───────
adaptateur ELM327  →  lecture OBD     ─┐
décodage PID / DTC (normes J1979/J2012) │  mesures brutes + provenance
                                        └──────────────►  moteur de règles
                                                          base de connaissances
                                                          assistant (RAG)
                                        ◄──────────────  conclusion + niveaux
```

**Aucune règle de diagnostic n'est recopiée dans le mobile.** C'est ce qui garantit
qu'un même véhicule donne la même conclusion sur le web et sur le téléphone. Le mode
`local` de `POST /api/scans` matérialise cette frontière : le téléphone envoie ses
mesures, le serveur calcule, et le serveur **refuse** une mesure marquée `simulated`
(le simulateur vit sur le serveur — §30, §47-2).

Un scan local vide est également refusé : mieux vaut une erreur explicite qu'un
« tout va bien » sans fondement.

## Le pilote Bluetooth : le seul travail proprement natif

Dart ne sait pas ouvrir une liaison série SPP/BLE : cela dépend de la plateforme.
`lib/obd/bluetooth_driver.dart` définit le contrat que chaque plateforme implémente,
et rien d'autre dans l'application ne le connaît.

```dart
abstract interface class BluetoothDriver {
  String get id;
  bool get isAvailable;
  String get unavailableReasonFr;      // dit POURQUOI, à l'utilisateur
  String get unavailableReasonEn;
  Future<List<BluetoothDeviceInfo>> listDevices({BluetoothKind? kind});
  Future<BluetoothConnection> open(BluetoothDeviceInfo device, {int baudRate});
}
```

Le dépôt fournit volontairement un pilote **absent** (`_NoPlatformDriver`) qui
s'annonce comme tel : c'est la vérité de ce dépôt, et cela évite qu'un écran affiche
« aucun appareil trouvé » alors qu'aucun pilote n'existe.

Règles héritées de la couche serveur, à ne pas contourner :

- un pilote indisponible renvoie une liste **vide** et l'explique — jamais une liste
  d'appareils inventée ;
- un nom qui ressemble à un adaptateur reste une **présomption** (`looksLikeObdAdapter`)
  tant qu'un `ATZ` n'a pas répondu ;
- `NO DATA`, `UNABLE TO CONNECT`, `BUS INIT: ERROR` sont des **réponses**, pas des
  valeurs : elles signifient « je ne sais pas », jamais « 0 ».

## Hors ligne (§32)

L'application écrit toujours en local d'abord, puis synchronise. Trois règles sont
écrites dans le code, pas dans une charte :

1. une **observation** de l'utilisateur n'est jamais perdue (elle reste en file
   jusqu'à acceptation) : `ConflictPolicy.localWins` ;
2. une **conclusion** du serveur n'est jamais écrasée par un état local :
   `ConflictPolicy.serverWins` ;
3. un partage en désaccord n'est pas tranché à la place de l'utilisateur :
   `ConflictPolicy.askUser`.

## Le wolof n'est pas embarqué à la main

`lib/i18n/catalogue.g.dart` est **généré** depuis `shared/src/i18n.ts` :

```bash
npm run mobile:i18n      # depuis la racine du dépôt
```

Une consigne de sécurité non relue (`status != reviewed`) n'est jamais affichée en
wolof : l'interface montre le français et l'explique. Le test de contrat échoue si le
fichier livré n'est plus exactement celui que produit le script.

## Tests Dart prévus (à exécuter avec le SDK)

`test/` contient les vérifications de logique pure, celles qui ne demandent ni
appareil ni réseau : décodage des PID, décodage des codes défaut, nettoyage des
réponses ELM327, niveaux de certitude, file de synchronisation, catalogue wolof.
