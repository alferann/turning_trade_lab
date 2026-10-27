# Hauts et bas des sessions précédentes · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des barres chargées dans le graphe. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le haut et le bas de la dernière session close de Tokyo, Londres, New York et de la clôture, prolongés vers la droite jusqu'à ce que le prix vienne les chercher. Les sessions sont celles du panneau Sessions du monde de Turning Trade, avec leurs bornes, leurs noms et leurs couleurs. Turning Trade trace déjà le haut et le bas de chaque session sur sa propre bande (menu Sessions du monde, « Hauts et bas de session ») ; l'étude prend le relais une fois la session finie.

## Un peu de maths

Une session court de son heure d'ouverture jusqu'à l'ouverture de la session active suivante : par défaut, Tokyo de 18:00 New York à 08:00 Londres, Londres jusqu'à 09:30 New York, New York jusqu'à 16:00 et la clôture jusqu'à 18:00. Les heures de Londres sont converties à la date de chaque séance, changements d'heure compris (Londres ouvre à 04:00 New York la semaine où l'Europe est déjà à l'heure d'hiver et pas encore New York).

Une barre appartient à la session qui contient son milieu, comme sur les bandes de Turning Trade. Le haut est le plus haut des barres de la session et le bas le plus bas. Le trait part de la barre qui a fait l'extrême.

Deux façons de dire qu'un niveau est pris :

- **mèche qui touche** : la première barre dont le haut atteint le haut de session (ou dont le bas atteint le bas), égalité comprise ;
- **clôture au-delà** : la première barre close dont la clôture passe strictement au-dessus du haut (ou au-dessous du bas). La barre en cours ne compte pas tant qu'elle n'est pas close.

## À quoi ça sert

Les extrêmes des sessions précédentes sont des niveaux que tout le monde voit : des stops s'y accumulent juste au-delà, et des ordres attendent de les jouer. Un niveau encore vierge est une liquidité qui n'a pas été prise et qui attire souvent le prix ; un niveau pris à la mèche puis rejeté signale un balayage de stops et un possible retour ; un niveau franchi en clôture signale plutôt une acceptation au-delà et une continuation. Le bas de Tokyo et le haut de Londres pris pendant New York sont des lectures classiques.

Ce que ça change pour la décision : des cibles et des zones de réaction connues d'avance, et une lecture de la façon dont le prix les traite, rejet à la mèche ou acceptation en clôture. Un niveau ne vaut que par la réaction du prix quand il l'atteint.

## Lire le graphe

- **Un trait par niveau**, dans la couleur de sa session dans Turning Trade, depuis la barre de l'extrême jusqu'à la barre qui l'a pris, ou jusqu'au bord droit s'il est encore vierge (ou avec le réglage « Bord droit »).
- **Étiquettes** au bout du trait : `Tokyo H`, `Londres L`… (`H` pour le haut au-dessus du trait, `L` pour le bas au-dessous).
- Seule la dernière occurrence close de chaque session est tracée : pendant la séance de New York, le New York tracé est celui de la veille. La session en cours ne compte qu'une fois close, à l'arrivée de la première barre de la suivante.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Prolonger jusqu'à | Première mèche qui touche, première clôture au-delà, ou bord droit dans tous les cas | première mèche |
| Notification | Aucune, au premier toucher de la mèche, ou à la première clôture au-delà. Une notification par niveau, l'historique ne sonne pas | aucune |
| Session de Tokyo, de Londres, de New York, de clôture | Affiche ou masque les niveaux de chaque session, et ses notifications | cochées |
| Style | Plein, tirets ou pointillés | tirets |
| Épaisseur | Épaisseur des traits, de 0,5 à 4 | 1 |
| Opacité | Opacité des traits et des étiquettes, de 0,05 à 1 | 0,85 |
| Étiquettes | Nom de la session et H ou L au bout des traits | cochée |

Les bornes, les noms et les couleurs se changent dans Turning Trade : menu du graphe, Sessions du monde. Une session éteinte là-bas disparaît aussi de l'étude, et la précédente court jusqu'à la suivante encore active.

### Limites connues

- **Une notification par graphe.** Chaque graphe qui porte l'étude avec les notifications allumées sonne de son côté : deux graphes ES, deux notifications.
- La session de la dernière barre n'est close qu'à l'arrivée d'une barre de la suivante : pendant la pause de 17:00 à 18:00, la clôture du jour reste en cours et l'étude montre encore celle de la veille.
- Le footprint ne charge pas le module des sessions de Turning Trade ni ne date ses barres : il prend les bornes par défaut, avec les changements d'heure de la date du jour, et ne suit pas les réglages du panneau Sessions du monde.
- Sur les graphes en ticks, en volume ou en range, une barre appartient à la session de son début, faute de durée.
- Un graphe RTH ne contient que New York : seuls ses niveaux y sont tracés.
- Le premier calcul sur un long historique s'étale sur quelques images (4 ms par image) : les traits apparaissent une fraction de seconde après l'ouverture du graphe.

---

# Previous Session Highs and Lows · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the bars loaded in the chart. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

The high and low of the last closed Tokyo, London, New York and close session, extended to the right until price comes to take them. The sessions are those of Turning Trade's World sessions panel, with their bounds, names and colours. Turning Trade already draws each session's high and low over its own band (World sessions menu, "Session highs and lows"); the study takes over once the session is over.

## A bit of math

A session runs from its opening time until the opening of the next active session: by default, Tokyo from 18:00 New York to 08:00 London, London until 09:30 New York, New York until 16:00 and the close until 18:00. London hours are converted at each session's date, clock changes included (London opens at 04:00 New York in the week when Europe is already on winter time and New York is not yet).

A bar belongs to the session that holds its middle, as on Turning Trade's bands. The high is the highest of the session's bars, the low the lowest. The line starts at the bar that made the extreme.

Two ways to call a level taken:

- **wick that touches**: the first bar whose high reaches the session high (or whose low reaches the low), equality included;
- **close beyond**: the first closed bar whose close goes strictly above the high (or below the low). The current bar does not count until it closes.

## What it is for

Previous session extremes are levels everyone sees: stops pile up just beyond them, and orders wait to trade them. A level still untouched is liquidity not yet taken that often draws price; a level taken by a wick then rejected signals a stop sweep and a possible return; a level crossed on a close rather signals acceptance beyond and continuation. Tokyo's low and London's high taken during New York are classic reads.

What it changes for the decision: targets and reaction zones known in advance, and a read of how price treats them, rejection on the wick or acceptance on the close. A level is only worth the price reaction when it gets there.

## Reading the chart

- **One line per level**, in its session's colour in Turning Trade, from the bar of the extreme to the bar that took it, or to the right edge if it is still untouched (or with the "Right edge" setting).
- **Labels** at the end of the line: `Tokyo H`, `London L`… (`H` for the high, above the line, `L` for the low, below it).
- Only the last closed occurrence of each session is drawn: during the New York session, the New York shown is the previous day's. The current session only counts once closed, when the first bar of the next one arrives.

## Settings

Labels below are those shown when Turning Trade is set to English.

| Setting | Role | Default |
|---|---|---|
| Extend until | First wick that touches, first close beyond, or the right edge in every case | first wick |
| Notification | None, on the first wick touch, or on the first close beyond. One notification per level, history never rings | none |
| Tokyo, London, New York, Close session | Shows or hides each session's levels, and its notifications | checked |
| Style | Solid, dashed or dotted | dashed |
| Thickness | Line thickness, from 0.5 to 4 | 1 |
| Opacity | Opacity of lines and labels, from 0.05 to 1 | 0.85 |
| Labels | Session name and H or L at the end of the lines | checked |

Bounds, names and colours are changed in Turning Trade: chart menu, World sessions. A session turned off there also disappears from the study, and the previous one runs until the next active one.

### Known limits

- **One notification per chart.** Each chart carrying the study with notifications on rings on its own: two ES charts, two notifications.
- The session of the last bar only closes when a bar of the next one arrives: during the 17:00 to 18:00 break, the day's close session is still in progress and the study still shows the previous day's.
- The footprint neither loads Turning Trade's session module nor dates its bars: it uses the default bounds, with today's clock changes, and does not follow the World sessions panel.
- On tick, volume or range charts, a bar belongs to the session of its start, having no duration.
- An RTH chart only holds New York: only its levels are drawn there.
- The first computation over a long history spreads over a few frames (4 ms per frame): the lines show a fraction of a second after the chart opens.
