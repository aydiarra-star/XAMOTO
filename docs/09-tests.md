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

**189 vérifications** réparties en onze suites, sans base de données ni réseau :

| Suite | Ce qui est prouvé |
| --- | --- |
| `tools/test/mobile_contract.test.ts` (8) | **Contrat mobile ↔ serveur** : le projet Dart est complet, les écrans déclarés existent et sont branchés, les phrases du §16 sont identiques partout, les scénarios simulés du mobile sont ceux du serveur, le catalogue wolof embarqué est exactement celui qui est généré, et **aucun mot wolof n'est recopié à la main** |
| `shared/test/levels.test.ts` (10) | Ordre des niveaux de gravité et de certitude, `worstSafety`, `weakestCertainty` (liste vide → NON DISPONIBLE), `capCertainty` qui ne peut que réduire |
| `diagnostic/test/systems.test.ts` (18) | Règles **par système** : couverture des quinze systèmes, ordre de vérification freinage/réseau/boîte/airbag/climatisation, aucune cause confirmée là où l'OBD ne lit rien, déterminisme |
| `diagnostic/test/seedSql.test.ts` (4) | L'export PostgreSQL (`database/seed/001_knowledge.sql`) est **exactement** celui que produit le code, et le graphe de pièces couvre toutes les pièces citées par la base |
| `shared/test/i18n.test.ts` (19) | Multilingue honnête : trois langues déclarées, catalogue wolof cohérent (clé, français, anglais, relecteur), **aucune consigne de sécurité non relue n'est affichée en wolof**, rapport de langue exact, et repli annoncé quand une réponse n'est pas dans la langue demandée |
| `obd/test/protocols.test.ts` (25) | Codage/décodage aller-retour des codes défaut, trames ELM327, PID non disponibles, masques de PID supportés, déterminisme et étiquetage du simulateur |
| `obd/test/bluetooth.test.ts` (32) | Transport Bluetooth SPP/BLE sur un faux pont ELM327 : écho, marqueur `>`, réponses fragmentées, délais, liaison fermée, commande remplacée. Et l'honnêteté : sans pilote, **aucune liste d'appareils** ; un nom d'adaptateur n'est que « probable » ; un boîtier muet ne produit aucun scan |
| `diagnostic/test/engine.test.ts` (15) | Contexte vide → NON DISPONIBLE, aucune hypothèse « confirmée » sans test, déterminisme, sécurité qui ne s'adoucit jamais, traçabilité |
| `diagnostic/test/knowledge.test.ts` (19) | Chaque code et chaque test porte ses sources, ses deux langues et un test applicable ; un code inconnu n'est jamais inventé |
| `diagnostic/test/procedures.test.ts` (16) | Après réparation : défaut résolu / toujours présent / **nouveau défaut** / données insuffisantes ; second avis : aucun jugement sur le professionnel ; inspection avant achat : les déclarations du vendeur ne sont pas des preuves |
| `ai/test/anti-hallucination.test.ts` (23) | Le RAG ne renvoie que des documents sourcés ; un code inventé, une valeur inventée, une spécification constructeur ou une garantie de sécurité sont **rejetés** ; un LLM qui délire est remplacé par la réponse du moteur ; une question en wolof reçoit une réponse en français **signalée comme telle**, sans mot wolof inventé |

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

53 vérifications, sur une base neuve :

| # | Vérification | Ce qui est prouvé |
| --- | --- | --- |
| 1–3 | Amorçage de la base | Base de connaissances, référentiels, mode démonstration |
| 3 bis | Bluetooth | État réel annoncé (`available`, explication) et **aucun appareil inventé** sans pilote |
| 3 ter | Multilingue | Une question posée en wolof reçoit une réponse signalée « rédigée en français », avec la raison ; le wolof est accepté par l'API au lieu d'être rejeté |
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
| 33 bis | Multilingue | Question en wolof → `language.effective = 'fr'`, `fallback: true`, explication présente ; aucune erreur de saisie |
| 33 sexies | Scan local (mobile) | Le téléphone lit, le serveur calcule : `mode: 'local'` accepté, aucune mention MODE SIMULATION, PID non supportés listés ; une donnée `simulated` est **refusée** ; un PID inconnu est **refusé** ; un scan vide ne produit pas un « tout va bien » |
| 33 septies | Contrat de routes du mobile | Chaque appel du mobile (verbe HTTP + chemin) correspond à une route réellement enregistrée par le serveur, et aucune constante de chemin ne pointe vers une route absente — `app.hasRoute()`, pas un sondage |
| 33 quinquies | Freinage : un code de châssis n'est pas une pièce | Le scénario `abs_fault` produit bien un code C ; XAMOTO affiche que le code désigne un **circuit** ; aucune hypothèse n'est « confirmée » sur un système que l'OBD ne lit pas |
| 33 quater | Couverture par système | Les quinze systèmes sont exposés avec leurs limites ; l'airbag est annoncé `not_accessible`, jamais « sain » ; règles dédiées et générales distinguées |
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

Six contrôles supplémentaires activent la langue wolof et vérifient ce que
l'utilisateur verrait réellement :

| Contrôle | Ce qui est prouvé |
| --- | --- |
| Langue active | Le wolof enregistré est bien pris en compte (et non silencieusement ramené au français) |
| Libellé du catalogue | « Accueil » devient `Kër gi` : le catalogue partagé alimente l'interface |
| Bandeau | La mention de relecture en cours est affichée avec les compteurs réels |
| Consigne de sécurité | 🔴 CRITIQUE reste en français : aucun mot wolof approximatif sur la sécurité |
| Libellé non critique | ⚪ AMUL s'affiche bien en wolof (le repli n'est pas généralisé) |
| Cohérence des replis | `labelText()` renvoie le français pour la sécurité et le wolof pour les libellés relus |

Total : **22/22 vérifications**.

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
- Relecture du wolof par un locuteur natif : tant qu'elle n'a pas eu lieu, les
  consignes de sécurité restent en français et les tests le vérifient. Voir
  `docs/12-multilingue.md`.
- Tests de charge sur `/api/scans` (le scan est l'opération la plus coûteuse).
- Tests d'accessibilité et de lisibilité en plein soleil (contraste, taille de police).
- Vérification sur un adaptateur ELM327 réel, avec deux boîtiers différents.

---

## 6. Application mobile (Dart) : ce qui n'est PAS vérifié ici

Le SDK Flutter/Dart n'est pas installable dans cet environnement (`pub.dev` et
`storage.googleapis.com` injoignables). Le code de `app/mobile/` est donc livré
**sans exécution**, et cette section existe pour que personne ne l'oublie.

| Vérifié automatiquement | Non vérifié (à faire avec le SDK) |
| --- | --- |
| Chemins et verbes HTTP conformes au serveur | `flutter analyze` (règles dans `analysis_options.yaml`) |
| Phrases du §16 identiques au reste du produit | `flutter test` (`app/mobile/test/`, 4 fichiers) |
| Écrans déclarés présents et branchés | Rendu réel, ergonomie, accessibilité |
| Catalogue wolof généré et non recopié | Liaison Bluetooth sur un vrai adaptateur ELM327 |
| Scénarios simulés alignés sur le serveur | Comportement hors ligne en situation réelle |

Les tests Dart sont écrits (`app/mobile/test/` : décodage PID, codes défaut, réponses
ELM327, niveaux, file de synchronisation, catalogue wolof) mais **n'ont jamais tourné**.
