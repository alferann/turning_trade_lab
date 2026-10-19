# POC par barre · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des niveaux enregistrés pour chaque barre. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Sur un graphe en bougies, un trait horizontal sur chaque bougie, au prix le plus échangé de la barre (son POC), de la largeur exacte du corps. Un trait donne le niveau au tick près, là où un point le laisse deviner.

## Un peu de maths

Chaque barre porte ses niveaux : pour chaque prix, le volume pris au bid et le volume pris à l'ask. Le POC est le prix où bid + ask est le plus fort. En cas d'égalité entre plusieurs prix, c'est le plus bas qui est retenu, comme pour le POC du profil de séance de TT. Le delta de la barre est la somme des ask − bid de ses niveaux.

## À quoi ça sert

Le POC d'une barre dit où le marché a vraiment travaillé pendant la barre, ce que l'ouverture et la clôture ne disent pas. Un POC collé au haut d'une bougie haussière montre un volume pris en haut de mouvement, un POC au bas d'une mèche montre où l'offre ou la demande s'est concentrée. Plusieurs POC alignés au même prix sur des barres voisines dessinent un niveau accepté ; des POC qui montent ou descendent barre après barre accompagnent une tendance.

Ce que ça change pour la décision : un repère de prix précis par barre, pour situer les entrées et les stops par rapport au volume plutôt qu'aux seules mèches. Un POC ne vaut que par la façon dont le prix y réagit ensuite.

## Lire le graphe

- **Un trait par bougie**, de la largeur du corps, au prix du POC.
- **Une couleur** par défaut ; avec « Teinter selon le delta », la couleur acheteur quand le delta de la barre est positif ou nul, la couleur vendeur quand il est négatif.
- **Pas de trait** sur une barre sans niveaux (trou de données, source sans footprint).

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Couleur | Couleur des traits sans teinte | jaune |
| Épaisseur | Épaisseur du trait, de 1 à 6 px | 2 |
| Teinter selon le delta | Remplace la couleur unique par les deux couleurs ci-dessous | décochée |
| Delta acheteur | Couleur des barres à delta positif ou nul | vert |
| Delta vendeur | Couleur des barres à delta négatif | rose |

### Limites connues

- Graphes en bougies seulement : le footprint affiche déjà ses niveaux.
- Une barre dont les niveaux manquent n'a pas de POC ; l'étude ne l'invente pas à partir de l'OHLC.
- Au zoom arrière, le corps tombe à 1,2 px et le trait avec : les POC se lisent mieux en zoomant.
- Si TT change la largeur de ses corps de bougie (62 % de la colonne aujourd'hui), le trait ne la suivra plus exactement.

---

# Bar POC · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the levels recorded for each bar. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

On a candlestick chart, a horizontal line across each candle at the bar's most traded price (its POC), exactly as wide as the body. A line gives the level to the tick, where a dot leaves it to guesswork.

## A bit of math

Each bar carries its levels: for each price, the volume traded at the bid and at the ask. The POC is the price with the highest bid + ask. When several prices tie, the lowest one wins, as for TT's session profile POC. The bar's delta is the sum of ask − bid over its levels.

## What it is for

A bar's POC tells where the market actually did business during the bar, which the open and close do not. A POC pinned to the top of a bullish candle shows volume taken at the top of the move; a POC at the bottom of a wick shows where supply or demand concentrated. Several POCs lined up at the same price on neighbouring bars mark an accepted level; POCs stepping up or down bar after bar go with a trend.

What it changes for the decision: a precise price reference per bar, to place entries and stops against volume rather than wicks alone. A POC is only worth how price reacts to it afterwards.

## Reading the chart

- **One line per candle**, as wide as the body, at the POC price.
- **One colour** by default; with "Tint by delta", the buyer colour when the bar's delta is positive or zero, the seller colour when it is negative.
- **No line** on a bar without levels (data gap, source without footprint).

## Settings

| Setting | Role | Default |
|---|---|---|
| Color | Line colour without tint | yellow |
| Thickness | Line thickness, 1 to 6 px | 2 |
| Tint by delta | Replaces the single colour with the two colours below | unchecked |
| Buyer delta | Colour of bars with a positive or zero delta | green |
| Seller delta | Colour of bars with a negative delta | pink |

### Known limits

- Candlestick charts only: the footprint already shows its levels.
- A bar whose levels are missing has no POC; the study does not make one up from OHLC.
- Zoomed out, the body shrinks to 1.2 px and the line with it: POCs read better zoomed in.
- If TT changes its candle body width (62 % of the column today), the line will no longer match it exactly.
