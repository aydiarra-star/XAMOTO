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

**Ce qui reste à faire sur un poste avec SDK** — dans cet ordre :

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
└── screens/        # 12 écrans
```

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
