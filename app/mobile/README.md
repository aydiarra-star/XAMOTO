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

## Contrat d'adaptateur à respecter

L'application mobile devra fournir un transport conforme à `obd/src/adapters/types.ts` :

```dart
abstract class ObdTransport {
  Future<void> open();
  Future<void> write(String command);
  Future<String> readUntilTimeout({Duration timeout});
  Future<void> close();
}
```

Une fois ce transport disponible, les protocoles (ELM327, J1979, J2012) et tout le
moteur de diagnostic s'appliquent **sans modification** : c'est exactement l'objet du
découplage imposé par le §7.

## Prérequis avant de commencer

1. La PWA V1 est validée (tests `35/35` et `16/16`).
2. L'API est stable et versionnée.
3. Le modèle de synchronisation hors ligne est éprouvé sur la PWA.
4. Un boîtier Bluetooth de référence a été testé manuellement, avec deux véhicules
   différents.
