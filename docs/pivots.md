# Points pivots · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des barres chargées dans le graphe. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Les points pivots journaliers, hebdomadaires et mensuels, chacun allumé ou éteint par sa case à cocher et tracé dans sa couleur. Chaque période porte les pivots tirés de la période précédente, tracés en marches sur ses propres barres : on relit l'historique comme il se présentait en séance. Cinq formules au choix : classique, Fibonacci, Camarilla, Woodie, DeMark.

## Un peu de maths

H, L, C et O sont le haut, le bas, la clôture et l'ouverture de la période précédente : la séance de la veille, la semaine ISO précédente (lundi à vendredi) ou le mois civil précédent.

| Formule | PP | Résistances et supports |
|---|---|---|
| Classique | (H + L + C) / 3 | R1 = 2 PP − L, S1 = 2 PP − H ; R2/S2 = PP ± (H − L) ; R3 = H + 2 (PP − L), S3 = L − 2 (H − PP) |
| Fibonacci | (H + L + C) / 3 | R/S = PP ± 0,382, 0,618 et 1 × (H − L) |
| Camarilla | (H + L + C) / 3, en repère | R/S = C ± 1,1 × (H − L) / 12, / 6 et / 4 |
| Woodie | (H + L + 2 C) / 4 | comme la classique, avec ce PP |
| DeMark | X / 4 | X = H + 2L + C si C < O, 2H + L + C si C > O, H + L + 2C sinon ; R1 = X/2 − L, S1 = X/2 − H, pas de R2, R3 |

Sur un graphe ETH, la séance va de 18:00 à 17:00 New York. La case « Calcul sur RTH seul » ne lit que les barres de 09:30 à 16:00, pour des pivots tirés du marché régulier.

## À quoi ça sert

Les pivots sont des niveaux de référence calculés de la même façon par beaucoup d'intervenants, ce qui leur donne une part de réalisation automatique. Le PP sert de point d'équilibre : un prix qui s'installe au-dessus penche à l'achat, en dessous à la vente. R1 et S1 sont les premières zones de réaction ou cibles, R2/S2 et R3/S3 ne sont atteints que les jours de tendance. Un pivot journalier qui tombe sur un pivot hebdomadaire ou mensuel pèse plus lourd qu'un niveau isolé. La Camarilla, resserrée autour de la clôture, se lit plutôt en retour à la moyenne.

Ce que ça change pour la décision : des niveaux connus d'avance pour placer cibles, stops et zones d'attente, et un repère simple du camp qui contrôle la séance. Un niveau ne vaut que par la réaction du prix quand il l'atteint.

## Lire le graphe

- **Segments horizontaux**, un par niveau et par période, sur les barres de la période. La période en cours se prolonge jusqu'au bord droit.
- **PP plus épais** que les résistances et supports, tous dans la couleur et l'opacité de la période, étiquettes comprises.
- **Étiquettes** au début de chaque segment : `PP`, `R1`… pour le journalier, `wPP`, `wR1`… pour l'hebdomadaire, `mPP`, `mR1`… pour le mensuel.
- Le mensuel se dessine sous l'hebdomadaire, lui-même sous le journalier.

## Configurer

Les réglages généraux, puis une sous-section par période ouverte par sa case à cocher, suivie d'un filet.

| Réglage | Rôle | Défaut |
|---|---|---|
| Formule | Classique, Fibonacci, Camarilla, Woodie, DeMark | classique |
| Calcul sur RTH seul (graphe ETH) | H, L, C et O de la période précédente lus sur 09:30–16:00 New York seulement | décochée |
| Étiquettes | Noms des niveaux au début des segments | cochée |
| **Pivots journaliers** | Case à cocher : affiche ou masque les pivots de la séance | cochée |
| Couleur | Couleur des pivots journaliers | bleu |
| Opacité | Opacité des traits et étiquettes des pivots journaliers, de 0,05 à 1 | 1 |
| **Pivots hebdomadaires** | Case à cocher : affiche ou masque les pivots de la semaine | cochée |
| Couleur | Couleur des pivots hebdomadaires | orange |
| Opacité | Opacité des traits et étiquettes des pivots hebdomadaires, de 0,05 à 1 | 1 |
| **Pivots mensuels** | Case à cocher : affiche ou masque les pivots du mois | cochée |
| Couleur | Couleur des pivots mensuels | rose |
| Opacité | Opacité des traits et étiquettes des pivots mensuels, de 0,05 à 1 | 1 |

### Limites connues

- **Période précédente incomplète, pivots masqués.** Une semaine ou un mois ne donne de pivots à la suivante que s'il est chargé en entier : une séance pour chacun de ses jours ouvrés, du premier au dernier. L'historique ES de TT commençant le mardi 22 septembre 2026, il n'y a pas de pivots hebdomadaires pour la semaine du 28 septembre, ni de pivots mensuels en octobre. Ils apparaîtront dès que le graphe chargera le mois précédent en entier.
- **Veille incomplète ou manquante, pivots masqués.** Les pivots d'une séance ne sont tracés que si la séance précédente est celle du jour ouvré d'avant et qu'elle est chargée de sa première heure jusqu'à moins de 4 h de sa fin (une clôture anticipée de jour férié passe ; avec « Calcul sur RTH seul », c'est la fenêtre 09:30–16:00 qui doit être couverte). Cela arrive avec un historique qui commence en pleine séance, sur un graphe en ticks dont l'historique se charge encore, ou quand un jour manque entre deux séances chargées (journée absente de l'historique, que TT la comble par un blanc ou non) : les pivots apparaissent dès que la veille est là et complète. Une semaine ou un mois qui contient une séance incomplète ou un jour manquant ne donne pas non plus de pivots à la période suivante.
- Les jours fériés ne sont pas connus et comptent comme des jours manquants : le lendemain d'une fermeture complète (Vendredi saint, Noël, Jour de l'an), les pivots journaliers sont masqués, et la semaine ou le mois qui la contient ne donne pas de pivots à la période suivante. Les fériés à clôture anticipée, qui ont leur séance, ne gênent pas.
- Le footprint ne date pas ses barres : seuls les pivots journaliers y sont tracés. Une veille manquante s'y reconnaît à la date de séance que TT attache à chaque barre du footprint ; une version de TT qui ne la poserait plus ferait prendre la dernière séance chargée pour la veille.
- Pas de R4/S4 en Camarilla, pas de points médians.

---

# Pivot Points · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the bars loaded in the chart. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

Daily, weekly and monthly pivot points, each turned on or off by its checkbox and drawn in its own colour. Each period carries the pivots derived from the previous period, drawn as steps over its own bars: history reads as it looked live. Five formulas to choose from: classic, Fibonacci, Camarilla, Woodie, DeMark.

## A bit of math

H, L, C and O are the high, low, close and open of the previous period: the previous session, the previous ISO week (Monday to Friday) or the previous calendar month.

| Formula | PP | Resistances and supports |
|---|---|---|
| Classic | (H + L + C) / 3 | R1 = 2 PP − L, S1 = 2 PP − H; R2/S2 = PP ± (H − L); R3 = H + 2 (PP − L), S3 = L − 2 (H − PP) |
| Fibonacci | (H + L + C) / 3 | R/S = PP ± 0.382, 0.618 and 1 × (H − L) |
| Camarilla | (H + L + C) / 3, as a reference | R/S = C ± 1.1 × (H − L) / 12, / 6 and / 4 |
| Woodie | (H + L + 2 C) / 4 | as classic, with this PP |
| DeMark | X / 4 | X = H + 2L + C if C < O, 2H + L + C if C > O, H + L + 2C otherwise; R1 = X/2 − L, S1 = X/2 − H, no R2, R3 |

On an ETH chart, the session runs from 18:00 to 17:00 New York. The "Computed on RTH only" box reads only the 09:30 to 16:00 bars, for pivots derived from the regular market.

## What it is for

Pivots are reference levels computed the same way by many participants, which makes them partly self-fulfilling. The PP is a balance point: price settling above it leans long, below it leans short. R1 and S1 are the first reaction zones or targets; R2/S2 and R3/S3 are only reached on trend days. A daily pivot sitting on a weekly or monthly one weighs more than an isolated level. Camarilla, tight around the close, reads rather as mean reversion.

What it changes for the decision: levels known in advance to place targets, stops and waiting zones, and a simple read of which side controls the session. A level is only worth the price reaction when it gets there.

## Reading the chart

- **Horizontal segments**, one per level and period, over the period's bars. The current period extends to the right edge.
- **PP thicker** than resistances and supports, all in the period's colour and opacity, labels included.
- **Labels** at the start of each segment: `PP`, `R1`… for daily, `wPP`, `wR1`… for weekly, `mPP`, `mR1`… for monthly.
- Monthly is drawn under weekly, itself under daily.

## Settings

General settings, then one sub-section per period opened by its checkbox, followed by a rule. Labels below are those shown when Turning Trade is set to English.

| Setting | Role | Default |
|---|---|---|
| Formula | Classic, Fibonacci, Camarilla, Woodie, DeMark | classic |
| Computed on RTH only (ETH chart) | H, L, C and O of the previous period read on 09:30–16:00 New York only | unchecked |
| Labels | Level names at the start of segments | checked |
| **Daily pivots** | Checkbox: shows or hides the session pivots | checked |
| Color | Colour of the daily pivots | blue |
| Opacity | Opacity of the daily pivots lines and labels, from 0.05 to 1 | 1 |
| **Weekly pivots** | Checkbox: shows or hides the week pivots | checked |
| Color | Colour of the weekly pivots | orange |
| Opacity | Opacity of the weekly pivots lines and labels, from 0.05 to 1 | 1 |
| **Monthly pivots** | Checkbox: shows or hides the month pivots | checked |
| Color | Colour of the monthly pivots | pink |
| Opacity | Opacity of the monthly pivots lines and labels, from 0.05 to 1 | 1 |

### Known limits

- **Incomplete previous period, pivots hidden.** A week or month only gives pivots to the next one if it is fully loaded: one session for each of its weekdays, from the first to the last. TT's ES history starting on Tuesday 22 September 2026, there are no weekly pivots for the week of 28 September and no monthly pivots in October. They will show as soon as the chart loads the whole previous month.
- **Incomplete or missing previous session, pivots hidden.** A session's pivots are drawn only if the previous session is the previous weekday's and is loaded from its first hour to less than 4 h before its end (an early holiday close still counts; with "Computed on RTH only", the 09:30–16:00 window must be covered). This happens with a history starting mid-session, on a tick chart whose history is still loading, or when a day is missing between two loaded sessions (a day absent from the history, whether TT fills it with a blank or not): the pivots show as soon as the previous session is there and complete. A week or month holding an incomplete session or a missing day gives no pivots to the next period either.
- Holidays are not known and count as missing days: the day after a full closure (Good Friday, Christmas, New Year's Day), daily pivots are hidden, and the week or month holding it gives no pivots to the next period. Holidays with an early close, which have their session, do no harm.
- The footprint does not date its bars: only daily pivots are drawn there. A missing previous session is recognised there by the session date TT attaches to each footprint bar; a TT version that no longer set it would make the last loaded session stand in for the previous one.
- No Camarilla R4/S4, no midpoints.
