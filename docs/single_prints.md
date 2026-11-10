# Single prints · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, elle dépend des profils TPO que Turning Trade cuit et des barres chargées sur le graphe. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Les zones de single prints des séances closes, reportées sur le graphe en bougies ou en footprint, avec cinq niveaux par zone : 0, 25, 50, 75 et 100 %. Chaque trait court jusqu'à la première mèche qui le touche, puis s'arrête. On voit ce qui reste à combler d'une zone, et jusqu'où le prix y est déjà rentré.

## Un peu de maths

Un profil TPO découpe la séance en périodes (30 minutes pour le profil RTH, 60 pour la séance complète) et note, pour chaque rangée de prix, les périodes qui y ont traité. Une rangée à une seule lettre n'a été traversée qu'une fois. Une zone de single prints est une suite de rangées voisines à une seule lettre, bordée des deux côtés par une rangée plus fournie : les extrêmes du profil (tails) n'en font pas partie. C'est la définition du Market Profile de Turning Trade, et l'étude lit les mêmes profils cuits : les zones sont identiques.

La zone va du tick le plus bas de sa rangée basse au tick le plus haut de sa rangée haute. Le 0 % est le **bord d'entrée** : celui que le prix rencontre en premier en revenant vers la zone, donc le bord haut si la séance a clôturé au-dessus de la zone, le bord bas sinon. Les autres niveaux s'enfoncent dans la zone, à 25, 50, 75 et 100 % de sa hauteur, arrondis au tick. Un niveau est pris par la première barre, après la clôture de la séance, dont le plus bas et le plus haut l'encadrent.

## À quoi ça sert

Une zone de single prints marque un passage rapide, sans échange dans les deux sens : l'enchère y est restée ouverte. Le marché y revient souvent, et la façon dont il la traite renseigne : rejet dès le bord, comblement à moitié puis retournement, traversée complète.

Ce que ça change pour la décision : des repères précis pour graduer un retour dans la zone. Un 0 % touché et un 25 % vierge disent que le bord a tenu ; un 50 % pris dit que la zone se comble ; un 100 % pris dit qu'elle n'existe plus comme référence. Aucun de ces niveaux ne prédit la réaction du prix.

## Lire le graphe

- **Cinq traits par zone**, de la barre qui a laissé le print jusqu'à la bougie qui prend le niveau. Un niveau encore vierge file jusqu'au bord droit.
- **Étiquette** au bout du trait : `SP 50 %  7431.25`. Quand deux niveaux sont trop proches à l'écran, seul le premier est étiqueté.
- **Une zone n'apparaît qu'à la clôture de sa séance** (16:00 ET en RTH), une fois que Turning Trade a recuit son profil, ce qui peut prendre un quart d'heure. La légende en haut à gauche dit alors quelle séance est attendue.
- **Niveau absent** : il était encore vierge quand le graphe a un trou de données (barre de comblement, jour manquant, séance coupée ou entamée en retard, plus de dix minutes sans barre). Il a pu être pris dans le trou, donc il n'est pas tracé.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Profil TPO | RTH (09:30-16:00 ET) ou séance complète (18:00-17:00 ET) | RTH |
| Hauteur minimale (ticks) | Écarte les zones plus fines ; une rangée fait 5 ticks sur ES, 25 sur NQ | 10 |
| Niveau 0 % (bord d'entrée) | Affiche le trait du bord d'entrée | cochée |
| Niveau 25 %, 50 %, 75 % | Affiche chaque niveau intermédiaire | cochées |
| Niveau 100 % (bord opposé) | Affiche le bord opposé : zone comblée quand il est pris | cochée |
| Masquer les niveaux pris | Ne garde que les niveaux encore vierges | décochée |
| Couleur, Style, Épaisseur, Opacité | Aspect des traits et des étiquettes | jaune, plein, 1, 0,85 |
| Étiquettes | Écrit le pourcentage et le prix au bout du trait | cochée |
| Notification quand un niveau est pris | Une notification par barre pour les niveaux affichés qu'elle prend ; l'historique ne sonne pas | décochée |
| Légende | Écrit en haut à gauche pourquoi rien n'est tracé, ou la séance attendue | cochée |

### Limites connues

- Seules les séances dont la fin est chargée sur le graphe sont tracées : un graphe en ticks n'en porte que quelques-unes. La séance en cours n'a pas de zones.
- Sur un graphe RTH, les prises de la nuit ne se voient pas : un niveau touché hors RTH reste tracé comme vierge. Le profil de séance complète demande un graphe ETH.
- Unités de temps jusqu'à 60 minutes ; au-delà, une barre chevauche la clôture et rien n'est tracé.
- Si le prix passe de l'autre côté d'une zone sans la toucher (gap), le 0 % reste au bord d'origine.
- Heures des futures du CME (ES, NQ). Sans profil cuit par Turning Trade pour l'instrument, l'étude n'affiche que sa légende.

---

# Single prints · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, it depends on the TPO profiles Turning Trade bakes and on the bars loaded on the chart. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

The single print zones of closed sessions, carried onto the candlestick or footprint chart, with five levels per zone: 0, 25, 50, 75 and 100%. Each line runs to the first wick that touches it, then stops. You see what is left of a zone to fill, and how far price has already gone back into it.

## A bit of math

A TPO profile splits the session into periods (30 minutes for the RTH profile, 60 for the full session) and records, for each price row, the periods that traded there. A row with a single letter was crossed only once. A single print zone is a run of neighbouring single-letter rows with a fuller row on both sides: the extremes of the profile (tails) are not part of it. This is the definition of Turning Trade's Market Profile, and the study reads the same baked profiles: the zones are identical.

The zone spans from the lowest tick of its bottom row to the highest tick of its top row. 0% is the **entry edge**: the one price meets first when coming back to the zone, so the upper edge if the session closed above the zone, the lower edge otherwise. The other levels go deeper into the zone, at 25, 50, 75 and 100% of its height, rounded to the tick. A level is taken by the first bar, after the session close, whose low and high bracket it.

## What it is for

A single print zone marks a fast move with no two-way trade: the auction was left open there. The market often comes back, and how it deals with the zone is informative: rejection at the edge, a half fill then a reversal, a full crossing.

What it changes for the decision: precise marks to grade a return into the zone. A touched 0% and an untouched 25% say the edge held; a taken 50% says the zone is filling; a taken 100% says it is gone as a reference. None of these levels predicts how price will react.

## Reading the chart

- **Five lines per zone**, from the bar that left the print to the candle that takes the level. A level still untouched runs to the right edge.
- **Label** at the end of the line: `SP 50 %  7431.25`. When two levels are too close on screen, only the first one is labelled.
- **A zone only appears at its session close** (16:00 ET for RTH), once Turning Trade has baked its profile again, which can take a quarter of an hour. The legend at the top left then names the session it is waiting for.
- **Missing level**: it was still untouched when the chart has a data gap (filler bar, missing day, session cut short or started late, more than ten minutes without a bar). It may have been taken inside the gap, so it is not drawn.

## Settings

| Setting | Role | Default |
|---|---|---|
| TPO profile | RTH (09:30-16:00 ET) or full session (18:00-17:00 ET) | RTH |
| Minimum height (ticks) | Drops thinner zones; one row is 5 ticks on ES, 25 on NQ | 10 |
| 0% level (entry edge) | Shows the entry edge line | checked |
| 25%, 50%, 75% level | Shows each intermediate level | checked |
| 100% level (far edge) | Shows the far edge: the zone is filled once it is taken | checked |
| Hide taken levels | Keeps only the levels still untouched | unchecked |
| Color, Style, Thickness, Opacity | Look of the lines and labels | yellow, solid, 1, 0.85 |
| Labels | Writes the percentage and price at the end of the line | checked |
| Notification when a level is taken | One notification per bar for the displayed levels it takes; history stays silent | unchecked |
| Legend | Writes at the top left why nothing is drawn, or the session awaited | checked |

### Known limits

- Only sessions whose end is loaded on the chart are drawn: a tick chart holds just a few. The session in progress has no zones.
- On an RTH chart, overnight touches cannot be seen: a level touched outside RTH stays drawn as untouched. The full-session profile needs an ETH chart.
- Timeframes up to 60 minutes; beyond that a bar straddles the close and nothing is drawn.
- If price jumps to the other side of a zone without touching it (gap), 0% stays at the original edge.
- CME futures hours (ES, NQ). Without a profile baked by Turning Trade for the instrument, the study only shows its legend.
