# XAMOTO Mobile (Flutter) — V2

Ce dossier accueillera l'application mobile Flutter. Le périmètre est **volontairement
vide en V1** : la PWA (`app/web`) couvre le besoin et fonctionne déjà hors ligne sur
téléphone. Aucun code mobile n'est écrit avant que la V1 soit stable (§49, §50).

## Ce que l'application mobile apportera

| Fonctionnalité | Pourquoi elle nécessite le natif |
| --- | --- |
| **Adaptateurs OBD Bluetooth** (SPP et BLE) | Un navigateur n'accède pas aux boîtiers Bluetooth série ; Flutter le permet |
| **Mode hors ligne complet** | Base SQLite locale, synchronisation différée (`/api/sync/push`, `/api/sync/pull`) |
| **Notifications** | Échéances d'entretien et alertes, même application fermée |
| **Photo et documents** | Carte grise, assurance, factures, photos du véhicule |
| **Wolof et français** | Interface complète dans les deux langues |

## Ce qui ne sera PAS dupliqué

Le moteur de diagnostic, la base de connaissances, l'assistant et la validation restent
**côté serveur**. L'application mobile ne calcule aucune conclusion : elle appelle les
mêmes routes que la PWA (`docs/07-api.md`) et affiche les mêmes niveaux de certitude et
de sécurité.

```
Flutter (app/mobile)
   ├─ obd_bluetooth/   → transport Bluetooth, implémente le contrat ObdTransport
   ├─ offline/         → SQLite local + file de synchronisation
   └─ ui/              → mêmes écrans, mêmes libellés, mêmes messages de prudence
              │
              ▼
        API XAMOTO (backend/) — moteur inchangé
```

## Pilote Bluetooth à fournir (contrat)

La couche Bluetooth côté serveur/moteur est **déjà écrite et testée**
(`obd/src/adapters/bluetoothTransport.ts`, voir `docs/03-obd.md` § 5). Ce qui manque
au navigateur, c'est le matériel : seul le natif peut ouvrir une liaison Bluetooth.
L'application mobile n'a donc qu'**un seul objet** à fournir, exactement calqué sur
`BluetoothDriver` :

```dart
abstract class BluetoothDriver {
  String get id;
  String get label;
  List<String> get kinds;                 // ['spp', 'ble']
  bool available();
  Future<List<BluetoothDeviceInfo>> list();          // nom, adresse, appairé, services
  Future<BluetoothLink> open(String address, {String kind});
}

abstract class BluetoothLink {
  Future<void> write(String data);                   // commande ELM327 + ''
  void onData(void Function(String chunk) handler);  // octets reçus, par morceaux
  Future<void> close();
  bool isOpen();
}
```

C'est le seul travail proprement mobile : le transport assemble ensuite lui-même les
fragments, retire l'écho, attend le marqueur `>` et applique le délai. Les protocoles
(ELM327, J1979, J2012) et tout le moteur de diagnostic s'appliquent **sans
modification** : c'est exactement l'objet du découplage imposé par le §7.

Deux règles héritées de la couche déjà écrite, à ne pas contourner :

- si un pilote n'est pas disponible, `list()` doit lever ou renvoyer une liste vide —
  **jamais** une liste d'appareils inventée ;
- un appareil dont le nom ressemble à un adaptateur OBD reste `likelyObdAdapter`
  (présomption) jusqu'à ce que `ATZ` / `ATI` répondent.

## Prérequis avant de commencer

1. La couche Bluetooth serveur est validée (`obd/test/bluetooth.test.ts`, 32 tests) et
   la PWA reste verte (`npm test`, `npm run test:e2e` → 37/37, `npm run test:screens`
   → 16/16).
2. L'API est stable et versionnée.
3. Le modèle de synchronisation hors ligne est éprouvé sur la PWA.
4. Un boîtier Bluetooth de référence a été testé manuellement, avec deux véhicules
   différents.
