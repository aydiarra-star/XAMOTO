# Phases, périmètre et méthode de travail

## 1. Méthode (§49, §50)

Une phase à la fois, dans cet ordre, sans exception :

```
1. Analyser      → comprendre le besoin et les contraintes réelles
2. Planifier     → découper, identifier les dépendances, prévoir les tests
3. Implémenter   → écrire le minimum nécessaire pour la phase
4. Tester        → vérifier le comportement, pas l'intention
5. Corriger      → traiter la cause, jamais le symptôme
6. Non-régression→ rejouer les vérifications des phases précédentes
7. Documenter    → mettre la documentation à jour dans le même mouvement
```

Deux interdits structurants :

- **ne pas tout construire d'un coup** ; une phase livrée et vérifiée vaut mieux que
  dix fonctionnalités à moitié terminées ;
- **ne jamais casser une fonctionnalité validée** : chaque phase rejoue les
  vérifications des phases antérieures (`npm test`, `npm run test:e2e`,
  `npm run test:screens`, `npm run typecheck`).

## 2. MVP — version 1 (§42)

| # | Fonctionnalité | État | Où |
| --- | --- | --- | --- |
| 1 | Création de compte et connexion | ✅ | `backend/src/routes/auth.ts`, `app/web/src/screens/Login.tsx` |
| 2 | Ajout et gestion des véhicules | ✅ | `routes/vehicles.ts`, `screens/Vehicles.tsx`, `VehicleDetail.tsx` |
| 3 | Connexion OBD (ELM327 Wi-Fi) avec détection | ✅ | `obd/src/adapters/tcpTransport.ts`, `elm327Adapter.ts`, `screens/Scan.tsx` |
| 4 | Simulation OBD étiquetée | ✅ | `obd/src/simulator/scenarios.ts` |
| 5 | Lecture des codes défaut | ✅ | `obd/src/protocols/dtc.ts`, `routes/scan.ts` |
| 6 | Lecture des PID, distinction disponible / non disponible | ✅ | `obd/src/protocols/pids.ts`, `screens/Scan.tsx` |
| 7 | Explication des codes défaut en langage simple | ✅ | `diagnostic/src/knowledge/dtc.ts`, `screens/Diagnostic.tsx` |
| 8 | Moteur de diagnostic déterministe | ✅ | `diagnostic/src/engine/`, `rules/` |
| 9 | Niveaux de certitude et de sécurité | ✅ | `shared/src/levels.ts`, affichage dans tous les écrans |
| 10 | « Puis-je rouler ? » avec non-garantie | ✅ | `diagnostic/src/safety/canIDrive.ts`, `screens/CanIDrive.tsx` |
| 11 | Tests guidés avec confirmation utilisateur | ✅ | `knowledge/tests.ts`, `screens/GuidedTests.tsx` |
| 12 | Vérification après réparation | ✅ | `engine/postRepair.ts`, `screens/PostRepair.tsx` |
| 13 | Seconde opinion | ✅ | `engine/secondOpinion.ts`, `screens/SecondOpinion.tsx` |
| 14 | Passeport du véhicule | ✅ | `routes/vehicles.ts` (passport), `screens/VehicleDetail.tsx` |
| 15 | Entretien et notifications | ✅ | `engine/maintenance.ts`, `routes/alerts.ts`, `screens/Maintenance.tsx`, `Alerts.tsx` |
| 16 | Rapport partageable (lien + QR) | ✅ | `services/reportService.ts`, `routes/reports.ts`, `screens/Report.tsx` |
| 17 | Assistant explicatif anti-hallucination | ✅ | `ai/`, `screens/Assistant.tsx` |

## 3. V2 (§43)

| Fonctionnalité | Préparation déjà en place |
| --- | --- |
| Application mobile Flutter | API complète et stable ; moteur identique côté serveur |
| Bluetooth OBD | Contrat `ObdTransport` à implémenter, `adapterRegistry` prêt |
| Inspection avant achat approfondie | `engine/inspection.ts` + `screens/Inspection.tsx` livrés en V1 |
| Devis et analyse factuelle | `routes/garages.ts` (`/api/quotes`, analyse) |
| Graphe de pièces étendu | `parts` + `part_compatibility` |
| Multilingue complet (wolof) | Libellés `fr`/`en` + repères `wo` dans `shared/` et `i18n.tsx` |
| Mode flotte | Table `organizations`, permissions par véhicule |

## 4. V3 (§44)

| Fonctionnalité | Principe déjà posé |
| --- | --- |
| Maintenance prédictive | `GET /api/vehicles/:id/predictive` : tendances mesurées, jamais de prédiction de panne |
| Réseau de garages partenaires | Annuaire + partage consenti ; une place de marché exigera un cadre contractuel |
| Diagnostic à distance assisté | Passeport + rapports partageables |
| Apprentissage à partir des cas réels | Uniquement des cas **documentés et attribués** ; aucune donnée inventée |
| Véhicules électriques et hybrides | Le modèle de données accepte déjà `electrique`, `hybride`, `hybride_rechargeable` |

## 5. État des vérifications

| Vérification | Commande | Résultat attendu |
| --- | --- | --- |
| Types (paquets, backend, tests) | `npm run typecheck` | 0 erreur |
| Types (interface web) | `npx tsc -p app/web/tsconfig.json --noEmit` | 0 erreur |
| Tests unitaires | `npm test` | 105/105 |
| Bout en bout API | `npm run test:e2e` | 35/35 |
| Rendu des écrans | `npm run test:screens` | 16/16 |
| Construction de l'interface | `npm run build` | `app/web/dist` produit |

Après la phase 1 (MVP), la phase 2 a été consacrée à la solidité des couches
sensibles : tests unitaires du codec de codes défaut, du moteur de diagnostic, de la
base de connaissances, des procédures (après réparation, second avis, inspection) et
de l'anti-hallucination. Ces tests ont révélé et permis de corriger cinq défauts
réels, dont un codec DTC qui rendait impossible toute correspondance entre un code
lu sur un véhicule et la base de connaissances (détail :
[docs/09-tests.md](09-tests.md), § 2.1).

## 6. Ce qui reste à faire après cette phase

- Application mobile Flutter (`app/mobile`).
- Transport Bluetooth (`obd/src/adapters/bluetoothTransport.ts`).
- Enrichissement de la base documentaire (chaque ajout exige une source).
- Traductions wolof relues par un locuteur natif (jamais de traduction automatique
  présentée comme fiable).
