# Profil de volume par période · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des barres chargées dans le graphe. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le profil de volume de la séance, de la semaine ou du mois en cours, dessiné en histogramme collé au bord droit du graphe en bougies ou du footprint. Le POC et les bornes de l'aire de valeur (VAH, VAL) sont prolongés depuis le début de la période. À la différence du composite « N séances » des panneaux VP de TT, qui glisse avec les séances, la période suit le calendrier : la semaine part du lundi, le mois du premier jour.

## Un peu de maths

Pour chaque prix p au tick près, V(p) est la somme, sur les barres de la période, du volume échangé à ce prix (bid + ask des niveaux de la barre). Le **POC** est le prix où V est maximal. L'**aire de valeur** part du POC et s'étend tick par tick du côté du voisin le plus fourni, jusqu'à contenir la part choisie du volume total (70 % par défaut) ; **VAL** et **VAH** en sont le bas et le haut. Les ex aequo se tranchent comme chez TT : le POC le plus bas, puis le côté haut d'abord. Sur les séances ES chargées, POC, VAH et VAL sont identiques à ceux du profil de séance (SVP) de TT, et le banc d'essai le vérifie.

La semaine est la semaine ISO (lundi à vendredi), le mois le mois civil ; les séances s'y rangent par leur date de séance. La période en cours est celle de la dernière barre du graphe, en direct comme en replay.

## À quoi ça sert

Le profil montre où le marché a accepté de traiter longtemps (rangées épaisses) et où il est passé vite (rangées minces). Le POC de la semaine ou du mois sert de juste valeur de l'échelle de temps supérieure et attire souvent le prix ; VAH et VAL bornent cette valeur. Un prix qui s'installe hors de l'aire de valeur cherche une nouvelle valeur ; un prix qui y rentre et s'y maintient signale un rejet de l'extérieur et vise souvent l'autre borne.

Ce que ça change pour la décision : savoir si la séance du jour se tient dans la valeur de la semaine ou du mois, ou si elle en sort, et placer cibles, stops et zones d'attente autour du POC et des bornes. Un niveau ne vaut que par la réaction du prix quand il l'atteint.

## Lire le graphe

- **Histogramme au bord droit** : une rangée par prix ou groupe de prix, longueur proportionnelle au volume, la rangée la plus fournie prend toute la largeur réglée.
- **Couleurs** : rangée du POC en orange, rangées de l'aire de valeur en bleu, le reste en gris (couleurs réglables).
- **Lignes** : POC en trait plein, VAH et VAL en pointillés, depuis la première barre de la période (ou le bord gauche si elle est hors écran) jusqu'au bord droit.
- **Étiquettes** POC, VAH et VAL à gauche de l'histogramme.
- **Légende** en haut à droite : la période (« Séance 2026-10-16 », « Semaine 42 », « Mois 2026-10 »), puis les mises en garde, affichées même étiquettes décochées : « partiel, depuis le … » quand le graphe ne charge pas la période depuis son début, « x % des barres sans niveaux » quand des barres n'ont pas de volume par prix.
- L'histogramme se pose par-dessus les dernières bougies : faites défiler le graphe vers la gauche pour lui laisser le bord droit.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Période | Jour (la séance), Semaine (ISO, depuis le lundi), Mois (civil) | Jour |
| Calcul sur RTH seul (graphe ETH) | Ne compte que les barres de 09:30 à 16:00 New York | décochée |
| Value Area % | Part du volume total contenue dans l'aire de valeur | 70 |
| Largeur (% du graphe) | Longueur de la rangée la plus fournie, en part de la largeur du graphe | 25 |
| Ticks par rangée (0 = auto) | Regroupe les prix par rangées ; 0 : au moins 3 pixels par rangée, les ticks se regroupent quand on dézoome | 0 |
| Opacité | Opacité de l'histogramme | 0,5 |
| Couleur du volume | Rangées hors aire de valeur | gris |
| Couleur Value Area | Rangées de l'aire de valeur, lignes VAH et VAL | bleu |
| Couleur POC | Rangée et ligne du POC | orange |
| POC, VAH et VAL prolongés | Lignes depuis le début de la période | cochée |
| Étiquettes | Noms des niveaux et légende | cochée |

### Limites connues

- **Une période à la fois, celle en cours.** Pas de profil de la semaine ou du mois précédent, pas de profils empilés. Pour plusieurs profils côte à côte, les panneaux VP de TT (puce VP du module bougies, composite N séances).
- **Volume lu sur les niveaux des barres.** Une barre sans niveaux ne compte pas et n'est pas devinée : la légende donne la part des barres qui en manquent.
- **Période partielle.** L'historique ES de TT commence le mardi 22 septembre 2026 : un mois ou une semaine dont le début n'est pas chargé est dessiné quand même, marqué « partiel ». Les jours fériés ne sont pas connus : une semaine ouverte par un lundi férié passe pour partielle si l'historique commence juste après.
- **Footprint** : ses barres ne sont pas datées, seul le profil de séance y est disponible.
- **Premier affichage d'une longue période** (un mois en barres d'une minute) : le calcul s'étale sur quelques images pour ne pas figer le graphe, l'histogramme apparaît une fraction de seconde après le reste.
- Le POC, VAH et VAL restent calculés au tick près quel que soit le regroupement des rangées.
- Pas de mode delta ni bid/ask séparés.

---

# Period Volume Profile · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the bars loaded in the chart. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

The volume profile of the current session, week or month, drawn as a histogram pinned to the right edge of the candlestick or footprint chart. The POC and the value area bounds (VAH, VAL) extend from the start of the period. Unlike the "N sessions" composite of TT's VP panels, which rolls with the sessions, the period follows the calendar: the week starts on Monday, the month on its first day.

## A bit of math

For each price p, to the tick, V(p) is the sum over the period's bars of the volume traded at that price (bid + ask of the bar's levels). The **POC** is the price where V peaks. The **value area** starts at the POC and grows tick by tick towards the richer neighbour until it holds the chosen share of total volume (70 % by default); **VAL** and **VAH** are its low and high. Ties are broken as in TT: the lowest POC, then the upper side first. On the loaded ES sessions, POC, VAH and VAL are identical to TT's session volume profile (SVP), and the test bench checks it.

The week is the ISO week (Monday to Friday), the month the calendar month; sessions fall into them by their session date. The current period is the one of the chart's last bar, live as in replay.

## What it is for

The profile shows where the market accepted to trade for long (thick rows) and where it moved fast (thin rows). The weekly or monthly POC acts as the higher timeframe's fair value and often draws price back; VAH and VAL bound that value. Price settling outside the value area is looking for new value; price coming back in and holding signals a rejection of the outside and often targets the other bound.

What it changes for the decision: knowing whether today's session holds inside the week's or month's value or leaves it, and placing targets, stops and waiting zones around the POC and the bounds. A level is only worth the price reaction when it gets there.

## Reading the chart

- **Histogram on the right edge**: one row per price or group of prices, length proportional to volume, the fullest row takes the whole set width.
- **Colours**: POC row in orange, value area rows in blue, the rest in grey (all adjustable).
- **Lines**: POC solid, VAH and VAL dashed, from the period's first bar (or the left edge if it is off screen) to the right edge.
- **Labels** POC, VAH and VAL left of the histogram.
- **Caption** top right: the period ("Session 2026-10-16", "Week 42", "Month 2026-10"), then the warnings, shown even with labels off: "partial, since …" when the chart does not load the period from its start, "x % of bars without levels" when some bars carry no volume per price.
- The histogram sits over the last candles: scroll the chart left to leave it the right edge.

## Settings

Labels below are those shown when Turning Trade is set to English.

| Setting | Role | Default |
|---|---|---|
| Period | Day (the session), Week (ISO, from Monday), Month (calendar) | Day |
| Computed on RTH only (ETH chart) | Counts only the 09:30 to 16:00 New York bars | unchecked |
| Value Area % | Share of total volume held in the value area | 70 |
| Width (% of chart) | Length of the fullest row, as a share of the chart width | 25 |
| Ticks per row (0 = auto) | Groups prices into rows; 0: at least 3 pixels per row, ticks merge when zooming out | 0 |
| Opacity | Histogram opacity | 0.5 |
| Volume color | Rows outside the value area | grey |
| Value Area color | Value area rows, VAH and VAL lines | blue |
| POC color | POC row and line | orange |
| Extended POC, VAH and VAL | Lines from the start of the period | checked |
| Labels | Level names and caption | checked |

### Known limits

- **One period at a time, the current one.** No profile of the previous week or month, no stacked profiles. For several profiles side by side, TT's VP panels (VP chip of the candles module, N sessions composite).
- **Volume read from the bars' levels.** A bar without levels does not count and is not guessed: the caption gives the share of bars lacking them.
- **Partial period.** TT's ES history starts on Tuesday 22 September 2026: a month or week whose start is not loaded is still drawn, marked "partial". Holidays are not known: a week opened by a Monday holiday counts as partial if the history starts right after it.
- **Footprint**: its bars are not dated, only the session profile is available there.
- **First display of a long period** (a month of one-minute bars): the computation spreads over a few frames so the chart does not freeze, the histogram shows a split second after the rest.
- POC, VAH and VAL stay computed to the tick whatever the row grouping.
- No delta mode, no separate bid/ask.
