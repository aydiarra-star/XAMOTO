# Les principes absolus (§47)

Ces dix principes sont la constitution du produit. Une fonctionnalité qui les
enfreint n'est pas livrée.

| # | Principe | Traduction technique |
| --- | --- | --- |
| 1 | **Aucune donnée inventée.** | Un PID non supporté reste `null` + `supported: false`. Une valeur constructeur absente n'est pas remplacée. |
| 2 | **Aucune simulation présentée comme réelle.** | `origin: 'simulated'` → bandeau MODE SIMULATION dans l'interface, le rapport et les réponses de l'assistant. |
| 3 | **Aucune hypothèse présentée comme certitude.** | Niveaux de certitude obligatoires ; `certaintyCap` empêche « CONFIRMÉ » sans test ou mesure. |
| 4 | **La sécurité prime sur le confort.** | Le niveau de sécurité final est le pire des niveaux déclenchés, jamais une moyenne. |
| 5 | **XAMOTO doit savoir dire « je ne sais pas ».** | Phrase littérale d'indisponibilité ; `missingData` affiché ; conclusion possible « INDÉTERMINABLE ». |
| 6 | **Toute conclusion est reliée à des données identifiables.** | Chaque constat porte ses preuves (`evidence`) et son origine. |
| 7 | **Le diagnostic ne dépend pas de l'IA générative.** | Moteur de règles déterministe ; `XAMOTO_LLM_PROVIDER=none` fonctionne intégralement. |
| 8 | **L'utilisateur valide ce qu'il observe.** | `confirmed: true` obligatoire pour enregistrer un résultat de test ; `consent: true` pour un partage. |
| 9 | **Aucun jugement sur les personnes.** | Pas d'avis sur un garage, un prix ou un vendeur ; uniquement des faits et des questions à poser. |
| 10 | **Aucune garantie sur l'état réel du véhicule.** | Avertissement de non-garantie dans toute réponse « Puis-je rouler ? » et dans tout rapport. |

## Où ces principes sont vérifiables

| Principe | Fichier | Test |
| --- | --- | --- |
| 1 | `obd/src/protocols/pids.ts`, `backend/src/routes/scan.ts`, `obd/src/adapters/bluetoothTransport.ts` | `obd/test/protocols.test.ts` : « un octet 0xFF n'est jamais décodé comme une valeur » ; `obd/test/bluetooth.test.ts` : « sans pilote enregistré, aucun appareil n'est proposé » ; Smoke : « Données non supportées listées », « Aucun appareil Bluetooth inventé sans pilote » |
| 2 | `shared/src/levels.ts`, `app/web/src/components.tsx` | `obd/test/protocols.test.ts` : « toute lecture du simulateur est marquée simulated » ; Smoke : « Mention MODE SIMULATION présente » ; `obd/test/bluetooth.test.ts` : aucune liste d'appareils sans pilote |
| 3 | `diagnostic/src/engine/index.ts`, `hypotheses.ts` | `diagnostic/test/engine.test.ts` : « aucune hypothèse ne peut être confirmée sans test » ; Smoke : « Aucune hypothèse confirmée sans test réalisé » |
| 4 | `diagnostic/src/safety/index.ts` | `shared/test/levels.test.ts` : `worstSafety` , `diagnostic/test/engine.test.ts` : « la sécurité ne s'adoucit jamais » |
| 5 | `ai/src/assistant/qa.ts` | `ai/test/anti-hallucination.test.ts` : phrase exacte du §16 pour un code non documenté ; Smoke : « Code non documenté : XAMOTO annonce l'absence de donnée » |
| 6 | `diagnostic/src/rules/*` | Types `evidence` dans `diagnostic_findings` ; `diagnostic/test/engine.test.ts` : « chaque hypothèse porte un score, un niveau et une raison » |
| 7 | `ai/src/assistant/llm.ts` | `ai/test/anti-hallucination.test.ts` : réponse complète sans LLM, et repli si le fournisseur est en erreur |
| 8 | `backend/src/routes/diagnostic.ts` | Smoke : « Résultat de test refusé sans confirmation » |
| 9 | `diagnostic/src/engine/secondOpinion.ts` | `diagnostic/test/procedures.test.ts` : « ne juge jamais le professionnel ni le prix » |
| 10 | `diagnostic/src/safety/canIDrive.ts` | `ai/test/anti-hallucination.test.ts` : « rejette une garantie de sécurité » ; Smoke : « Puis-je rouler ? avec avertissement de non-garantie » |

## Une question de conception, pas de communication

Ces principes ne sont pas une charte affichée : ils sont inscrits dans les types, les
contraintes de base de données et les routes. Par exemple, il n'existe **aucun** chemin
de code permettant d'enregistrer un résultat de test sans confirmation utilisateur, ni
de transmettre un diagnostic à un garage sans consentement : le serveur renvoie une
erreur 400.
