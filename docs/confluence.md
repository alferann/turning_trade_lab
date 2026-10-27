# Confluence Scanner · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses niveaux dépendent des données chargées et son regroupement est une convention. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Un graphe de trader est couvert de niveaux : VWAP, POC, pivots, haut et bas de la veille, ouvertures, plage d'ouverture. Pris un par un, ils se contredisent. L'étude les calcule tous à partir du graphe lui-même, regroupe ceux qui tombent au même endroit et note chaque groupe. Un badge `5 · PDH OpenRTH ORH IBH Open0h` dit que cinq méthodes différentes désignent le même prix. Quand le prix s'en approche, la zone s'allume.

## Un peu de maths

**VWAP.** Moyenne des prix pondérée par le volume : VWAP = Σ prix × volume / Σ volume, calculée sur le volume par prix du footprint, ou à défaut sur le volume de chaque barre à son prix typique (haut + bas + clôture) / 3. L'écart-type σ = √(Σ prix² × volume / Σ volume − VWAP²) donne les bandes ±1σ et ±2σ. `DVWAP` depuis l'ouverture de la séance, `wVWAP` depuis le début de la semaine ISO, sur les séances chargées.

**Profil de volume.** Le POC est le prix où le plus de contrats se sont échangés. La zone de valeur part du POC et s'étend, niveau par niveau, du côté qui porte le plus de volume, jusqu'à contenir 70 % du volume. VAH et VAL en sont les bornes. Sur un graphe ETH, dès que RTH est ouvert, le profil se calcule sur RTH seul et s'appelle `RTHPOC`, `RTHVAH`, `RTHVAL` ; avant, sur l'overnight. La veille donne `pdPOC`, `pdVAH`, `pdVAL`.

**Profil TPO.** Chaque période de 30 minutes couvre tous les prix entre son bas et son haut. Le profil compte, pour chaque prix, le nombre de périodes qui l'ont couvert : `TPOC` est le prix le plus couvert, `TVAH` et `TVAL` bornent les 70 % de couverture autour de lui. C'est le profil du temps passé, là où le profil de volume est celui des contrats échangés.

**Pivots.** À partir du haut H, du bas L et de la clôture C de la période précédente : PP = (H + L + C) / 3, R1 = 2 PP − L, S1 = 2 PP − H, R2 = PP + (H − L), S2 = PP − (H − L). Journaliers sur la veille, hebdomadaires sur la semaine ISO précédente avec le préfixe `w`.

**Ouvertures, niveaux clés et plages.** `PDH`, `PDL`, `PDC` : haut, bas, clôture de la veille. `OpenETH` : ouverture de la séance Globex ; `Open0h` : première barre à partir de minuit New York ; `OpenH4` : ouverture de la tranche de quatre heures en cours, alignée sur 18h ; `OpenRTH` : première barre à partir de 09h30. `ONH`, `ONL` : plage overnight avant 09h30. `HOD`, `LOD` : haut et bas de la séance. `ORH`, `ORL` : plage des premières minutes après 09h30 ; `IBH`, `IBL` : balance initiale, pareil sur une durée plus longue.

**Regroupement.** Les niveaux sont triés par prix. Un niveau rejoint la zone en cours s'il est à moins de « Largeur de regroupement » du niveau précédent et que la zone ne dépasse pas deux largeurs ; sinon il en ouvre une nouvelle. Le score d'une zone est son nombre de niveaux.

**Proximité.** Le prix courant est à moins de « Distance de proximité » ticks de la zone : elle s'allume.

**Données manquantes.** Un niveau n'est affiché que si le graphe charge toute sa fenêtre. La séance doit partir de son ouverture, dans l'heure, pour `DVWAP`, `HOD`, `LOD`, `OpenETH`, l'overnight et les profils de la séance entière. Les niveaux RTH demandent seulement 09h30. La veille doit être la séance ouvrée précédente, chargée sur sa fenêtre : RTH ou séance entière, jusqu'à 4 h de la fin. Une semaine doit partir du lundi, sans séance manquante ni incomplète, et la semaine précédente doit finir un vendredi. Une barre de comblement (trou du courtier) masque ce qui la contient. Ces règles sont celles des points pivots.

## À quoi ça sert

Un niveau isolé est une opinion. Trois niveaux issus de méthodes indépendantes qui tombent au même prix sont une coïncidence que beaucoup d'intervenants regardent en même temps, et c'est là que le prix réagit le plus souvent. L'étude vous évite de garder dix indicateurs à l'écran et de compter de tête : elle montre où ils s'empilent et à quel point.

Ce que ça change pour la décision : une zone à score élevé est un endroit où attendre une réaction plutôt que de traverser sans regarder, où poser un objectif, ou où une divergence CVD prend plus de poids. Le halo vous prévient que vous y arrivez. Le score ne dit rien du sens : la zone peut tenir ou céder.

## Lire le graphe

- **Bande** horizontale par zone, plus opaque quand le score monte.
- **Badge** au bord droit : le score dans une case pleine, puis les niveaux de la zone. Gris à 2, bleu à 3, rouge à partir de 4, blanc quand le prix est à portée. Badges et noms se dessinent par-dessus les autres études, un profil de volume par exemple.
- **Halo** : deux lignes claires aux bords de la zone quand le prix est à portée.
- **Niveaux isolés** en trait fin pointillé avec leur nom en petit, à droite, sur un fond sombre.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Largeur de regroupement | Distance en ticks pour que deux niveaux partagent une zone | 6 |
| Score mini d'une zone | Nombre de niveaux à partir duquel une zone se dessine | 2 |
| Distance de proximité | Distance en ticks pour allumer une zone | 8 |
| VWAP journalier, hebdomadaire | DVWAP et wVWAP | oui, oui |
| Bandes VWAP | Écarts-types tracés, 0, 1 ou 2 | 2 |
| Profil de volume, profil de la veille | POC, VAH, VAL d'aujourd'hui et d'hier | oui, oui |
| Profil TPO | TPOC, TVAH, TVAL | oui |
| Profils sur RTH dès 09:30 | Sur un graphe ETH, les profils du jour passent sur RTH à l'ouverture | oui |
| Pivots journaliers, hebdomadaires | Pivots classiques | oui, oui |
| Niveaux clés | PDH, PDL, PDC et les quatre ouvertures | oui |
| Plages | ONH, ONL, HOD, LOD | oui |
| Plage d'ouverture, balance initiale | Durées en minutes après 09h30, 0 pour désactiver | 15, 60 |
| Veille sur RTH seul | Sur un graphe ETH, la veille se limite à 09h30 → fin de séance | oui |
| Niveaux isolés en trait fin | Montrer aussi les niveaux sans voisin | oui |
| Badges de score | Les badges au bord droit | oui |
| Taille du texte | Texte des badges et des noms | 10 |
| Opacité de base | Opacité d'une zone au score mini | 0,08 |
| Couleur score 2, 3, 4 et plus | Teinte des bandes et des badges par score | gris, bleu, rouge |
| Couleur à l'approche | Teinte du halo et du badge quand le prix est proche | blanc |

### Limites à connaître

- Un niveau masqué n'est pas une erreur : la donnée manque (graphe en ticks qui ne remonte qu'à deux semaines, séance tronquée, jour non racheté). Les jours fériés ne sont pas connus : le lendemain d'un férié, la veille passe pour manquante, et une semaine ouverte un mardi après un lundi férié passe pour incomplète.
- Un trou sans barre de comblement au milieu d'une séance, comme sur le footprint, ne se voit pas.
- La largeur se règle en ticks : 6 ticks font 1,5 point sur ES et NQ. Un instrument plus large demande une largeur plus grande.
- Sur un graphe RTH, il n'y a ni overnight, ni `Open0h`, ni `OpenETH`, le graphe commence à 09h30.
- Sur le footprint, qui ne date pas ses barres, les séances se découpent quand les minutes repartent en arrière : la veille et les pivots journaliers restent, mais ni semaine, ni `wVWAP`, ni pivots hebdomadaires.
- Resolve ajoute un VWAP mensuel et des profils sur plusieurs horizons ; ici, tout vient des barres chargées dans le graphe.

---

# Confluence Scanner · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its levels depend on the data loaded and its grouping is a convention. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

A trader's chart is covered with levels: VWAP, POC, pivots, yesterday's high and low, opens, opening range. Taken one by one, they contradict each other. The study computes all of them from the chart itself, groups those that land in the same place and scores each group. A badge `5 · PDH OpenRTH ORH IBH Open0h` says five different methods point at the same price. When price approaches, the zone lights up.

## A bit of math

**VWAP.** Volume-weighted average price: VWAP = Σ price × volume / Σ volume, computed on the footprint's volume per price, or failing that on each bar's volume at its typical price (high + low + close) / 3. The standard deviation σ = √(Σ price² × volume / Σ volume − VWAP²) gives the ±1σ and ±2σ bands. `DVWAP` since the session open, `wVWAP` since the start of the ISO week, over the sessions loaded.

**Volume profile.** The POC is the price where most contracts traded. The value area starts at the POC and expands, one level at a time, on the side carrying more volume, until it holds 70 % of the volume. VAH and VAL are its bounds. On an ETH chart, once RTH is open the profile is computed on RTH only and named `RTHPOC`, `RTHVAH`, `RTHVAL`; before that, on the overnight. The previous day gives `pdPOC`, `pdVAH`, `pdVAL`.

**TPO profile.** Each 30-minute period covers every price between its low and its high. The profile counts, for each price, how many periods covered it: `TPOC` is the most covered price, `TVAH` and `TVAL` bound the 70 % of coverage around it. It is the profile of time spent, where the volume profile is the profile of contracts traded.

**Pivots.** From the high H, low L and close C of the previous period: PP = (H + L + C) / 3, R1 = 2 PP − L, S1 = 2 PP − H, R2 = PP + (H − L), S2 = PP − (H − L). Daily on the previous session, weekly on the previous ISO week with the `w` prefix.

**Opens, key levels and ranges.** `PDH`, `PDL`, `PDC`: previous session high, low, close. `OpenETH`: Globex session open; `Open0h`: first bar from midnight New York; `OpenH4`: open of the current four-hour block, aligned on 18:00; `OpenRTH`: first bar from 09:30. `ONH`, `ONL`: overnight range before 09:30. `HOD`, `LOD`: session high and low. `ORH`, `ORL`: range of the first minutes after 09:30; `IBH`, `IBL`: initial balance, same over a longer window.

**Grouping.** Levels are sorted by price. A level joins the current zone if it is within "Grouping width" of the previous level and the zone stays within two widths; otherwise it opens a new one. A zone's score is its number of levels.

**Proximity.** Current price within "Proximity distance" ticks of the zone: it lights up.

**Missing data.** A level is shown only if the chart loads its whole window. The session must start at its open, within the hour, for `DVWAP`, `HOD`, `LOD`, `OpenETH`, the overnight and whole-session profiles. RTH levels only need 09:30. The previous session must be the previous business day, loaded over its window: RTH or the whole session, up to 4 h before its end. A week must start on Monday, with no missing or incomplete session, and the previous week must end on a Friday. A filler bar (broker gap) masks whatever contains it. These are the pivot points study's rules.

## What it is for

A single level is an opinion. Three levels from independent methods landing at the same price are a coincidence many participants watch at the same time, and that is where price reacts most often. The study saves you from keeping ten indicators on screen and counting in your head: it shows where they stack and how much.

What it changes for a decision: a high-score zone is a place to expect a reaction rather than cross blindly, to put a target, or where a CVD divergence carries more weight. The glow tells you that you are getting there. The score says nothing about direction: the zone may hold or give way.

## Reading the chart

- **Horizontal band** per zone, more opaque as the score rises.
- **Badge** at the right edge: the score in a filled box, then the zone's levels. Grey at 2, blue at 3, red from 4, white when price is within reach. Badges and names are drawn over the other studies, a volume profile for instance.
- **Glow**: two bright lines at the zone's edges when price is within reach.
- **Isolated levels** as thin dashed lines with their name in small print on the right, on a dark background.

## Settings

| Setting | Role | Default |
|---|---|---|
| Grouping width | Distance in ticks for two levels to share a zone | 6 |
| Minimum zone score | Number of levels from which a zone is drawn | 2 |
| Proximity distance | Distance in ticks to light a zone up | 8 |
| Daily, weekly VWAP | DVWAP and wVWAP | on, on |
| VWAP bands | Standard deviations drawn, 0, 1 or 2 | 2 |
| Volume profile, previous session volume profile | Today's and yesterday's POC, VAH, VAL | on, on |
| TPO profile | TPOC, TVAH, TVAL | on |
| Profiles on RTH from 09:30 | On an ETH chart, today's profiles switch to RTH at the open | on |
| Daily, weekly pivots | Classic floor pivots | on, on |
| Key levels | PDH, PDL, PDC and the four opens | on |
| Ranges | ONH, ONL, HOD, LOD | on |
| Opening range, initial balance | Minutes after 09:30, 0 to disable | 15, 60 |
| Previous session on RTH only | On an ETH chart, the previous session is limited to 09:30 → close | on |
| Isolated levels as thin lines | Also show levels without a neighbour | on |
| Score badges | Badges at the right edge | on |
| Text size | Badge and name text size | 10 |
| Base opacity | Opacity of a zone at the minimum score | 0.08 |
| Score 2, 3, 4+ color | Tint of bands and badges by score | grey, blue, red |
| Approach color | Tint of the glow and badge when price is close | white |

### Known limits

- A masked level is not a bug: the data is missing (a tick chart going back only two weeks, a cut session, a day not bought back). Holidays are not known: the day after a holiday, the previous session counts as missing, and a week opening on a Tuesday after a Monday holiday counts as incomplete.
- A gap without filler bars in the middle of a session, as on the footprint, goes unseen.
- Width is set in ticks: 6 ticks are 1.5 points on ES and NQ. A wider instrument needs a wider setting.
- On an RTH chart there is no overnight, no `Open0h`, no `OpenETH`, the chart starts at 09:30.
- On the footprint, which does not date its bars, sessions are split where the minutes go back: the previous session and daily pivots remain, but no week, no `wVWAP`, no weekly pivots.
- Resolve adds a monthly VWAP and profiles over several horizons; here everything comes from the bars loaded in the chart.
