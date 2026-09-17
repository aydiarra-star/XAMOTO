# Tests et vérifications

XAMOTO est vérifié à trois niveaux : les types, le comportement de l'API de bout en
bout, et le rendu de chaque écran.

## 1. Vérification des types

```bash
npm run typecheck                                   # moteur, OBD, IA, backend
npx tsc -p app/web/tsconfig.json --noEmit           # interface web
```

## 2. Test de bout en bout de l'API (`tests/smoke.ts`)

```bash
XAMOTO_DB_PATH=./data/smoke.sqlite NODE_ENV=test npx tsx tests/smoke.ts
```

35 vérifications, sur une base neuve :

| # | Vérification | Ce qui est prouvé |
| --- | --- | --- |
| 1–3 | Amorçage de la base | Base de connaissances, référentiels, mode démonstration |
| 4–5 | Connexion et véhicules | Le compte de démonstration fonctionne |
| 6–13 | Scan simulé | Scan, bandeau MODE SIMULATION, certitude, sécurité, « Puis-je rouler ? », PID non supportés, hypothèses, tests, **aucune hypothèse « confirmée » sans test** |
| 14 | Effacement sans confirmation | HTTP 400 : on ne modifie pas un véhicule sans accord |
| 15–17 | Détail du diagnostic | Parcours guidé, avertissement de non-garantie, justification |
| 18–20 | Tests guidés | Refus sans confirmation, enregistrement, recalcul du diagnostic |
| 21–24 | Rapport | Génération, QR code, sources limitées à celles utilisées, lecture par jeton |
| 25–27 | Assistant | Réponse tracée, refus hors sujet, **code non documenté → « Je ne dispose pas de cette donnée »** |
| 28–30 | Garages | Annuaire, partage avec consentement (201), refus sans consentement (400) |
| 31 | Synchronisation hors ligne | Idempotence (`duplicates`) |
| 32–33 | Permissions | 401 sans jeton, permissions renvoyées par véhicule |

Le test volontairement « méchant » est le n° 27 : un code défaut inexistant dans la
base (`P1234`) doit produire une phrase d'indisponibilité, jamais une explication
plausible.

## 3. Vérification du rendu de l'interface (`tests/web-smoke.tsx`)

```bash
npx tsx tests/web-smoke.tsx
```

Rend les 16 écrans sans navigateur, dans le cas le plus défavorable : aucun véhicule,
aucune donnée chargée, aucune interaction. Objectif : garantir qu'un écran ne plante
jamais au premier affichage (imports, contextes, accès à des données absentes).

## 4. Construction de l'application

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

## 5. Ce qui est vérifié par construction, et non par un test

- **Aucune donnée inventée** : le moteur ne peut produire une valeur que si elle vient
  d'une mesure, d'une fiche attribuée à une source, ou d'un calcul montré.
- **Aucune simulation présentée comme réelle** : `origin: 'simulated'` déclenche le
  bandeau MODE SIMULATION dans l'interface et dans le rapport.
- **Aucune conclusion sans confirmation** : les routes d'écriture exigent
  `confirmed: true` / `confirm: true` / `consent: true`.

## 6. Ce qu'il reste à tester (prochaines phases)

- Tests unitaires par règle (`diagnostic/src/rules/*`) sur des jeux de mesures
  fabriqués — table `obd_data` alimentée en mémoire.
- Tests de charge sur `/api/scans` (le scan est l'opération la plus coûteuse).
- Tests d'accessibilité et de lisibilité en plein soleil (contraste, taille de police).
- Vérification sur un adaptateur ELM327 réel, avec deux boîtiers différents.
