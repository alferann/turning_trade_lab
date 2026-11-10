# Ligne à distance du prix · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, elle ne lit que les bougies affichées à l'écran. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Un trait horizontal posé à une distance fixe du dernier prix, au-dessus, en dessous ou les deux. Il part du bord droit du graphe et file vers la gauche jusqu'à la bougie la plus récente qui le touche, mèche comprise. On voit d'un coup d'œil où tombe « prix + 20 ticks » et quand le marché y est passé pour la dernière fois.

## Un peu de maths

Niveau = dernier prix ± distance, le dernier prix étant la clôture de la barre en cours. La distance se compte en ticks (multipliée par le tick de l'instrument) ou en points (1 point = 1,00 de prix) ; le résultat est calé sur la grille des ticks. Une bougie touche le niveau quand il est compris entre son plus bas et son plus haut, bornes incluses. La recherche part de la bougie en cours, qui compte, et remonte les bougies visibles une à une.

## À quoi ça sert

Situer une distance dans la structure avant d'agir : un stop à 12 ticks tombe-t-il derrière une mèche récente ou au milieu de rien ? Une cible à 30 ticks a-t-elle été traitée il y a trois bougies ou pas de toute la matinée ? Un trait court dit que le niveau vient d'être travaillé ; un trait qui traverse tout l'écran dit qu'il n'a pas été touché sur ce que le graphe montre.

Ce que ça change pour la décision : la distance n'est plus un nombre abstrait, elle se lit contre les mèches. Le trait ne dit rien de ce que le prix fera en y arrivant.

## Lire le graphe

- **Un trait par côté**, du bord droit jusqu'au centre de la bougie de contact. Il suit le prix à chaque tick.
- **Trait très court** : la bougie en cours a déjà touché le niveau.
- **Trait jusqu'au bord gauche** : aucune bougie visible ne touche le niveau. Dézoomer ou faire défiler pour chercher plus loin.
- **Étiquette** au bout droit : le prix du niveau puis la distance, par exemple `7612.50  +20 t` (`t` ticks, `pt` points). Elle reste écrite même sans contact.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Unité | Distances en ticks ou en points | ticks |
| Au-dessus du prix | Affiche le trait du dessus | cochée |
| Distance au-dessus | Écart du trait du dessus au dernier prix | 20 |
| Couleur au-dessus | Couleur du trait et de l'étiquette du dessus | vert |
| En dessous du prix | Affiche le trait du dessous | cochée |
| Distance en dessous | Écart du trait du dessous au dernier prix | 20 |
| Couleur en dessous | Couleur du trait et de l'étiquette du dessous | rose |
| Style | Plein, tirets ou pointillés | tirets |
| Épaisseur | Épaisseur du trait, de 0,5 à 4 px | 1 |
| Opacité | Opacité du trait et de l'étiquette | 0,85 |
| Étiquette | Écrit le prix et la distance au bout droit | cochée |

### Limites connues

- Seules les bougies à l'écran sont lues : un contact plus ancien, hors cadre à gauche, n'arrête pas le trait. Des bougies cachées à droite du cadre ne comptent pas non plus.
- Les barres de comblement d'un trou de données ne comptent pas comme contact.
- Le trait s'arrête au centre de la bougie, qu'il touche le corps ou la mèche.
- Un niveau hors de l'échelle de prix affichée n'est pas tracé.
- Une seule distance par côté ; pas de notification.

---

# Price Offset Line · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, and it only reads the candles shown on screen. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

A horizontal line set at a fixed distance from the last price, above, below or both. It starts at the right edge of the chart and runs left to the most recent candle that touches it, wick included. You see at a glance where "price + 20 ticks" lands and when the market last traded there.

## A bit of math

Level = last price ± distance, the last price being the close of the current bar. The distance is counted in ticks (times the instrument's tick) or in points (1 point = 1.00 of price); the result is snapped to the tick grid. A candle touches the level when it lies between its low and its high, bounds included. The search starts at the current candle, which counts, and walks back through the visible candles one by one.

## What it is for

Placing a distance within the structure before acting: does a 12-tick stop sit behind a recent wick or in the middle of nowhere? Was a 30-tick target traded three candles ago or not all morning? A short line says the level has just been worked; a line crossing the whole screen says it has not been touched on what the chart shows.

What it changes for the decision: the distance is no longer an abstract number, it reads against the wicks. The line says nothing about what price will do when it gets there.

## Reading the chart

- **One line per side**, from the right edge to the centre of the touching candle. It follows price on every tick.
- **Very short line**: the current candle has already touched the level.
- **Line to the left edge**: no visible candle touches the level. Zoom out or scroll to look further back.
- **Label** at the right end: the level's price then the distance, for example `7612.50  +20 t` (`t` ticks, `pt` points). It stays written even without a touch.

## Settings

| Setting | Role | Default |
|---|---|---|
| Unit | Distances in ticks or in points | ticks |
| Above price | Shows the upper line | checked |
| Distance above | Offset of the upper line from the last price | 20 |
| Color above | Colour of the upper line and label | green |
| Below price | Shows the lower line | checked |
| Distance below | Offset of the lower line from the last price | 20 |
| Color below | Colour of the lower line and label | pink |
| Style | Solid, dashed or dotted | dashed |
| Thickness | Line thickness, 0.5 to 4 px | 1 |
| Opacity | Opacity of the line and label | 0.85 |
| Label | Writes the price and distance at the right end | checked |

### Known limits

- Only candles on screen are read: an older touch, off the frame to the left, does not stop the line. Candles hidden right of the frame do not count either.
- Filler bars of a data gap do not count as a touch.
- The line stops at the candle's centre, whether it touches the body or the wick.
- A level outside the displayed price scale is not drawn.
- One distance per side; no notification.
