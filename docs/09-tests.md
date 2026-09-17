# Tests et vérifications

XAMOTO est vérifié à quatre niveaux : les types, les tests unitaires du moteur et
des couches sensibles, le comportement de l'API de bout en bout, et le rendu de
chaque écran.

## 1. Vérification des types

```bash
npm run typecheck            # paquets + backend + tests unitaires + scripts de test
```

Le script enchaîne deux configurations : `tsconfig.check.json` (moteur, OBD, IA,
backend, tests unitaires) et `tsconfig.tests.json` (rendu des écrans et scripts de
test, avec les options exactes de l'interface web).

## 2. Tests unitaires (`npm test`)

```bash
npm test                 # exécution unique
npm run test:watch       # en continu pendant le développement
```

**138 vérifications** réparties en sept suites, sans base de données ni réseau :

| Suite | Ce qui est prouvé |
| --- | --- |
| `shared/test/levels.test.ts` (10) | Ordre des niveaux de gravité et de certitude, `worstSafety`, `weakestCertainty` (liste vide → NON DISPONIBLE), `capCertainty` qui ne peut que réduire |
| `obd/test/protocols.test.ts` (25) | Codage/décodage aller-retour des codes défaut, trames ELM327, PID non disponibles, masques de PID supportés, déterminisme et étiquetage du simulateur |
| `obd/test/bluetooth.test.ts` (32) | Transport Bluetooth SPP/BLE sur un faux pont ELM327 : écho, marqueur `>`, réponses fragmentées, délais, liaison fermée, commande remplacée. Et l'honnêteté : sans pilote, **aucune liste d'appareils** ; un nom d'adaptateur n'est que « probable » ; un boîtier muet ne produit aucun scan |
| `diagnostic/test/engine.test.ts` (15) | Contexte vide → NON DISPONIBLE, aucune hypothèse « confirmée » sans test, déterminisme, sécurité qui ne s'adoucit jamais, traçabilité |
| `diagnostic/test/knowledge.test.ts` (19) | Chaque code et chaque test porte ses sources, ses deux langues et un test applicable ; un code inconnu n'est jamais inventé |
| `diagnostic/test/procedures.test.ts` (16) | Après réparation : défaut résolu / toujours présent / **nouveau défaut** / données insuffisantes ; second avis : aucun jugement sur le professionnel ; inspection avant achat : les déclarations du vendeur ne sont pas des preuves |
| `ai/test/anti-hallucination.test.ts` (20) | Le RAG ne renvoie que des documents sourcés ; un code inventé, une valeur inventée, une spécification constructeur ou une garantie de sécurité sont **rejetés** ; un LLM qui délire est remplacé par la réponse du moteur |

Les fixtures (`diagnostic/test/fixtures.ts`) construisent les mesures à partir du
dictionnaire de PID réel : un test ne peut pas inventer une unité ou une borne.

### 2.1 Défauts réels trouvés par ces tests

Écrire les tests a mis au jour cinq défauts que le parcours de bout en bout ne
pouvait pas voir, car il n'utilise que le simulateur interne :

1. `decodeDtcBytes` omettait le chiffre de type : une trame réelle de P0420 était
   lue « P420 », donc **aucun code réel ne pouvait correspondre à la base de
   connaissances**.
2. `parseDtcResponse` ne retirait pas l'octet « nombre de codes » des réponses de
   mode 03/07/0A : la liste obtenue était décalée (`P0420 P0300` devenait
   `P0204 P2003`).
3. Le repli sans écho du mode filtrait les octets nuls — or `0x00` est une valeur
   légitime (quatrième chiffre de P0300) : les paires d'octets étaient décalées.
4. Deux PID partageaient la clé `throttle_position` (0x11 et 0x4C) : la seconde
   définition écrasait la première dans l'index par clé.
5. Les motifs de vérification de l'IA (`ai/src/validation`, `ai/src/assistant/qa`)
   n'acceptaient que quatre caractères : **un code inventé comme « P2199 »
   passait la vérification anti-hallucination sans être signalé**, et une question
   portant un code réel n'était pas reconnue.

Deux formulations ont également été corrigées pour rester honnêtes : l'origine des
données d'un diagnostic est désormais calculée selon la provenance §33
(`measured` / `simulated` / `documented` / `unknown`) et non selon la source de la
session ; et le second avis annonce clairement qu'il ne dispose d'aucune donnée
lorsqu'aucun scan n'a été fourni, au lieu de formuler une analyse de mesures
inexistantes.

## 3. Test de bout en bout de l'API (`tests/smoke.ts`)

```bash
npm run test:e2e
```

37 vérifications, sur une base neuve :

| # | Vérification | Ce qui est prouvé |
| --- | --- | --- |
| 1–3 | Amorçage de la base | Base de connaissances, référentiels, mode démonstration |
| 3 bis | Bluetooth | État réel annoncé (`available`, explication) et **aucun appareil inventé** sans pilote |
| 4–5 | Connexion et véhicules | Le compte de démonstration fonctionne |
| 6–13 | Scan simulé | Scan, bandeau MODE SIMULATION, certitude, sécurité, « Puis-je rouler ? », PID non supportés, hypothèses, tests, **aucune hypothèse « confirmée » sans test** |
| 14 | Effacement sans confirmation | HTTP 400 : on ne modifie pas un véhicule sans accord |
| 15–17 | Détail du diagnostic | Parcours guidé, avertissement de non-garantie, justification |
| 18–20 | Tests guidés | Refus sans confirmation, enregistrement, recalcul du diagnostic |
| 21–24 | Rapport | Génération, QR code, sources limitées à celles utilisées, lecture par jeton |
| 25–27 | Assistant | Réponse tracée, refus hors sujet, **code non documenté → « Je ne dispose pas de cette donnée »** |
| 28–30 | Garages | Annuaire, partage avec consentement (201), refus sans consentement (400) |
| 31 | Synchronisation hors ligne | Idempotence (`duplicates`) |
| 32 | Bluetooth | L'état réel est annoncé (`available`, explication) — aucune promesse |
| 33 | Bluetooth | **Aucun appareil inventé sans pilote** : liste vide + raison, `certainty: presumption` |
| 34–35 | Permissions | 401 sans jeton, permissions renvoyées par véhicule |

Le test volontairement « méchant » est le n° 27 : un code défaut inexistant dans la
base (`P1234`) doit produire une phrase d'indisponibilité, jamais une explication
plausible.

## 4. Vérification du rendu de l'interface (`tests/web-smoke.tsx`)

```bash
npx tsx tests/web-smoke.tsx
```

Rend les 16 écrans sans navigateur, dans le cas le plus défavorable : aucun véhicule,
aucune donnée chargée, aucune interaction. Objectif : garantir qu'un écran ne plante
jamais au premier affichage (imports, contextes, accès à des données absentes).

## 5. Construction de l'application

```bash
npm run build          # app/web/dist
npm start              # API + interface sur le même port
```

Vérifications manuelles utiles :

```bash
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/            # 200
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/vehicles    # 200 (SPA)
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/manifest.webmanifest
curl -s localhost:3000/api/health
```

## 6. Ce qui est vérifié par construction, et non par un test

- **Aucune donnée inventée** : le moteur ne peut produire une valeur que si elle vient
  d'une mesure, d'une fiche attribuée à une source, ou d'un calcul montré.
- **Aucune simulation présentée comme réelle** : `origin: 'simulated'` déclenche le
  bandeau MODE SIMULATION dans l'interface et dans le rapport.
- **Aucune conclusion sans confirmation** : les routes d'écriture exigent
  `confirmed: true` / `confirm: true` / `consent: true`.

## 7. Ce qu'il reste à tester (prochaines phases)

- Tests unitaires par règle (`diagnostic/src/rules/*`) pris isolément, en plus des
  scénarios de bout en bout du moteur déjà couverts.
- Tests de charge sur `/api/scans` (le scan est l'opération la plus coûteuse).
- Tests d'accessibilité et de lisibilité en plein soleil (contraste, taille de police).
- Vérification sur un adaptateur ELM327 réel, avec deux boîtiers différents.
