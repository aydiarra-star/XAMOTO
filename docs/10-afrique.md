# Contexte d'usage : Afrique de l'Ouest (§39)

> **Règle absolue** : le contexte est un **contexte**. Il n'est jamais une cause de
> panne. XAMOTO ne dira jamais « c'est normal dans ce pays ».

## 1. À qui le produit s'adresse

- Un particulier qui possède une voiture d'occasion et n'a pas de valise constructeur.
- Un artisan, un chauffeur de taxi ou de VTC qui ne peut pas immobiliser son véhicule
  sans raison.
- Un garage indépendant qui veut un compte rendu lisible et opposable, sans matériel
  propriétaire.
- Un acheteur qui veut savoir, avant d'acheter, ce que les données du véhicule
  racontent.

## 2. Contraintes matérielles prises en compte

| Contrainte | Réponse dans le produit |
| --- | --- |
| Téléphones d'entrée de gamme | Interface légère (aucune bibliothèque graphique lourde), un seul fichier JS d'environ 280 ko avant compression |
| Écran lu en plein soleil | Contraste élevé, thème sombre, typographie large |
| Connexion instable ou coûteuse | **Hors ligne d'abord** : la coquille de l'application est mise en cache, aucune réponse d'API n'est mise en cache ; synchronisation idempotente par lots |
| Adaptateurs OBD répandus | Priorité à l'ELM327 **Wi-Fi** (utilisable depuis un navigateur) ; Bluetooth prévu pour l'application mobile |
| Peu d'outils d'atelier | Tests guidés réalisables avec un multimètre, une lampe témoin, ou par simple observation |
| Vocabulaire technique | Explication en langage simple à chaque écran, avec le terme technique en second |

## 3. Ce qui n'est PAS une cause de panne

Ces éléments peuvent **ajuster un intervalle d'entretien** lorsqu'ils sont déclarés par
l'utilisateur, mais ils ne sont jamais utilisés pour expliquer un défaut :

- chaleur élevée → intervalles de liquide de refroidissement et de batterie réduits ;
- poussière → filtres à air rapprochés ;
- trajets courts répétés → entretien plus fréquent ;
- trafic urbain dense → vidanges rapprochées.

Le facteur d'usage est affiché, avec son effet : l'utilisateur voit pourquoi une
échéance avance. Aucune conclusion de diagnostic ne s'appuie dessus.

## 4. Carburant, pièces et contrefaçons

XAMOTO ne présume jamais qu'une pièce est de mauvaise qualité ni qu'un carburant est
frelaté. Il fournit, quand cela est utile :

- les **références** et **équivalents** d'une pièce (`/api/parts`) ;
- un **prix indicatif** en FCFA, présenté comme une information, jamais comme un devis ;
- des **questions à poser** au vendeur ou au garage (référence, garantie, provenance) ;
- la distinction entre « pièce d'origine », « équivalent » et « occasion ».

C'est à l'utilisateur de décider, avec des faits.

## 5. Garages et confiance

L'annuaire (`/api/garages`) est fondé sur des **faits déclarés** : ville, téléphone,
spécialités, équipement, marques traitées, disponibilité pour recevoir un diagnostic
XAMOTO. Aucune note « qualité » n'est produite par XAMOTO, et le second avis ne juge
jamais un garage : il liste ce que les données confirment, ce qu'elles ne confirment
pas, et les questions à poser.

## 6. Langues

| Langue | État |
| --- | --- |
| **Français** | Langue principale, tous les écrans |
| **Anglais** | Interface complète (bascule dans la barre latérale), contenus du moteur |
| **Wolof** | Repères sur les messages essentiels : niveaux de certitude, niveaux de sécurité, verdicts de tests |

Le wolof n'est **jamais** produit par traduction automatique : seules des formulations
relues sont affichées, pour éviter qu'un message de sécurité soit mal compris.

## 7. Modèle économique compatible

- L'application reste utilisable **sans abonnement** : scan, codes défaut, « puis-je
  rouler ? », entretien de base.
- Les fonctions avancées (rapport illimité, inspection avant achat, second avis,
  partage garage, flotte) relèvent du plan premium ou d'un partenaire.
- Aucune donnée de diagnostic n'est vendue. Le compte de démonstration est ouvert :
  un utilisateur peut tout essayer avant de décider.

## 8. Ce que le contexte ne justifiera jamais

- Accepter un défaut critique parce que « les routes sont mauvaises ».
- Remplacer une pièce sans test parce que « c'est souvent ça ici ».
- Omettre une donnée manquante parce qu'« on n'a pas l'habitude de la mesurer ».
- Présenter une estimation comme une mesure.
