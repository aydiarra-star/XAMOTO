# Mémoire d'agent — XAMOTO

Ce document n'est pas de la documentation produit : c'est le **journal de bord du
travail**. Il existe pour qu'une session suivante (agent ou humain) reprenne le
projet exactement là où il en est, sans refaire ce qui a été fait ni défaire ce qui
a été décidé.

Dernière mise à jour : phase 6 (écran devis web).

---

## 1. Où en est le projet

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Socle : nom, architecture §48, couche OBD, moteur de diagnostic, base SQLite/PostgreSQL | ✅ livrée |
| 2 | API complète, PWA, simulation, rapports, garages, pièces, devis | ✅ livrée |
| 3 | Adaptateur Bluetooth (transport serveur), tests, écran de scan | ✅ livrée |
| 3 bis | Multilingue honnête : fr/en/wolof, relecture obligatoire des consignes | ✅ livrée |
| 4 | Base documentaire sourcée + règles par système + couverture OBD (15 systèmes) | ✅ livrée |
| 4 bis | Scénario de freinage simulé, contrat de routes | ✅ livrée |
| 5 | **Application mobile Flutter** (code écrit, non compilé ici) + mémoire d'agent | ✅ livrée, avec réserve |
| 6 | **Écran devis web** (§27) + devis de démonstration + contrôles e2e du devis | ✅ livrée |

### Réserve à connaître sur la phase 5

L'application mobile **n'a jamais été compilée** : cet environnement n'a accès qu'au
registre npm et à GitHub (`pub.dev` et `storage.googleapis.com` injoignables, aucun
SDK Dart installé — vérifié à nouveau en phase 5). Conséquence :

- le code Dart est **proposé**, pas livré ;
- les vérifications automatiques portent sur le **contrat** avec le serveur (routes,
  verbes HTTP, phrases exigées, catalogue wolof, écrans déclarés) ;
- `flutter analyze`, `flutter test` et un essai sur un vrai adaptateur restent à faire
  sur un poste équipé. C'est écrit dans `app/mobile/README.md` et dans `docs/09-tests.md`.

---

## 2. Ce qui est vérifié, et comment le relancer

```bash
npm install                       # obligatoire après une remise à zéro de l'espace de travail
npm test                          # 189 vérifications, 11 suites
npm run test:e2e                  # 65 vérifications de bout en bout (API + base)
npm run test:screens              # 23 rendus d'écran (17 écrans + 6 contrôles de langue)
npm run typecheck                 # 0 erreur attendue
npm run build                     # app/web/dist — ~290 kB
npm run seed:sql                  # régénère database/seed/001_knowledge.sql
npm run mobile:i18n               # régénère app/mobile/lib/i18n/catalogue.g.dart
```

Trois tests **échouent si un fichier généré n'est plus à jour** : `seedSql.test.ts`
(export PostgreSQL), `mobile_contract.test.ts` (catalogue wolof mobile). Ne jamais
modifier ces fichiers à la main : relancer la commande.

---

## 3. Décisions prises (et pourquoi)

### Le serveur calcule, le téléphone lit

`POST /api/scans` accepte trois modes : `simulator`, `obd` (adaptateur Wi-Fi piloté par
le serveur) et **`local`** (mesures relevées par l'application mobile). Aucune règle de
diagnostic n'est recopiée dans le mobile : la même mesure donne la même conclusion sur
le web et sur le téléphone. Le mode `local` **refuse** :

- une origine `simulated` — le simulateur vit sur le serveur (§47-2) ;
- un PID que XAMOTO ne sait pas lire — il n'existe pas de « case vide » en base ;
- un scan entièrement vide — mieux vaut une erreur qu'un « tout va bien » sans preuve.

### Un devis incomplet reste incomplet

L'écran devis (§27, phase 6) empêche l'enregistrement dès qu'une ligne porte un
libellé **sans montant** : le champ reste vide et bloque la validation. Enregistrer
un `0` par défaut aurait fabriqué un prix — exactement la donnée inventée que le
§47-1 interdit. Pour la même raison, l'écran n'affiche **aucun total « normal »**,
aucune fourchette de prix et aucun classement : il dit seulement quelles lignes
rejoignent une donnée mesurée sur le véhicule, et quelles questions poser au garage.
Le devis de démonstration suit la même règle : ses postes viennent des pièces
réellement citées par le diagnostic du véhicule, et son résumé annonce que les
montants sont **fictifs**.

### Le wolof ne se traduit pas automatiquement

Le catalogue vit dans `shared/src/i18n.ts`. Une consigne de sécurité (`scope: safety`)
n'est affichée en wolof **que** si elle a été relue par un locuteur natif nommé. Tant
que ce n'est pas fait : français + explication. L'application mobile ne recopie jamais
le catalogue, elle le **génère** (`npm run mobile:i18n`) et un test vérifie l'égalité.

### Un système non lisible n'est pas un système sain

`GET /api/knowledge/systems` décrit, pour les 15 systèmes, ce que l'OBD donne et ce
qu'il ne donne pas (airbag, climatisation, carrosserie : `not_accessible`). C'est
affiché **avant** le diagnostic, côté web comme côté mobile.

### Alternatives écartées

| Tentative | Raison du rejet |
| --- | --- |
| Installer le SDK Flutter/Dart | Impraticable ici : `pub.dev` et `storage.googleapis.com` injoignables |
| Créer un second dépôt GitHub pour cette mémoire | Le jeton du bot ne peut pas créer de dépôt (`Resource not accessible by integration`) ; la mémoire vit donc dans ce dépôt |
| Vérifier les routes du mobile par sondage HTTP | Un 404 peut vouloir dire « ressource introuvable » autant que « route inconnue » → remplacé par `app.hasRoute()` (exact, verbe inclus) |
| Ajouter un champ `system` aux tests guidés | Les tests guidés sont transversaux (une mesure sert plusieurs systèmes) : la correspondance vit dans `knowledge/systems.ts` |

---

## 4. Défauts réels trouvés par les tests (à ne pas réintroduire)

| Défaut | Trouvé par | Correction |
| --- | --- | --- |
| `GET /api/knowledge/dtc/:code` n'existe pas (la route attend `?code=`) | Contrat de routes du mobile | Constante corrigée : `knowledgeDtc = '/api/knowledge/dtc'` |
| La synchronisation appelait `POST /api/sync/pull` alors que la route est `GET` | Contrat de routes du mobile | `api.get(Api.syncPull, query: …)` |
| Le rapport mobile envoyait `diagnosticSessionId` ; la route attend `vehicleId` + `sessionId` | Relecture du contrat | `report_screen.dart` corrigé, avec révocation par `DELETE` |
| Trois écrans déclarés sans fichier (`garages`, `report`, `settings`) | `mobile_contract.test.ts` | Écrans écrits |
| La liste des scénarios acceptés était recopiée dans la route de scan | Mise à jour du simulateur | Dérivée de `SCENARIOS` |
| `database/seed/001_knowledge.sql` avait divergé du code | `seedSql.test.ts` | Fichier généré + test d'égalité |
| 55 pièces du code absentes de `002_reference.sql` | `seedSql.test.ts` | Ajoutées |
| `POST /api/quotes` ne renvoyait que `{ id }` là où l'analyse renvoie le devis | Contrôle e2e du devis | Le devis créé est renvoyé, sérialisé par la **même** fonction que la liste (`serializeQuote`) |
| `POST /api/quotes` répondait 404 à l'analyse juste après sa création | Contrôle e2e (l'identifiant n'était pas lu au bon endroit) | Corrigé en même temps que le défaut ci-dessus |

---

## 5. Conventions du projet

1. **Français** pour tout ce qui est visible par l'utilisateur et pour les commentaires ;
   anglais pour les identifiants de code.
2. Un commentaire explique **pourquoi**, jamais **quoi**.
3. Aucune donnée affichée sans provenance ni niveau. Un `0` n'est pas une absence :
   l'absence s'écrit `null` + « non disponible » + la phrase du §16.
4. Toute nouvelle règle de diagnostic déclare les systèmes qu'elle couvre
   (`Rule.systems`) et ses tests guidés ; sinon `systems.test.ts` échoue.
5. Toute nouvelle source de connaissances va dans `diagnostic/src/knowledge/sources.ts`
   **et** est citée par le document qui l'utilise.
6. Après toute modification de connaissances : `npm run seed:sql` **en dernier**.
7. Après toute modification du catalogue wolof : `npm run mobile:i18n`.
8. Une fonctionnalité n'est « livrée » que si les cinq commandes du § 2 passent.
9. Un montant est toujours porté par une **ligne** de devis (`currency` par ligne) ;
   la table `quotes` n'a pas de colonne devise, et une ligne sans montant est refusée
   plutôt que complétée par un zéro.
10. Les phrases de sécurité sont **littérales** ; elles sont dupliquées à l'identique
   côté mobile et un test compare les deux copies à `shared/src/index.ts`.

---

## 6. Points ouverts

| Sujet | État |
| --- | --- |
| Relecture native des 8 consignes de sécurité wolof | **bloquant produit** : sans relecteur nommé, elles restent en français |
| `flutter analyze` / `flutter test` / essai matériel | à faire sur un poste avec SDK et un adaptateur ELM327 |
| Pilote Bluetooth Android/iOS | contrat fourni (`lib/obd/bluetooth_driver.dart`), implémentation à écrire |
| Notifications d'entretien | V2, dépend du natif |
| Photos et documents du véhicule | V2 |
| Devis côté mobile | l'écran web est livré (phase 6) ; l'écran Flutter reste à écrire |
| Devis envoyés par le garage et devis comparés | V2 : une place de marché exige un cadre contractuel |
| Mode hors ligne du web | le Service Worker existe (`app/web/public/sw.js`) : coquille en cache, `/api` **jamais** caché (une mesure ancienne ne doit pas passer pour actuelle). Reste : file d'attente d'écriture côté client |

---

## 7. Pièges rencontrés (gain de temps pour la suite)

- **Un serveur non redémarré donne des erreurs trompeuses.** Avant de déboguer une
  route, redémarrer le processus : une version ancienne répond `invalid_input` là où
  le code récent fonctionne.
- **`npm install` est perdu** quand l'espace de travail est remis à zéro :
  `vitest` disparaît et `npm test` échoue de façon incompréhensible.
- **Vitest ne peut pas importer le backend** (`node:sqlite` non résolu) : les suites
  unitaires ne touchent pas la base ; les vérifications qui ont besoin d'un serveur
  vont dans `tests/smoke.ts`.
- **`npx tsx -e "import …"` ne résout pas les alias du dépôt** : écrire un fichier
  temporaire `.mts` en `import()` dynamique, ou passer par `/tmp/*.ts`.
- **Le dépôt local peut être recloné** en cours de session (branche locale revenue sur
  `main`). Récupération : `git fetch origin arena/01a0b0c3-xamoto && git reset --mixed FETCH_HEAD`
  — les fichiers non suivis sont conservés.
- **`git rev-parse origin/<branche>` échoue** : utiliser `git ls-remote --heads origin`.
- **Le jeton GitHub du bot ne peut pas créer de dépôt** ni voir d'autres dépôts que
  `aydiarra-star/XAMOTO`.

---

## 8. Commandes utiles

```bash
# Base de démonstration rechargée à neuf
npx tsx backend/src/db/seed-cli.ts --reset

# Serveur de développement (aperçu live sur le port 3000)
NODE_ENV=development PORT=3000 XAMOTO_DB_PATH=./data/xamoto.sqlite npx tsx backend/src/server.ts

# Inventaire de la base de connaissances
npx tsx -e "import('/home/user/XAMOTO/diagnostic/src/index.js').then(m => console.log(m.ALL_RULES.length, m.ALL_DTC_KNOWLEDGE.length, m.GUIDED_TESTS.length))"
```

---

## 9. Branches et livraison

- Branche de travail : `arena/01a0b0c3-xamoto` (la session est liée à cette branche).
- Pull request : [#1](https://github.com/aydiarra-star/XAMOTO/pull/1), commentée à
  chaque phase livrée.
- Ne jamais pousser sur une autre branche depuis cette session.
