# XAMOTO — « Connaître sa voiture. »

**Comprendre · Diagnostiquer · Agir**

XAMOTO lit ce que votre voiture accepte de dire (codes défaut, mesures OBD), croise ces
données avec des règles techniques explicites, propose des tests pour trancher, et
répond à la seule question qui compte vraiment quand un voyant s'allume :
**puis-je rouler ?**

> **La règle qui tient tout le reste** : XAMOTO doit pouvoir dire
> « Je ne dispose pas de cette donnée pour votre véhicule. »
> Il n'invente jamais une valeur, jamais une cause, et ne présente jamais une
> hypothèse comme une certitude.

---

## Sommaire

- [Ce que XAMOTO fait](#ce-que-xamoto-fait)
- [Démarrage rapide](#démarrage-rapide)
- [Utiliser l'application](#utiliser-lapplication)
- [Architecture](#architecture)
- [Le moteur de diagnostic en une page](#le-moteur-de-diagnostic-en-une-page)
- [L'IA est une explication, pas un diagnostic](#lia-est-une-explication-pas-un-diagnostic)
- [Mode simulation](#mode-simulation)
- [Configuration](#configuration)
- [Base de données](#base-de-données)
- [Tests](#tests)
- [Documentation](#documentation)
- [Feuille de route](#feuille-de-route)
- [Principes absolus](#principes-absolus)

---

## Ce que XAMOTO fait

| Domaine | Fonctionnalités |
| --- | --- |
| **Véhicules** | Fiche véhicule, kilométrage, VIN, passeport complet (diagnostics, réparations, entretien, documents) |
| **OBD** | Lecture des codes défaut et des mesures via adaptateur ELM327 **Wi-Fi**, distinction explicite entre données disponibles et **non disponibles** |
| **Diagnostic** | Moteur de règles déterministe : constats, hypothèses graduées, tests qui permettent de trancher, données manquantes signalées |
| **Sécurité** | « Puis-je rouler ? » justifié, avec niveaux 🟢 🟡 🟠 🔴 et avertissement de non-garantie |
| **Tests guidés** | Objectif, matériel, étapes, résultat attendu, interprétation — et confirmation obligatoire du résultat observé |
| **Après réparation** | Comparaison avant/après : codes disparus, persistants, nouveaux |
| **Seconde opinion** | Confrontation d'un diagnostic reçu avec vos données réelles + questions à poser au garage |
| **Avant achat** | Inspection fondée sur un scan, cases non vérifiées assumées comme telles |
| **Entretien** | Plan d'entretien avec plages attribuées à une source, facteurs d'usage (poussière, ville, chaleur, trajets courts) |
| **Assistant** | Explications en français simple, avec sources citées et contrôle anti-hallucination |
| **Rapports** | Rapport partageable par lien et QR code, lisible sans compte XAMOTO |
| **Garages & pièces** | Annuaire (équipements, spécialités), partage **avec consentement explicite**, graphe de pièces et prix indicatifs |
| **Hors ligne** | Interface en cache, opérations conservées puis synchronisées (idempotente) |
| **Langues** | Français (complet), anglais, wolof sur les libellés relus — les consignes de sécurité non relues restent en français et l'interface le dit ([docs/12-multilingue.md](docs/12-multilingue.md)) |

Application web progressive (PWA) utilisable sur téléphone comme sur ordinateur,
conçue d'abord pour un usage à Dakar, Abidjan, Bamako, Ouagadougou ou Douala.

---

## Démarrage rapide

Prérequis : **Node.js ≥ 22.5** (pour le module `node:sqlite`).

```bash
git clone <votre-dépôt> XAMOTO && cd XAMOTO
npm install

# 1. Amorcer la base (base de connaissances + référentiels + compte de démonstration)
npm run seed

# 2. Construire l'interface web
npm run build

# 3. Démarrer XAMOTO : API + site sur le même port
npm start
```

Puis ouvrez **http://localhost:3000**.

### Mode développement (deux processus)

```bash
npm run dev        # API (port 3000) + interface Vite (port 5173) avec proxy /api
```

### Compte de démonstration

| E-mail | Mot de passe |
| --- | --- |
| `demo@xamoto.app` | `xamoto2026` |

Ou, sans compte : bouton **« Entrer en mode démonstration »** sur l'écran de connexion.
Trois véhicules et trois diagnostics simulés sont alors disponibles, tous étiquetés
**MODE SIMULATION**.

---

## Utiliser l'application

| Écran | Ce qu'on y fait |
| --- | --- |
| **Accueil** | État du véhicule, dernier diagnostic, entretiens à prévoir, alertes |
| **Mes véhicules** | Ajouter, ouvrir, supprimer ; créer un véhicule de démonstration par scénario |
| **Fiche véhicule** | Fiche technique (si connue), passeport, mise à jour du kilométrage, partage, notes |
| **Connecter / scanner** | Adaptateur Wi-Fi ou simulateur ; symptômes déclarés ; lancement du scan |
| **Diagnostic** | Conclusion, hypothèses, détail des règles, données manquantes, parcours guidé |
| **Puis-je rouler ?** | Réponse justifiée, données utilisées, points à vérifier, non-garantie |
| **Tests guidés** | Saisie du résultat observé (confirmation obligatoire) et recalcul immédiat |
| **Assistant** | Questions en langage naturel, sources citées, données absentes annoncées |
| **Après réparation** | Comparaison avant/après avec verdict nuancé |
| **Second avis** | Diagnostic reçu vs données réelles, questions à poser |
| **Entretien** | Plan ajustable selon l'usage, tendances mesurées |
| **Avant achat** | Inspection, points de vigilance, cases non vérifiées assumées |
| **Rapports** | Génération, lien public, QR code, révocation |
| **Garages** | Annuaire, carte OpenStreetMap, partage consenti, pièces |
| **Alertes** | Notifications fondées sur une donnée ou une échéance |

---

## Architecture

```
app/web      PWA React (16 écrans, hors ligne)
app/mobile   Flutter (V2)
     │
backend      Fastify + Zod — auth, routes, services, persistance
     │
ai           RAG documentaire, réponses déterministes, LLM encadré, validation
     │
diagnostic   Moteur de règles, sécurité, tests, inspection, seconde opinion
     │
obd          Protocoles (J1979, J2012, ELM327), adaptateurs, transports, simulateur
     │
shared       Types, niveaux de certitude et de sécurité, messages
```

Dépendance à sens unique : `shared ← obd ← diagnostic ← ai ← backend ← app`.
Aucune couche basse ne connaît une couche haute ; le moteur de diagnostic ne fait
aucun appel réseau et ne connaît aucun modèle de langage.

Détail complet : [docs/01-architecture.md](docs/01-architecture.md).

---

## Le moteur de diagnostic en une page

```
Données mesurées → codes défaut → PID et plages → symptômes → historique
      → règles techniques → base de connaissances → tests guidés
      → moteur de diagnostic → IA explicative
```

**Pondération** — un test réalisé vaut plus qu'une mesure, qui vaut plus qu'une fiche
technique, qui vaut plus qu'un symptôme déclaré :

| Contribution | Poids |
| --- | --- |
| Test réalisé sur le véhicule | 1,05 |
| Mesure lue en OBD | 1,00 |
| Donnée documentée (fiche, carnet) | 0,85 |
| Historique du véhicule | 0,80 |
| Symptôme déclaré | 0,70 |

**Niveaux de certitude** (§10) : `CONFIRMÉ` · `FORTEMENT COMPATIBLE` · `POSSIBLE` ·
`INDÉTERMINABLE` · `NON DISPONIBLE`.

**Niveaux de sécurité** (§11) : 🟢 `NORMAL` · 🟡 `ATTENTION` · 🟠 `IMPORTANT` ·
🔴 `CRITIQUE`.

Une conclusion « CONFIRMÉ » est **structurellement impossible** sans test ou mesure
directe : le moteur plafonne lui-même sa certitude.

Détail complet : [docs/02-moteur-diagnostic.md](docs/02-moteur-diagnostic.md).

---

## L'IA est une explication, pas un diagnostic

- Le diagnostic est produit par un moteur de règles : même sans aucun LLM, XAMOTO
  fonctionne intégralement (`XAMOTO_LLM_PROVIDER=none` par défaut).
- Lorsqu'un LLM est configuré, il ne reçoit qu'un **pack de contexte fermé** et sert
  uniquement à reformuler.
- Chaque réponse est contrôlée : toute donnée absente du contexte, toute cause
  présentée comme certaine, toute simulation présentée comme réelle, toute garantie
  implicite entraîne le **rejet** de la réponse et la publication de la version
  déterministe.
- L'utilisateur voit ce qui a été utilisé : faits disponibles, faits manquants,
  documents cités, moteur utilisé, résultat du contrôle.

Phrases garanties par le produit (et testées automatiquement) :

- « Je ne dispose pas de cette donnée pour votre véhicule. »
- « Plusieurs causes sont possibles. »
- « Ce test est nécessaire avant de conclure. »

Détail complet : [docs/04-ia-anti-hallucination.md](docs/04-ia-anti-hallucination.md).

---

## Mode simulation

XAMOTO fonctionne **sans véhicule** grâce à un simulateur OBD, pour découvrir le
produit ou tester une situation :

| Scénario | Situation |
| --- | --- |
| `normal_engine` | Aucun défaut |
| `weak_battery` | Batterie faible |
| `high_temperature` | Surchauffe |
| `engine_fault` | Ratés d'allumage |
| `multiple_dtc` | Plusieurs codes simultanés |
| `intermittent_fault` | Défaut intermittent revenu après effacement |
| `no_start` | Véhicule qui ne démarre pas |
| `diesel_egr_dpf` | EGR / FAP diesel |

Tout ce qui provient du simulateur est étiqueté **MODE SIMULATION — données non issues
d'un véhicule réel**, dans l'interface, l'API et les rapports.

---

## Configuration

Aucune clé n'est obligatoire : XAMOTO démarre et fonctionne complètement hors ligne.

| Variable | Défaut | Rôle |
| --- | --- | --- |
| `PORT` | `3000` | Port HTTP |
| `HOST` | `0.0.0.0` | Interface d'écoute |
| `NODE_ENV` | `development` | Environnement |
| `XAMOTO_DB_PATH` | `./data/xamoto.sqlite` | Fichier SQLite |
| `XAMOTO_JWT_SECRET` | secret de développement | **À définir en production** |
| `XAMOTO_SESSION_TTL_HOURS` | `720` | Durée de vie des sessions |
| `XAMOTO_PUBLIC_URL` | `http://localhost:3000` | Base des liens publics |
| `XAMOTO_WEB_DIST` | `./app/web/dist` | Interface compilée à servir |
| `XAMOTO_LLM_PROVIDER` | `none` | `none` · `openai` · `anthropic` |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | — | Clés éventuelles (jamais exposées au navigateur) |
| `XAMOTO_LLM_MODEL` | selon fournisseur | Modèle utilisé pour la reformulation uniquement |
| `XAMOTO_RATE_LIMIT_MAX` | `240` | Requêtes par minute et par adresse |
| `XAMOTO_LOG_LEVEL` | `info` | Verbosité des journaux |

Toutes les variables sont documentées dans [.env.example](.env.example).

---

## Base de données

| Usage | Support | Fichier |
| --- | --- | --- |
| Développement, hors ligne | SQLite embarqué | `backend/src/db/schema.ts` |
| Production | PostgreSQL ≥ 14 / Supabase | `database/migrations/postgres/001_init.sql` |
| Base de connaissances | PostgreSQL | `database/seed/001_knowledge.sql` |
| Référentiels (véhicules, garages, pièces) | PostgreSQL | `database/seed/002_reference.sql` |

37 tables, mêmes noms et mêmes contraintes dans les deux dialectes. Toute donnée de
diagnostic porte une **origine** (`measured`, `documented`, `calculated`, `estimated`,
`simulated`, `unknown`) : c'est ce qui autorise l'affichage d'une étiquette d'origine
et la pondération des causes.

Commandes utiles :

```bash
npm run seed                                    # base de connaissances + démo
npx tsx backend/src/db/seed-cli.ts --reset       # repartir d'une base vide
npx tsx backend/src/db/seed-cli.ts --no-demo     # sans véhicules de démonstration

psql "$DATABASE_URL" -f database/migrations/postgres/001_init.sql
psql "$DATABASE_URL" -f database/seed/001_knowledge.sql
psql "$DATABASE_URL" -f database/seed/002_reference.sql
```

Détail complet : [docs/05-base-de-donnees.md](docs/05-base-de-donnees.md).

---

## Tests

```bash
npm run typecheck                                     # types paquets + backend + tests
npm test                                              # 181 tests unitaires
npm run test:watch                                     # en continu

npm run test:e2e                                       # 45/45 de bout en bout (API + base)
npm run test:screens                                   # 22/22 (16 écrans + 6 contrôles de langue)
npm run build                                          # interface (app/web/dist)
```

Les tests unitaires couvrent ce qui ne doit jamais se casser : le codec des codes
défaut, les niveaux de certitude et de gravité, les décisions du moteur de
diagnostic, l'honnêteté du second avis et de l'inspection avant achat, le transport
Bluetooth (faux pont ELM327, donc sans matériel), et le refus par l'IA de toute
donnée inventée (code, valeur, spécification, garantie).

Le test de bout en bout vérifie notamment qu'aucune hypothèse « confirmée » n'est
produite sans test réalisé, qu'un partage au garage est **refusé sans consentement**,
qu'un code défaut inconnu déclenche la phrase d'indisponibilité, et que la
synchronisation hors ligne est idempotente.

Détail complet : [docs/09-tests.md](docs/09-tests.md).

---

## Documentation

| Document | Contenu |
| --- | --- |
| [00-vision.md](docs/00-vision.md) | Pourquoi XAMOTO, les trois piliers, ce qu'il n'est pas |
| [01-architecture.md](docs/01-architecture.md) | Couches, flux d'une donnée, déploiement, extensions |
| [02-moteur-diagnostic.md](docs/02-moteur-diagnostic.md) | Règles, pondérations, certitude, sécurité, tests, seconde opinion |
| [03-obd.md](docs/03-obd.md) | Protocoles, adaptateurs, ELM327, simulateur |
| [04-ia-anti-hallucination.md](docs/04-ia-anti-hallucination.md) | Périmètre de l'IA, pack de contexte, validation |
| [05-base-de-donnees.md](docs/05-base-de-donnees.md) | Schéma, règles de modélisation, migrations |
| [06-securite.md](docs/06-securite.md) | Authentification, permissions, consentement, données personnelles |
| [07-api.md](docs/07-api.md) | Surface HTTP complète avec exemples |
| [08-phases.md](docs/08-phases.md) | MVP (§42), V2, V3, méthode de travail |
| [09-tests.md](docs/09-tests.md) | Vérifications et résultats attendus |
| [10-afrique.md](docs/10-afrique.md) | Contexte d'usage réel, contraintes matérielles |
| [11-principes.md](docs/11-principes.md) | Les dix principes absolus et où ils sont vérifiables |

---

## Feuille de route

**MVP (V1) — livré** : véhicules, scan OBD (Wi-Fi + simulateur), codes défaut, PID avec
disponibilité explicite, moteur de diagnostic, certitude et sécurité, « puis-je
rouler ? », tests guidés, après-réparation, seconde opinion, passeport, entretien et
alertes, rapport partageable, assistant anti-hallucination, synchronisation hors ligne.

**V2** : application mobile Flutter, Bluetooth OBD, inspection avant achat approfondie,
devis et analyse factuelle, graphe de pièces étendu, multilingue complet (wolof), mode
flotte.

**V3** : maintenance prédictive (tendances mesurées, jamais des prédictions de panne),
réseau de garages partenaires, diagnostic à distance assisté, apprentissage à partir de
cas documentés et attribués, véhicules électriques et hybrides.

Détail : [docs/08-phases.md](docs/08-phases.md).

---

## Principes absolus

1. Aucune donnée inventée.
2. Aucune simulation présentée comme réelle.
3. Aucune hypothèse présentée comme une certitude.
4. La sécurité prime sur le confort.
5. XAMOTO doit savoir dire « je ne sais pas ».
6. Toute conclusion est reliée à des données identifiables.
7. Le diagnostic ne dépend pas de l'IA générative.
8. L'utilisateur valide ce qu'il observe.
9. Aucun jugement sur les personnes (garage, vendeur, prix).
10. Aucune garantie sur l'état réel du véhicule.

---

## Licence

UNLICENSED — projet privé. Les référentiels cités (SAE J2012, SAE J1979, ISO 15031,
ISO 15765) restent la propriété de leurs éditeurs ; XAMOTO n'en reprend que des
définitions génériques publiques, avec attribution.
