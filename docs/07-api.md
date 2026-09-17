# API HTTP

Base : `/api`. Authentification : `Authorization: Bearer <jeton>` (sauf mention
contraire). Toutes les entrées sont validées par Zod ; toute erreur respecte la forme :

```json
{ "error": { "code": "invalid_input", "message": "…", "details": {} } }
```

## 1. Comptes et démonstration

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/api/auth/register` | Créer un compte (e-mail, mot de passe ≥ 8, nom, pays, langue) |
| POST | `/api/auth/login` | Connexion → `{ token, user }` |
| POST | `/api/auth/logout` | Révoquer la session courante |
| GET | `/api/auth/me` | Profil courant |
| POST | `/api/auth/change-password` | Changer le mot de passe (révoque les autres sessions) |
| POST | `/api/auth/demo` | Entrer en mode démonstration (compte public) |
| POST | `/api/demo/vehicle` | Créer un véhicule de démonstration + scan simulé |
| GET | `/api/demo/scenarios` | Même contenu que `/api/obd/simulator/scenarios` |
| GET | `/api/health` · `/api/health/db` | Santé du service et de la base |

## 2. Véhicules, passeport, entretien

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/vehicles` | Lister (avec permission par véhicule et fiche technique si connue) |
| POST | `/api/vehicles` | Créer (marque, modèle, année, motorisation, carburant, boîte…) |
| GET | `/api/vehicles/:id` | Détail + permission |
| PATCH | `/api/vehicles/:id` | Mettre à jour (kilométrage, plaque, VIN…) |
| DELETE | `/api/vehicles/:id` | Supprimer (propriétaire uniquement) |
| GET | `/api/vehicles/:id/passport` | Passeport complet : compteurs, événements, scans, diagnostics, réparations |
| GET | `/api/vehicles/:id/maintenance` | Plan d'entretien calculé |
| POST | `/api/vehicles/:id/maintenance` | Enregistrer un entretien réalisé |
| POST | `/api/vehicles/:id/maintenance/plan` | Recalculer avec facteurs d'usage (poussière, ville, chaleur, trajets courts) |
| GET | `/api/vehicles/:id/predictive` | Tendances mesurées (§23) — jamais une prédiction de panne |
| POST | `/api/vehicles/:id/shares` · GET · DELETE `/shares/:shareId` | Partage et révocation |
| GET/POST | `/api/vehicles/:id/documents` | Documents du véhicule |
| POST | `/api/demo/vehicle` | Véhicule simulé |

## 3. OBD et scans (§7, §30)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/obd/candidates` | Adresses et ports usuels ELM327 |
| POST | `/api/obd/probe` | Tester la joignabilité d'un adaptateur (`{ host, port }`) |
| GET | `/api/obd/simulator/scenarios` | 8 scénarios disponibles |
| POST | `/api/scans` | Lancer un scan (`mode: obd`\|`simulator`, scénario, symptômes, `analysisMode`) |
| GET | `/api/scans` | Lister les scans d'un véhicule |
| GET | `/api/scans/:id` | Détail : mesures, codes, provenance |
| POST | `/api/scans/:id/clear` | Effacer les défauts (`confirm: true` obligatoire) |

Réponse d'un scan réussi (`201`) : `sessionId`, `diagnosticSessionId`, `source`,
`protocol`, `milOn`, `readings`, `dtcs`, `unsupportedPids`, `warnings`, `notes`,
`diagnostic`, `simulationNotice`.

En cas d'échec de lecture : **HTTP 502** `scan_failed`, avec le rappel qu'aucune donnée
n'a été enregistrée — XAMOTO ne remplace jamais une lecture échouée par une estimation.

## 4. Diagnostic (§9 → §20)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/diagnostics` | Lister (par véhicule ou pour l'utilisateur) |
| GET | `/api/diagnostics/:id` | Diagnostic complet + parcours guidé |
| GET | `/api/diagnostics/:id/can-i-drive` | « Puis-je rouler ? » + avertissement de non-garantie |
| GET | `/api/diagnostics/:id/tests` | Tests proposés |
| POST | `/api/diagnostics/:id/tests/:testKey/result` | Enregistrer un résultat (`confirmed: true` obligatoire) puis recalcul |
| POST | `/api/diagnostics/:id/compare` | Après réparation : comparaison avant/après |
| POST | `/api/diagnostics/:id/second-opinion` | Seconde opinion (diagnostic externe reçu) |
| POST | `/api/vehicles/:id/inspection` | Inspection avant achat (exige un scan existant) |
| GET | `/api/vehicles/:id/inspections` | Inspections précédentes |
| POST | `/api/repairs` · GET `/api/repairs` | Réparations déclarées |

## 5. Référentiels techniques

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/knowledge/systems` | Couverture par système : ce que l'OBD donne, ce qu'il ne donne pas, règles dédiées |
| GET | `/api/knowledge/tests` | Tests guidés documentés |
| GET | `/api/knowledge/symptoms` | Symptômes déclarables |
| GET | `/api/knowledge/dtc?code=&system=&search=` | Codes défaut documentés |
| GET | `/api/knowledge/dtc/unknown/:code` | Code non documenté : nomenclature expliquée, aucune cause inventée |

## 6. Assistant (§13 → §16)

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/api/assistant/ask` | Question → réponse tracée (`usedContext`, `dataDisclosure`, `validation`, `citations`) |
| GET | `/api/assistant/conversations` | Conversations |
| GET | `/api/assistant/conversations/:id/messages` | Messages d'une conversation |
| DELETE | `/api/assistant/conversations/:id` | Supprimer une conversation |
| GET | `/api/assistant/capabilities` | Ce que l'assistant peut faire et ne peut pas faire |

### 6.1 Langue de la réponse (§40)

`POST /api/assistant/ask` accepte `locale` : `fr`, `en` ou `wo`. La réponse
contient toujours un objet `language` qui dit la vérité sur la langue employée :

```json
{
  "requested": "wo",
  "effective": "fr",
  "fallback": true,
  "notice": "Réponse rédigée en français : la version wolof des explications de diagnostic n'est pas encore relue par un locuteur natif…"
}
```

- `effective` est la langue réellement utilisée pour rédiger le texte.
- `fallback: true` signale que `effective` diffère de `requested`, et `notice`
  explique pourquoi. L'interface affiche cette mention dans la bulle de réponse.
- L'assistant ne traduit jamais ses propres explications : une réponse technique
  en wolof serait une invention ([docs/12-multilingue.md](12-multilingue.md)).

Les libellés d'interface (niveaux de certitude, origines, statuts) proviennent du
catalogue partagé `shared/src/i18n.ts` : une entrée n'est affichée en wolof que si
elle a été relue, et les consignes de sécurité restent en français tant qu'un
locuteur natif ne les a pas validées.

## 7. Rapports (§25)

| Méthode | Route | Rôle |
| --- | --- | --- |
| POST | `/api/reports` | Générer (`vehicleId`, `sessionId`, `kind`) → `publicUrl`, `shareToken`, QR code |
| GET | `/api/reports` | Rapports de l'utilisateur |
| GET | `/api/reports/public/:token` | Lecture publique, en lecture seule, sans compte |
| DELETE | `/api/reports/:id/share` | Révoquer le lien de partage |

## 8. Garages, devis, pièces (§26, §27, §28)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/garages?country=&city=&specialty=` | Annuaire |
| GET | `/api/garages/:id` | Détail |
| POST | `/api/garages/:id/share-diagnostic` | Transmettre un diagnostic (`consent: true` obligatoire) |
| POST | `/api/quotes` | Enregistrer un devis reçu |
| POST | `/api/quotes/:id/analysis` | Analyse factuelle : lignes liées ou non à des données mesurées, questions à poser |
| GET | `/api/quotes` | Devis enregistrés |
| GET | `/api/parts?search=` | Graphe de pièces : références, équivalents, prix indicatifs |

## 9. Alertes et synchronisation (§22, §29)

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/alerts` | Alertes de l'utilisateur + compteur non lues |
| POST | `/api/alerts/read` | Marquer comme lues (`all: true` ou `ids: []`) |
| POST | `/api/sync/push` | Envoyer les opérations créées hors ligne |
| GET | `/api/sync/pull` | Récupérer les changements depuis un horodatage |
| GET | `/api/sync/conflicts` | Conflits détectés |
| GET | `/api/vehicles/:id/sync-state` | État de synchronisation d'un véhicule |

Réponse de synchronisation : `{ total, applied, conflicts, rejected, duplicates }`.
Une opération déjà connue est comptée comme **doublon** : la synchronisation est
idempotente, condition nécessaire à un usage en réseau instable.

## 10. Codes d'erreur

| Code | HTTP | Signification |
| --- | --- | --- |
| `invalid_input` | 400 | Corps ou paramètre invalide (détails Zod) |
| `confirmation_required` | 400 | Action à confirmer explicitement (effacement, résultat de test) |
| `consent_required` | 400 | Consentement explicite manquant (partage au garage) |
| `unauthenticated` | 401 | Jeton absent ou invalide |
| `forbidden` | 403 | Permission insuffisante |
| `not_found` | 404 | Ressource inexistante ou non accessible |
| `scan_required` | 409 | Inspection demandée sans scan préalable |
| `scan_failed` | 502 | Lecture OBD impossible : aucune donnée enregistrée |
| `internal_error` | 500 | Erreur serveur, aucune donnée inventée |

## 11. Exemple complet

```bash
# 1. Entrer en mode démonstration
TOKEN=$(curl -s -X POST localhost:3000/api/auth/demo -H 'content-type: application/json' -d '{}' | jq -r .token)

# 2. Lister les véhicules
curl -s localhost:3000/api/vehicles -H "authorization: Bearer $TOKEN" | jq '.vehicles[0].id'

# 3. Lancer un scan simulé avec un symptôme déclaré
curl -s -X POST localhost:3000/api/scans -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"vehicleId":"veh_…","mode":"simulator","scenario":"multiple_dtc","samples":5,"symptoms":[{"key":"loss_of_power","present":true}]}' | jq '.diagnosticSessionId'

# 4. Lire la conclusion
curl -s localhost:3000/api/diagnostics/diag_… -H "authorization: Bearer $TOKEN" | jq '.diagnostic.conclusionFr'
```
