# XAMOTO — Vision et principes

> **XAMOTO — « Connaître sa voiture. »**
> Comprendre · Diagnostiquer · Agir

## 1. Le problème

Un automobiliste reçoit aujourd'hui deux types de réponses :

1. **Un voyant s'allume et personne ne sait dire ce qu'il signifie.** Le code défaut
   est lu, mais il n'est pas expliqué : il faut « la valise » du constructeur, un
   vocabulaire technique, et souvent une confiance aveugle dans la personne qui la
   détient.
2. **Une intelligence artificielle répond avec assurance, parfois à tort.** Un
   modèle de langage interrogé sur un code défaut produira une phrase plausible,
   même quand la donnée n'existe pas pour ce véhicule précis.

XAMOTO prend le problème par l'autre bout : **le diagnostic vient des données et de
règles explicites**, l'IA n'intervient que pour **expliquer**.

## 2. Les trois piliers

| Pilier | Ce que cela veut dire concrètement |
| --- | --- |
| **Comprendre** | Chaque voyant, chaque code, chaque mesure est expliqué en français simple, avec sa cause possible, sa gravité réelle et son origine. |
| **Diagnostiquer** | Un moteur de règles croise codes défaut, mesures, symptômes et historique, propose des hypothèses graduées et des **tests qui permettent de trancher**. |
| **Agir** | « Puis-je rouler ? », tests guidés, vérification après réparation, seconde opinion, entretien, devis, garages : des décisions concrètes, sans jamais juger les personnes. |

## 3. Non négociable : XAMOTO doit pouvoir dire « je ne sais pas »

C'est la phrase qui structure tout le produit :

> « Je ne dispose pas de cette donnée pour votre véhicule. »

Trois règles en découlent :

1. **Aucune donnée inventée.** Une valeur constructeur absente reste absente. XAMOTO
   ne complète pas un trou avec une moyenne, un ordre de grandeur ou une supposition.
2. **Aucune hypothèse présentée comme une certitude.** Chaque cause porte un niveau :
   `CONFIRMÉ`, `FORTEMENT COMPATIBLE`, `POSSIBLE`, `INDÉTERMINABLE`, `NON DISPONIBLE`.
3. **Aucune simulation présentée comme une mesure.** Tout ce qui vient du simulateur
   est étiqueté **MODE SIMULATION**, du premier au dernier écran.

## 4. La sécurité prime sur le confort

Les quatre niveaux de sécurité sont affichés partout où une conclusion apparaît :

| Niveau | Signification |
| --- | --- |
| 🟢 `NORMAL` | Aucune urgence identifiée dans les données disponibles. |
| 🟡 `ATTENTION` | À surveiller ; contrôle conseillé au prochain entretien. |
| 🟠 `IMPORTANT` | Contrôle rapide recommandé ; éviter les efforts importants. |
| 🔴 `CRITIQUE` | Éviter de rouler ; faire contrôler le véhicule. |

XAMOTO ne garantit jamais l'état réel d'un véhicule, et le dit à chaque fois qu'il
répond à la question « Puis-je rouler ? ».

## 5. Contexte africain, sans jamais servir d'excuse

Le produit est pensé **d'abord** pour un usage à Dakar, Abidjan, Bamako, Ouagadougou
ou Douala (§39) :

- interface lisible en plein soleil et sur un écran d'entrée de gamme ;
- fonctionnement **hors ligne** d'abord, synchronisation ensuite ;
- adaptateurs OBD répandus en ELM327 **Wi-Fi** (Bluetooth en application mobile) ;
- annuaire de garages, pièces et prix indicatifs en FCFA.

Mais le contexte n'est **jamais** une cause de panne : XAMOTO ne dira jamais « c'est
normal en Afrique ». Une chaleur élevée, une poussière ou un carburant de qualité
variable sont des **facteurs d'usage** déclarés par l'utilisateur, utilisés seulement
pour ajuster des intervalles d'entretien — jamais pour expliquer un défaut à sa place.

## 6. Ce que XAMOTO n'est pas

- Ce n'est pas un outil de diagnostic officiel de constructeur.
- Ce n'est pas un avis médical, juridique ou commercial sur un garage.
- Ce n'est pas une IA qui « sait tout » : c'est une base documentaire attribuée, un
  moteur de règles explicite, et une IA sous contrôle.
- Ce n'est pas un substitut à un professionnel — c'est de quoi arriver chez lui en
  comprenant ce qui se passe.

## 7. Où lire la suite

| Document | Contenu |
| --- | --- |
| [01-architecture.md](01-architecture.md) | Couches, dépendances, flux de données |
| [02-moteur-diagnostic.md](02-moteur-diagnostic.md) | Règles, pondérations, certitude, sécurité |
| [03-obd.md](03-obd.md) | Protocoles, adaptateurs, simulateur |
| [04-ia-anti-hallucination.md](04-ia-anti-hallucination.md) | Périmètre de l'IA, RAG, contrôle des réponses |
| [05-base-de-donnees.md](05-base-de-donnees.md) | Schéma, migrations, origine des données |
| [06-securite.md](06-securite.md) | Authentification, permissions, consentement, RGPD |
| [07-api.md](07-api.md) | Surface HTTP complète |
| [08-phases.md](08-phases.md) | MVP (§42), V2, V3 et méthode de travail |
| [09-tests.md](09-tests.md) | Tests de bout en bout, vérifications d'interface |
| [10-afrique.md](10-afrique.md) | Contexte d'usage, contraintes matérielles |
