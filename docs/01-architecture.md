# Architecture

## 1. Vue d'ensemble

```
                        ┌─────────────────────────────┐
   Navigateur / PWA ───►│  app/web  (React + Vite)    │
                        │  16 écrans, hors ligne (§22)│
                        └──────────────┬──────────────┘
                                       │ HTTP /api (URL relatives)
                                       ▼
                        ┌─────────────────────────────┐
   Application mobile ─►│  backend/  (Fastify + Zod)  │
   Flutter (§34)        │  auth · routes · services   │
                        └──────┬───────────┬──────────┘
                               │           │
              ┌────────────────▼──┐   ┌────▼─────────────────┐
              │  diagnostic/      │   │  ai/                 │
              │  moteur de règles │◄──┤  RAG + validation    │
              │  sécurité, tests  │   │  (explique seulement)│
              └────────────────▲──┘   └──────────────────────┘
                               │
                        ┌──────┴───────┐
                        │  obd/        │
                        │  protocoles  │
                        │  adaptateurs │
                        │  simulateur  │
                        └──────┬───────┘
                               │
                    ┌──────────▼───────────┐
                    │  shared/             │
                    │  types, niveaux,     │
                    │  messages (§10, §47) │
                    └──────────────────────┘
```

## 2. Règle de dépendance (une seule direction)

```
shared  ←  obd  ←  diagnostic  ←  ai  ←  backend  ←  app/*
```

Aucune couche basse ne connaît une couche haute. Conséquences vérifiables :

- `obd/` ne connaît ni diagnostic, ni IA, ni HTTP ;
- `diagnostic/` ne connaît **aucun** modèle de langage et ne fait aucun appel réseau ;
- `ai/` ne produit jamais de conclusion : il reformule celles du moteur ;
- `backend/` orchestre, persiste et expose ;
- `app/web` ne calcule rien : toute conclusion affichée vient du serveur.

## 3. Couche OBD découplée (§7)

Le cahier des charges interdit de lier l'application à un modèle d'adaptateur.
XAMOTO sépare donc trois notions :

| Notion | Rôle | Exemples |
| --- | --- | --- |
| **Transport** | Comment les octets circulent | `TcpTransport` (ELM327 Wi-Fi), `MemoryTransport` (tests), Bluetooth à venir |
| **Adaptateur** | Quel boîtier parle (et quel dialecte) | `Elm327Adapter`, `SimulatorAdapter` |
| **Protocole** | Comment on interprète les octets | `obd/src/protocols` : J1979 (PIDs), SAE J2012 (codes) |

Ajouter un adaptateur Bluetooth ou un protocole CAN spécifique = **un fichier
nouveau**, sans toucher au moteur de diagnostic ni à l'interface.

## 4. Flux d'une donnée, de bout en bout

```
1. L'utilisateur lance un scan (ou un scénario simulé).
2. obd/ lit les PID supportés, les codes défaut, l'état du voyant moteur.
     → un PID non supporté est retourné « non disponible », JAMAIS estimé.
3. Les mesures sont enregistrées telles quelles, avec leur ORIGINE
     (measured / documented / calculated / estimated / simulated / unknown).
4. diagnostic/ applique ses règles : cohérence → mesures → codes → symptômes → historique.
     → constats, hypothèses pondérées, tests à réaliser, niveau de sécurité.
5. Le backend persiste le tout (sessions, constats, hypothèses, tests).
6. ai/ reçoit un « pack de contexte » fermé et explique :
     → réponse déterministe, puis éventuellement reformulation LLM, puis validation.
7. L'interface affiche : conclusion, certitude, sécurité, données manquantes, sources.
```

À l'étape 6, le pack de contexte est **la seule source** autorisée pour l'IA. Une
phrase qui mentionne une donnée absente du pack est rejetée (voir
[04-ia-anti-hallucination.md](04-ia-anti-hallucination.md)).

## 5. Organisation des fichiers (§48)

```
XAMOTO/
├─ app/
│  ├─ mobile/                  # Flutter (V2) — même API, même moteur
│  └─ web/                     # PWA React : 16 écrans + service worker
├─ backend/
│  ├─ src/auth/                # jetons, permissions, consentement
│  ├─ src/routes/              # surface HTTP (Zod à l'entrée)
│  ├─ src/services/            # orchestration (scan, rapports, passeport)
│  └─ src/db/                  # schéma SQLite, accès, amorçage
├─ diagnostic/
│  ├─ src/engine/              # moteur de diagnostic déterministe
│  ├─ src/rules/               # règles explicites, versionnées
│  ├─ src/safety/              # niveaux de sécurité, « Puis-je rouler ? »
│  └─ src/knowledge/           # codes défaut, tests guidés, symptômes, sources
├─ obd/
│  ├─ src/protocols/           # J1979 (PIDs), SAE J2012 (codes), ELM327
│  ├─ src/adapters/            # ELM327, simulateur, transports
│  └─ src/simulator/           # 9 scénarios, tous étiquetés MODE SIMULATION
├─ ai/
│  ├─ src/rag/                 # corpus documentaire + recherche BM25
│  ├─ src/assistant/           # contexte, réponses déterministes, LLM encadré
│  └─ src/validation/          # contrôle anti-hallucination
├─ database/
│  ├─ migrations/postgres/     # schéma PostgreSQL / Supabase
│  └─ seed/                    # base de connaissances et référentiels
├─ docs/                       # cette documentation
└─ tests/                      # tests de bout en bout et de rendu
```

## 6. Pourquoi ces choix techniques (§34)

| Choix | Raison |
| --- | --- |
| **Fastify + Zod** | Validation explicite de chaque entrée : une donnée mal formée est refusée avant d'atteindre le moteur. |
| **SQLite embarqué** | Fonctionne sans serveur, hors ligne, sur un téléphone ou un petit VPS. |
| **PostgreSQL / Supabase** | Même schéma logique pour la production multi-utilisateurs. |
| **Moteur de règles déterministe** | Reproductible, testable, explicable ; identique avec ou sans LLM. |
| **LLM optionnel** | XAMOTO fonctionne intégralement avec `XAMOTO_LLM_PROVIDER=none`. |
| **OpenStreetMap** | Pas de dépendance à un service propriétaire pour la carte des garages. |
| **React + Vite (PWA)** | Un seul livrable service (API + interface) et un fonctionnement hors ligne. |

## 7. Déploiement mono-service

```bash
npm run build          # construit app/web/dist
npm start              # sert l'API et l'interface sur le même port
```

Le serveur détecte `app/web/dist` et sert l'application monopage ; les routes
inconnues qui ne commencent pas par `/api` retombent sur `index.html`. En
développement, deux processus suffisent : `npm run dev` (API + Vite avec proxy `/api`).

## 8. Points d'extension prévus

- **Bluetooth OBD** : implémenter `ObdTransport` et l'enregistrer dans `adapterRegistry`.
- **Nouveau protocole** : ajouter un fichier dans `obd/src/protocols` et l'exposer aux règles.
- **Nouvelles règles** : ajouter un module dans `diagnostic/src/rules` et l'ajouter à `ALL_RULES`.
- **Nouvelle langue** : les libellés vivent dans `shared/` et `app/web/src/i18n.tsx`.
- **Application mobile Flutter** : consomme la même API, sans duplication du moteur.
