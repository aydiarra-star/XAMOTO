# Multilingue : français, anglais, wolof

XAMOTO annonce trois langues. Ce document décrit ce que cette annonce veut dire
exactement, et comment le code l'empêche de devenir un mensonge.

## 1. Le problème posé

Un produit qui prétend parler une langue sans locuteur natif est un produit qui
ment. Sur un sujet mécanique, une phrase approximative n'est pas seulement
désagréable : « ce bruit n'est pas grave » mal traduit peut envoyer quelqu'un sur
la route avec un frein défaillant.

XAMOTO applique donc trois règles, inscrites dans le catalogue lui-même
(`shared/src/i18n.ts`) et vérifiées par des tests (`shared/test/i18n.test.ts`) :

1. **Aucune traduction automatique n'est affichée comme fiable.** Un texte wolof
   n'apparaît que s'il figure dans le catalogue partagé, avec sa clé, sa version
   française, sa version anglaise, son statut et son relecteur.
2. **Aucune consigne de sécurité n'est traduite à l'aveugle.** Une entrée de
   portée `safety` qui n'a pas le statut `reviewed` n'est jamais montrée en
   wolof : le français s'affiche à la place, et l'interface explique pourquoi.
3. **Le repli est visible.** L'utilisateur sait à tout moment ce qui est traduit,
   ce qui est provisoire et ce qui manque (`wolofReport()`).

## 2. Le catalogue comme source de vérité

```ts
{ key: 'certainty.possible',
  fr: 'POSSIBLE', en: 'POSSIBLE', wo: 'MANA DOON',
  scope: 'label', status: 'draft', reviewer: null }
```

- `scope` : `ui` (navigation, boutons), `label` (niveaux, origines, statuts),
  `safety` (consignes de conduite, messages de non-garantie).
- `status` : `draft` ou `reviewed`.
- `reviewer` : nom du locuteur natif qui a relu. Tant qu'il est `null`, l'entrée
  n'est pas une traduction validée.

L'affichage se décide par une fonction unique, `isWolofDisplayable()`, dérivée du
statut et de la portée — jamais d'un drapeau passé à la main :

| Portée | `draft` | `reviewed` |
| --- | --- | --- |
| `ui` | affiché ; le bandeau de langue rappelle que la version est provisoire | affiché |
| `label` | affiché ; même rappel, avec le nombre exact de libellés concernés | affiché |
| `safety` | **français affiché à la place** | affiché |

Le rappel « traduction en cours de relecture » est porté par le bandeau de langue
(`wolofReport().noticeFr`), affiché en haut de l'interface dès que la langue active
est le wolof : il donne les compteurs réels plutôt que de laisser croire à une
version aboutie. Chaque libellé provisoire n'est donc pas annoté un par un — ce qui
rendrait l'interface illisible — mais l'utilisateur ne peut pas ignorer l'état de la
langue.

## 3. Ce qui est traduit aujourd'hui

`wolofReport()` renvoie l'état exact, et l'API comme l'interface l'exposent :
total d'entrées, nombre affichable, nombre relu, textes de sécurité en attente.
Aucun compteur n'est écrit à la main dans la documentation : il est calculé.

Les mots de niveau (🟢 NORMAL, 🟡 ATTENTION, 🟠 IMPORTANT, 🔴 CRITIQUE) et les
consignes de conduite font partie des textes en attente de relecture. C'est
volontaire : ce sont eux qui engagent la sécurité.

## 4. Une réponse de l'assistant n'est jamais traduite automatiquement

L'assistant compose ses explications à partir des données du véhicule. Les
traduire par génération serait exactement ce que le cahier des charges interdit.
Quand la langue demandée est le wolof, la réponse est donc rédigée dans la langue
de référence et accompagnée d'un objet `language` explicite :

```json
{
  "requested": "wo",
  "effective": "fr",
  "fallback": true,
  "notice": "Réponse rédigée en français : la version wolof des explications de diagnostic n'est pas encore relue par un locuteur natif. Le wolof est utilisé pour les libellés déjà validés."
}
```

L'interface affiche cet avertissement dans la bulle de réponse : personne ne peut
croire que la réponse a été traduite.

## 5. Comment ajouter une traduction

1. Ajouter ou compléter l'entrée dans `WOLOF_CATALOGUE` (`shared/src/i18n.ts`)
   avec la clé, le français, l'anglais et le wolof.
2. Faire relire le texte par un locuteur natif **et l'inscrire comme
   `reviewer`** : c'est ce champ, et lui seul, qui fait passer une entrée
   `safety` de « français » à « wolof ».
3. Lancer `npm test`. La suite multilingue vérifie la cohérence du catalogue :
   une clé dupliquée, une entrée `safety` affichable sans relecteur ou un rapport
   inexact font échouer les tests.

Aucune interface d'administration ne permet de « traduire à la volée » : c'est
délibéré. Une traduction entre dans le produit par une revue, pas par un écran.

## 6. Et les autres langues du continent ?

Le wolof ouvre la voie. Le catalogue est indépendant de la langue : ajouter le
bambara, le peul ou le haoussa suit exactement la même procédure, avec les mêmes
garde-fous. Le §39 demande un produit pensé pour l'Afrique de l'Ouest ; la
réponse de XAMOTO est de le faire avec des locuteurs, pas à leur place.
