# IA explicative et contrôle anti-hallucination

## 1. Répartition des rôles (§13, §16)

| Acteur | Rôle | Interdiction |
| --- | --- | --- |
| Moteur de diagnostic | Produit la conclusion, les hypothèses, les tests | Aucun accès à un modèle de langage |
| Base documentaire (RAG) | Fournit des extraits attribués à une source | Aucune donnée sans source |
| Assistant | **Explique** en français simple | N'ajoute aucun fait nouveau |
| Contrôle de validation | Rejette une réponse non fondée | Tolérance zéro |

XAMOTO fonctionne **sans LLM** : `XAMOTO_LLM_PROVIDER=none` est la configuration par
défaut. Dans ce cas, l'assistant répond avec le moteur déterministe et la base
documentaire : le diagnostic est identique, seule la formulation est plus sobre.

## 2. Le pack de contexte : une frontière étanche

Chaque question construit un `AiContextPack` (`ai/src/assistant/context.ts`) :

```
véhicule        : marque, modèle, année, motorisation, kilométrage
spécifications  : uniquement celles présentes dans la base XAMOTO
mesures         : valeurs réellement lues, avec leur origine
codes défaut    : présents sur le véhicule, avec leur statut
symptômes       : ceux que l'utilisateur a déclarés
historique      : événements du passeport
maintenance     : échéances calculées
canIDrive       : la conclusion de sécurité du moteur
disponibles     : liste des faits utilisables
manquants       : liste des faits ABSENTS
```

Le LLM ne reçoit **rien d'autre**. Une question sur une donnée absente du pack doit
produire une phrase d'indisponibilité, pas une supposition.

## 3. Cascade de réponse

```
question
   │
   ├─► 1. Détection d'intention (déterministe)
   │       « Qu'est-ce que le code P0420 ? », « Puis-je rouler ? »,
   │       « Est-ce grave ? », « Combien ça coûte ? », hors sujet…
   │
   ├─► 2. Réponse déterministe construite à partir du pack de contexte
   │       et des documents retrouvés (recherche BM25, top 4)
   │
   ├─► 3. Si un LLM est configuré : reformulation, à partir du MÊME contexte
   │
   ├─► 4. Validation (§16)
   │       – toute donnée citée doit exister dans le contexte ;
   │       – toute valeur numérique doit provenir du contexte ;
   │       – toute cause doit être annoncée comme possible ;
   │       – les phrases de prudence doivent être présentes.
   │
   └─► 5. Décision
           réponse validée → affichée (mention « LLM utilisé et validé »)
           réponse rejetée → réponse déterministe affichée, rejet journalisé
```

Un rejet n'est pas une erreur : c'est le comportement attendu. La réponse déterministe
est toujours disponible.

## 4. Le contrôle de validation, en détail

`ai/src/validation/index.ts` vérifie notamment :

| Violation détectée | Conséquence |
| --- | --- |
| Valeur numérique absente du contexte | Rejet |
| Code défaut non présent dans le contexte ni dans la base | Rejet |
| Cause présentée comme certaine sans test | Rejet |
| Donnée provenant d'une simulation présentée comme réelle | Rejet |
| Absence des mentions de prudence obligatoires | Rejet |
| Promesse de garantie (« vous pouvez rouler sans risque ») | Rejet |
| Jugement sur un garage, un prix ou une personne | Rejet |

Chaque réponse expose son audit : `usedContext`, `dataDisclosure` (faits disponibles /
faits manquants), `validation` (violations éventuelles), `contextAudit`.

## 5. Les phrases exigées (§16)

Ces formulations sont **littérales** et testées automatiquement :

| Situation | Phrase |
| --- | --- |
| Donnée absente | « Je ne dispose pas de cette donnée pour votre véhicule. » |
| Plusieurs causes en lice | « Plusieurs causes sont possibles. » |
| Conclusion impossible sans test | « Ce test est nécessaire avant de conclure. » |

Le test de bout en bout (`tests/smoke.ts`) vérifie la première sur un code défaut
volontairement absent de la base (`P1234`).

## 6. Refus explicites

L'assistant refuse et le dit :

- **hors périmètre** : « Cette question ne relève pas du périmètre de XAMOTO
  (diagnostic, compréhension et suivi automobile). » ;
- **données insuffisantes** : il indique ce qu'il faudrait pour répondre (un scan, un
  symptôme déclaré, un test) ;
- **demande de garantie** : il refuse de garantir quoi que ce soit sur l'état du
  véhicule.

## 7. Sources et traçabilité

Le corpus (`ai/src/rag/corpus.ts`) contient 26 documents issus de 10 sources
(SAE J2012, SAE J1979, ISO 15031, ISO 15765, documentation d'atelier XAMOTO, plages
d'entretien publiées, référentiels de pièces, retours terrain documentés).

Chaque document porte : éditeur, niveau de fiabilité, version, date, URL éventuelle,
licence. Une réponse cite ses documents, avec un score de pertinence. Aucun extrait
n'est présenté sans sa source.

## 8. Ce que la phase 4 a ajouté au corpus

Huit documents, chacun avec sa source, couvrant les systèmes que l'OBD ne lit pas
ou lit mal — c'est-à-dire précisément ceux sur lesquels une IA générative a
tendance à inventer :

| Document | Source | Rôle |
| --- | --- | --- |
| Tests de disponibilité (moniteurs) | `src_sae_j1979` | Expliquer qu'un scan juste après un effacement ne prouve rien |
| Freinage et ABS : lire un code de châssis | `src_workshop_methods` | Imposer l'ordre roue → câblage → masse → capteur → boîtier |
| Airbags et prétensionneurs | `src_workshop_methods` | Énoncer les règles de sécurité pyrotechnique et refuser de guider |
| Boîte automatique | `src_workshop_methods` | Dire ce que l'OBD donne, et ce qu'il garde pour lui |
| Réseau CAN et codes U | `src_workshop_methods` | Éviter le remplacement de calculateur sur un code de communication |
| Climatisation : nettoyer avant de recharger | `src_african_context` | Ordre de vérification adapté au sable et à la chaleur |
| Embrayage : patinage ou manque de puissance | `src_african_context` | Distinguer deux causes que l'on confond systématiquement |
| Vibrations et bruits de roulement | `src_workshop_methods` | Séparer une fréquence liée aux roues d'une fréquence moteur |

La règle de rédaction est constante : ces documents décrivent des **méthodes**,
des **ordres de vérification** et des **limites**, jamais des valeurs constructeur.
Deux nouvelles sources les portent : `src_workshop_methods` (synthèse de méthodes
d'atelier publiées, avec mention explicite de ce qui n'est pas fourni) et
`src_iso_14229` (services de diagnostic étendus, citée pour expliquer une limite,
sans lien externe inventé).
