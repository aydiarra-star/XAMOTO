# Sécurité, confidentialité et consentement

## 1. Authentification (§36)

- Mot de passe haché (scrypt, sel aléatoire) — jamais stocké en clair.
- Jeton de session signé (JWT), durée de vie configurable
  (`XAMOTO_SESSION_TTL_HOURS`, 720 h par défaut).
- Le serveur conserve l'empreinte du jeton (`token_hash`) : une session peut être
  révoquée même si le jeton reste valide cryptographiquement.
- `POST /api/auth/logout` révoque immédiatement la session ; `GET /api/auth/me`
  valide le jeton à chaque ouverture de l'application.
- Limitation de débit (`@fastify/rate-limit`) sur l'ensemble de l'API.
- Longueur minimale du mot de passe : 8 caractères. Un changement de mot de passe
  révoque les autres sessions.

## 2. Permissions par véhicule (§38)

Un véhicule a un **propriétaire** ; il peut être partagé avec des permissions
distinctes :

| Permission | Ce qu'elle autorise |
| --- | --- |
| `read` | Consulter le véhicule, son passeport, ses diagnostics |
| `diagnose` | Lancer des scans, enregistrer des résultats de tests |
| `write` | Modifier les données du véhicule, l'entretien, les documents |

Seul le propriétaire (ou un administrateur) peut **supprimer** un véhicule,
**créer** ou **révoquer** un partage. Chaque partage est révocable et journalisé
(`vehicle_shares.revoked_at`, `audit_logs`).

## 3. Consentement explicite (§26, §38)

Rien n'est transmis à un garage sans **consentement explicite** :

```http
POST /api/garages/:id/share-diagnostic
{
  "vehicleId": "veh_…",
  "diagnosticSessionId": "diag_…",
  "includeMeasurements": true,
  "includeDtcList": true,
  "includeHistory": false,
  "message": "Voyant moteur allumé depuis 3 jours",
  "consent": true
}
```

- `consent` doit valoir **exactement** `true` : sinon le serveur répond **HTTP 400**
  `consent_required`.
- L'utilisateur choisit champ par champ ce qu'il transmet (mesures, codes défaut,
  historique). Ce qui n'est pas coché n'est pas envoyé.
- Le partage est enregistré (`sync_operations`, `audit_logs`) et le garage peut être
  retiré à tout moment.

## 4. Effacement des défauts

L'effacement d'un code défaut modifie l'état du véhicule : il exige donc
`confirm: true`, sinon **HTTP 400** `confirmation_required`. XAMOTO avertit alors
qu'un défaut effacé **ne prouve pas** une réparation et qu'un nouveau scan après
conduite est nécessaire.

## 5. Traçabilité

`audit_logs` conserve, pour chaque action sensible : utilisateur, action, entité,
horodatage, et un détail JSON (sans donnée de diagnostic elle-même). L'utilisateur
peut donc répondre à la question « qui a eu accès à quoi, et quand ».

## 6. Données personnelles

XAMOTO traite des données rattachables à une personne (compte, véhicule, kilométrage,
diagnostics). Principes retenus :

1. **Minimisation** : seules les données nécessaires au diagnostic sont collectées.
   L'application web ne stocke en local que le jeton de session et la langue.
2. **Finalité** : les données servent au diagnostic, à l'entretien et au partage
   explicitement autorisé. Aucune revente, aucun profilage publicitaire.
3. **Droit à l'effacement** : `DELETE /api/vehicles/:id` supprime le véhicule et son
   historique en cascade ; la suppression du compte supprime les sessions.
4. **Hébergement** : XAMOTO peut fonctionner **entièrement hors ligne** (SQLite local).
   Aucune donnée ne quitte l'appareil tant qu'aucune synchronisation n'est déclenchée.
5. **Localisation** : la carte des garages utilise OpenStreetMap ; aucune donnée de
   diagnostic n'est transmise au fournisseur de carte.

## 7. Modèle de menace pris en compte

| Menace | Réponse |
| --- | --- |
| Vol de jeton | Révocation par empreinte, expiration configurable, changement de mot de passe |
| Accès à un véhicule tiers | Vérification systématique `assertVehicleAccess` sur chaque route |
| Transmission involontaire à un garage | Consentement explicite obligatoire + choix champ par champ |
| Injection SQL | Requêtes paramétrées exclusivement (`db.all/get/run` avec paramètres liés) |
| Entrée malveillante | Validation Zod de chaque corps de requête |
| Fuite par les rapports publics | Jeton aléatoire, révocable, lecture seule, sans données de compte |
| Indiscrétion d'un lien partagé | Révocation (`DELETE /api/reports/:id/share`) |

## 8. En production

- Définir `XAMOTO_JWT_SECRET` (le secret de développement est refusé en production
  dans les recommandations de déploiement).
- Servir l'application en HTTPS uniquement.
- Restreindre l'accès à PostgreSQL ; si la base est exposée (Supabase), activer
  RLS et écrire des politiques par utilisateur.
- Sauvegarder `data/xamoto.sqlite` (mode WAL) ou la base PostgreSQL.
- Ne jamais placer de clé de modèle de langage dans l'interface : elle reste
  côté serveur (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).

## 9. Ce que XAMOTO ne fera jamais

- Transmettre un diagnostic sans consentement.
- Stocker un mot de passe en clair ou dans un jeton.
- Présenter une donnée simulée comme une mesure réelle.
- Utiliser une donnée de localisation pour un usage autre que l'affichage de la carte.
