# Moteur de diagnostic

Le moteur vit dans `diagnostic/`. Il est **déterministe** : à données identiques, il
produit la même conclusion. Aucun modèle de langage n'y intervient (§9).

## 1. Chaîne de raisonnement (§9)

```
Données mesurées  →  Codes défaut  →  PID et plages  →  Symptômes déclarés
        →  Historique du véhicule  →  Règles techniques  →  Base de connaissances
        →  Tests guidés  →  Moteur de diagnostic  →  IA explicative
```

L'IA est **le dernier maillon**, jamais le premier. Le moteur n'a pas besoin d'elle
pour fonctionner.

## 2. Règles, par ordre d'application

| Ordre | Module | Objet |
| --- | --- | --- |
| 1 | `rules/coherenceRules.ts` | Vérifier la cohérence des données entre elles (une mesure seule ne veut rien dire). |
| 2 | `rules/pidRules.ts` | Comparer chaque mesure à une plage **attribuée à une source**. |
| 3 | `rules/dtcRules.ts` | Interpréter les codes défaut présents, mémorisés, persistants. |
| 4 | `rules/symptomRules.ts` | Croiser les symptômes déclarés avec les systèmes concernés. |
| 5 | `rules/historyRules.ts` | Utiliser l'historique : défaut revenu après effacement, récidive, kilométrage. |

Chaque règle produit des « effets » typés :

| Effet | Signification |
| --- | --- |
| `finding` | Un constat factuel affiché à l'utilisateur, avec ses preuves. |
| `cause` | Renforce une cause possible (avec un poids qui dépend de l'origine de la donnée). |
| `excludeCause` | Écarte une cause — uniquement si une donnée le justifie. |
| `safety` | Fixe ou élève le niveau de sécurité. |
| `test` | Propose un test qui permettrait de trancher. |
| `missing` | Signale une donnée manquante, éventuellement bloquante pour conclure. |
| `note` | Précision de lecture. |
| `certaintyCap` | **Plafonne** la certitude : interdit de conclure « confirmé » sans preuve. |

Le plafonnement est la garantie structurelle du §10 : sans test réalisé ni mesure
directe, aucune conclusion ne peut être annoncée comme `CONFIRMÉ`.

## 2 bis. Règles par système (§15)

Toutes les règles ne se valent pas selon la partie du véhicule concernée : lire
un défaut moteur et lire un défaut de freinage ne demande pas la même prudence.
Deux notions sont donc distinguées, et exposées à l'utilisateur :

- les **règles générales** (cohérence des données, codes défaut documentés,
  symptômes, historique) s'appliquent à tout scan, quel que soit le système ;
- les **règles dédiées** portent la lecture propre à un système :
  `brakingRules.ts` (freinage, ABS), `networkRules.ts` (réseau, électricité),
  `transmissionRules.ts` (boîte), `climateRules.ts` (climatisation),
  `coolingRules.ts` (refroidissement), `bodyRules.ts` (airbag, carrosserie).

Chaque règle dédiée déclare les systèmes qu'elle couvre (`Rule.systems`), et
`rulesForSystem()` / `RULES_BY_SYSTEM` donnent la vue inverse.

### Ce que XAMOTO ne peut pas lire, il le dit

`diagnostic/src/knowledge/systems.ts` décrit, pour les quinze systèmes de la
nomenclature, ce que la lecture embarquée donne réellement et ce qu'elle ne donne
pas — avec la source de l'affirmation. Le niveau de lecture est explicite :

| Niveau | Signification |
| --- | --- |
| `codes_and_data` | Codes défaut **et** mesures disponibles |
| `codes_only` | Codes défaut seulement |
| `limited` | Accessible sur certains véhicules ou certaines interfaces |
| `not_accessible` | Hors de portée de l'OBD standard |

Exemples d'application, vérifiés par les tests :

- **freinage / ABS** : un code de châssis (C0xxx) décrit un circuit, jamais une
  pièce à remplacer. La règle impose l'ordre roue → câblage → masse → capteur →
  boîtier, plafonne la certitude à « possible » et exige une mesure physique.
- **réseau** : un code U n'autorise jamais « calculateur à remplacer » : la
  batterie, les masses et les connecteurs passent avant la mesure du bus.
- **boîte de vitesses** : le détail vit dans le calculateur de boîte ; le niveau
  de lecture est `limited` et la certitude reste « possible ».
- **airbag** : `not_accessible`. Aucune hypothèse technique n'est produite ; la
  règle rappelle les règles de sécurité pyrotechnique et renvoie à un
  professionnel équipé.
- **climatisation** : le nettoyage du condenseur et du filtre d'habitacle passe
  avant toute recharge de gaz.

Un test échoue si un système de la nomenclature n'a **ni** règle dédiée **ni**
limite documentée : un trou silencieux serait interprété comme « tout va bien ».

## 3. Pondération : ce qui compte le plus

Un constat ne vaut pas un test. Le score d'une cause est une somme de contributions :

| Contribution | Poids | Lecture |
| --- | --- | --- |
| Test réalisé sur le véhicule | **1,05** | La preuve la plus forte : un test a été fait, avec un résultat. |
| Mesure lue en OBD | 1,00 | La réalité du véhicule, au moment du scan. |
| Donnée documentée (fiche, carnet) | 0,85 | Solide, mais générique au modèle. |
| Historique du véhicule | 0,80 | Contexte réel, sans mesure actuelle. |
| Symptôme déclaré | 0,70 | Déclaratif : utile, jamais suffisant. |

Seuils de qualification :

| Score | Certitude attribuée |
| --- | --- |
| ≥ 0,50 | `CONFIRMÉ` — uniquement atteignable avec un test ou une mesure directe cohérente |
| ≥ 0,45 | `FORTEMENT COMPATIBLE` |
| ≥ 0,22 | `POSSIBLE` |
| < 0,22 | La cause n'est pas affichée |

Un `certaintyCap` peut interdire le niveau supérieur même si le score l'atteint :
c'est le cas, par exemple, quand toutes les données proviennent du déclaratif.

## 4. Niveaux de certitude (§10)

| Niveau | Libellé affiché | Définition |
| --- | --- | --- |
| `confirmed` | **CONFIRMÉ** | Une mesure ou un test réalisé sur ce véhicule le confirme. |
| `strongly_compatible` | **FORTEMENT COMPATIBLE** | Les données vont clairement dans ce sens ; un test reste nécessaire. |
| `possible` | **POSSIBLE** | Cause plausible ; d'autres causes restent possibles. |
| `undeterminable` | **INDÉTERMINABLE** | Les données ne permettent pas de trancher. |
| `unavailable` | **NON DISPONIBLE** | XAMOTO ne dispose pas de cette donnée pour ce véhicule. |

Quand plusieurs causes restent en lice, le moteur l'écrit explicitement :
**« Plusieurs causes sont possibles. »**

## 5. Niveaux de sécurité (§11)

| Niveau | Signification | Effet sur « Puis-je rouler ? » |
| --- | --- | --- |
| 🟢 `normal` | Aucune urgence identifiée | Réponse normale possible, avec les réserves d'usage |
| 🟡 `attention` | À surveiller | Réponse nuancée + points à vérifier |
| 🟠 `important` | Contrôle rapide recommandé | Réponse restrictive + éviter les efforts |
| 🔴 `critical` | Éviter de rouler | Réponse négative jusqu'à contrôle |

Le niveau final est le **pire** de tous les niveaux déclenchés : un voyant rouge
n'est jamais « compensé » par une mesure verte.

## 6. « Puis-je rouler ? » (§12)

La réponse est structurée, jamais un simple oui/non :

- `headlineFr` : la phrase de réponse ;
- `whyFr` : pourquoi, à partir de quelles données ;
- `toCheckFr` : ce qu'il faut vérifier avant de partir ;
- `avoidFr` : ce qu'il faut éviter ;
- `seeProfessionalFr` : quand consulter ;
- `dataUsed` : les éléments réellement utilisés ;
- `missingData` : ce qui manque pour être plus précis ;
- `disclaimerFr` : **avertissement de non-garantie**, affiché systématiquement.

> « XAMOTO ne garantit pas la sécurité du véhicule. Cette réponse dépend des données
> disponibles et du moment du scan : si un voyant reste allumé ou si le comportement
> change, faites contrôler le véhicule. »

## 7. Tests guidés (§17)

Les tests proviennent de `diagnostic/src/knowledge/tests.ts`. Chaque définition porte :
objectif, matériel, étapes, résultat attendu, interprétation, conditions, durée,
niveau de sécurité.

Un résultat de test n'est enregistré **que** si l'utilisateur le confirme
explicitement (`confirmed: true`). Le serveur refuse sinon (HTTP 400) : XAMOTO
n'attribue jamais une mesure à la place de l'utilisateur.

Quand aucun test spécifique n'existe pour une cause, deux tests de repli sont
proposés — contrôle visuel du câblage et tension de repos de la batterie — plutôt que
rien : `FALLBACK_TESTS`.

## 8. Après réparation (§19)

`compareAfterRepair` confronte deux scans et classe les codes :

- **disparus** — mais XAMOTO ne conclut pas que la réparation est définitive ;
- **persistants** — la cause n'est pas traitée ;
- **nouveaux** — à investiguer séparément.

Le verdict porte toujours un niveau de certitude, et le message rappelle qu'un défaut
peut revenir après plusieurs cycles de conduite.

## 9. Seconde opinion (§20)

`secondOpinion` met en regard un diagnostic reçu (garage, vendeur) et les données
réelles : ce qui est confirmé, ce qui n'est pas confirmé, les causes alternatives
restant possibles, les tests manquants, et une liste de **questions à poser**.

Aucun jugement sur le garage, aucun avis sur un prix : des faits et des questions.

## 10. Versionnage

Le moteur expose `ENGINE_VERSION` et `ENGINE_RULES_VERSION`. Chaque diagnostic
persisté conserve la version utilisée : une conclusion ancienne peut donc être
expliquée, comparée ou recalculée sans ambiguïté.
