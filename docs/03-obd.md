# Couche OBD

## 1. Principe de découplage (§7)

> L'application ne doit **jamais** être couplée à un modèle d'adaptateur.

XAMOTO sépare donc :

| Élément | Fichier | Responsabilité |
| --- | --- | --- |
| `ObdTransport` | `obd/src/adapters/types.ts` | Faire circuler des octets (TCP, mémoire, Bluetooth) |
| `ObdAdapter` | `obd/src/adapters/elm327Adapter.ts`, `simulatorAdapter.ts` | Parler le dialecte d'un boîtier et rendre un `ScanSnapshot` |
| Protocoles | `obd/src/protocols/` | Interpréter : J1979 (PIDs), SAE J2012 (codes), ELM327 (commandes) |
| Registre | `obd/src/adapters/types.ts` | `adapterRegistry` : choisir un adaptateur sans toucher au reste |

Ajouter le Bluetooth revient à écrire un transport et à l'enregistrer. Ni le moteur de
diagnostic, ni l'API, ni l'interface ne changent.

## 2. Protocole J1979 : PID

`obd/src/protocols/pids.ts` décrit chaque donnée : clé interne, PID OBD, libellé,
unité, méthode de conversion, plage attendue **avec sa source**, et conditions de
lecture.

Deux règles absolues :

1. **Un PID non supporté n'est pas une valeur.** Le véhicule répond « non supporté » :
   XAMOTO enregistre `supported: false`, `value: null`, et l'affiche comme
   **NON DISPONIBLE**. Il ne met jamais 0, ni une valeur « typique ».
2. **Une lecture échouée n'est pas une mesure.** Le scan concerné échoue et
   l'utilisateur est prévenu ; aucune donnée n'est inventée pour « remplir » l'écran.

## 3. Protocole SAE J2012 : codes défaut

`obd/src/protocols/dtc.ts` décode et encode les codes :

- lettre : `P` moteur, `C` châssis, `B` carrosserie, `U` réseau ;
- premier chiffre : `0` générique, `1` spécifique constructeur, `2`/`3` selon le code ;
- deux chiffres suivants : sous-système ;
- deux derniers : numéro du défaut.

Statuts gérés : `stored`, `pending`, `permanent`, `history` (mémorisé), `cleared`.
Un code effacé puis revenu est marqué **« revenu après effacement »** : c'est une
information de diagnostic forte, conservée par le moteur.

## 4. Adaptateur ELM327 Wi-Fi

```ts
const transport = new TcpTransport({ host: '192.168.0.10', port: 35000 });
const adapter = new Elm327Adapter({ transport, retries: 2 });
const snapshot = await adapter.readScan({ samples: 5 });
```

- Adresses usuelles : `192.168.0.10`, `192.168.1.5`, `192.168.4.1` — ports 35000,
  35001, 23.
- Séquence d'initialisation : `ATZ`, `ATE0`, `ATL0`, `ATS0`, `ATSP0`, puis `0100`
  pour connaître les PID supportés.
- Une lecture est répétée `samples` fois : la série permet de détecter une instabilité
  (par exemple une tension de batterie qui s'effondre à l'appel de démarreur).

En navigateur, l'accès utilisateur à un boîtier Bluetooth n'est pas standard : le
Bluetooth est prévu pour l'application mobile (Flutter). L'interface web gère donc le
**Wi-Fi** et le **simulateur**.

## 5. Adaptateur Bluetooth SPP et BLE

Le Bluetooth passe par un **pilote de plateforme**. Node.js ne sait pas parler
Bluetooth seul : le transport ne code donc aucun protocole radio, il dialogue avec un
pilote qui, lui, sait ouvrir une liaison.

```
Application → couche OBD → BluetoothTransport → pilote de plateforme → ELM327
```

```ts
// Application mobile, ou poste de travail avec un pont série.
registerBluetoothDriver(myDriver);
const transport = new BluetoothTransport({ address: 'AA:BB:CC:11:22:33', kind: 'spp' });
const adapter = new Elm327Adapter({ transport, retries: 2 });   // identique au Wi-Fi
```

Le pilote implémente trois méthodes : `available()`, `list()` et `open()`. Le pilote
série fourni couvre le Bluetooth SPP d'un poste de travail (`/dev/rfcomm0`, `COM5`,
via le paquet `serialport`) sans que XAMOTO en dépende :

```ts
createSerialBluetoothDriver({
  list: () => Promise.resolve([{ path: '/dev/rfcomm0', name: 'ELM327 v2.1' }]),
  open: (path, { baudRate }) => openSerialPort(path, baudRate),
});
```

### Ce que la couche Bluetooth refuse de faire

| Situation | Comportement |
| --- | --- |
| Aucun pilote enregistré | `bluetoothAvailability().available = false`, liste d'appareils **vide**, avec l'explication et la solution. Jamais de liste inventée. |
| Pilote présent mais hors service | Les pilotes concernés sont **nommés** dans l'erreur : « matériel absent, désactivé, ou permission refusée ». |
| Appareil au nom d'adaptateur connu | Signalé `likelyObdAdapter: true` avec le motif, et la phrase « à confirmer par un test de liaison (ATZ / ATI) ». |
| Appareil sans nom | Décrit comme tel ; XAMOTO n'invente pas de description à partir d'une adresse. |
| Boîtier muet | Le délai expire et la commande échoue explicitement. Aucun scan n'est produit. |
| Liaison interrompue | La commande en cours est rejetée avec la raison ; aucune valeur partielle n'est présentée. |

L'API expose `GET /api/obd/candidates` (état réel du Bluetooth) et
`GET /api/obd/bluetooth/devices` (liste proposée par les pilotes, avec
`certainty: "presumption"`). Sur un serveur sans pilote, cette dernière renvoie une
liste vide et l'explication — le test de bout en bout le vérifie.

## 6. Simulateur (§30)

`obd/src/simulator/scenarios.ts` contient 9 scénarios :

| Identifiant | Situation simulée |
| --- | --- |
| `normal_engine` | Aucun défaut, mesures nominales |
| `weak_battery` | Batterie faible, tension de repos basse |
| `high_temperature` | Surchauffe, température de liquide élevée |
| `engine_fault` | Ratés d'allumage et code moteur |
| `multiple_dtc` | Plusieurs codes simultanés |
| `intermittent_fault` | Défaut intermittent, revenu après effacement |
| `no_start` | Véhicule qui ne démarre pas |
| `diesel_egr_dpf` | EGR / FAP sur moteur diesel |
| `abs_fault` | Freinage : code de châssis C0035/C0040, **aucune mesure de roue disponible** |

Le simulateur est un **outil de démonstration et de test**, pas une source de vérité :

- chaque scan simulé porte `source: 'simulator'` ;
- l'origine des données est `simulated` ;
- les interfaces affichent le bandeau **MODE SIMULATION — données non issues d'un
  véhicule réel** ;
- le rapport produit à partir d'un scan simulé conserve cette mention.

Il permet de tester l'application complète sans véhicule, et sert de base aux tests
automatisés (`tests/smoke.ts`).

## 7. Ce que la couche OBD ne fait jamais

- Elle ne devine pas un PID absent.
- Elle ne « complète » pas un scan partiel.
- Elle ne décide pas de la gravité : elle transmet des faits au moteur de diagnostic.
- Elle n'écrit rien dans le véhicule en dehors de l'effacement des défauts, lui-même
  soumis à confirmation explicite (`POST /api/scans/:id/clear` avec `confirm: true`),
  et accompagné de l'avertissement qu'un défaut effacé ne prouve pas une réparation.
