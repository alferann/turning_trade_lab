# VWAP Pro · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des barres chargées dans le graphe et des heures de séance configurées. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le VWAP de Turning Trade est journalier et s'arrête à deux écarts-types. VWAP Pro reprend le même calcul et l'ancre où vous voulez : séance US (RTH), séance Asie, séance Europe, journée, semaine ou mois. Chaque instance porte jusqu'à six paliers d'écart-type dont vous choisissez le multiplicateur (1, 2, 2,5, 3,2, 3,9…), la couleur, l'épaisseur, le style et l'opacité de remplissage, bande par bande, plus des thèmes de couleurs tout faits. Six instances identiques, de A à F, pour superposer par exemple le VWAP du jour, celui de RTH et celui de la semaine.

## Un peu de maths

**VWAP.** Moyenne des prix pondérée par le volume depuis l'ancrage : VWAP = Σ prix × volume / Σ volume. Le volume est pris par prix dans le footprint de chaque barre quand il existe, sinon le volume de la barre est posé à son prix typique (haut + bas + clôture) / 3, ou à sa clôture selon le réglage « Source du prix ».

**Écart-type.** σ = √(Σ prix² × volume / Σ volume − VWAP²), pondéré par le même volume. Une bande au multiplicateur k se trace à VWAP ± k σ. Les sommes repartent de zéro à chaque nouvel ancrage.

**Ancrages.** *Journalier* : la séance du graphe, donc sur un graphe ETH la journée Globex de 18:00 à 17:00 New York, et sur un graphe RTH la séance régulière. *Séance US, Asie, Europe* : les barres de la journée dont l'heure tombe dans la fenêtre de la séance, rien en dehors. *Hebdomadaire* : les séances d'une même semaine ISO, du lundi au dimanche. *Mensuel* : les séances d'un même mois civil.

**Semaine ou mois incomplet.** Un graphe en ticks ne remonte qu'à deux semaines environ. Quand sa première barre tombe après le début de la semaine ou du mois, VWAP Pro ajoute les barres d'une minute que Turning Trade sert aux bougies, qui portent le volume par prix : le VWAP et les bandes sont alors ceux d'un graphe en minutes qui aurait toute la période. Si ces barres ne remontent pas non plus au premier jour ouvré de la période, ou ont un trou de plus de quatre jours, la période n'est pas tracée : pas de valeur calculée sur des données manquantes. Sur un graphe en minutes, tiré du même fichier, une première période incomplète est masquée directement.

**Heures de séance.** Par défaut, l'étude lit les « sessions monde » de Turning Trade, celles qui colorent le fond du graphe et se règlent dans l'appli : Tokyo à 18:00 New York, Londres à 08:00 heure de Londres, New York à 09:30, clôture à 16:00. Une séance court jusqu'au début de la suivante. Chaque instance peut forcer son début et sa fin, exprimés dans le fuseau de son choix ; la conversion vers l'heure de New York tient compte de l'heure d'été de chaque côté.

## À quoi ça sert

Le VWAP est le prix moyen payé par tous les intervenants depuis l'ancrage : au-dessus, les acheteurs de la période sont gagnants ; en dessous, ce sont les vendeurs. Les bandes mesurent l'écart du prix à cette moyenne en unités de volatilité réelle. Un VWAP de séance Asie ou Europe donne la référence des intervenants de ces places avant que New York n'ouvre ; un VWAP hebdomadaire ou mensuel donne celle des positions plus longues.

Ce que ça change pour la décision : la pente du VWAP dit qui domine la période, le retour au VWAP est la cible naturelle d'un excès, et une bande extérieure atteinte est un endroit où attendre une réaction plutôt que de poursuivre. Plusieurs ancrages qui se croisent au même prix pèsent plus qu'un seul.

## Lire le graphe

- **Trait du VWAP**, plein par défaut, et ses bandes symétriques en tirets.
- **Remplissage** de la bande intérieure de chaque palier, c'est-à-dire entre ce palier et le palier juste en dessous (ou le VWAP), des deux côtés, dans la couleur du palier et à son opacité. Par défaut σ1, σ2 et σ3 sont remplis de plus en plus pâle. Pour ne colorer que la bande entre σ4 et σ5, donner une opacité à σ5 et laisser les autres à 0.
- **Étiquette** `DVWAP`, `wVWAP`, `mVWAP`, `VWAP RTH`, `VWAP Asie` ou `VWAP EU` au bord droit, avec les bandes si demandé.
- **Coupures** : la ligne s'interrompt hors séance et repart de zéro à chaque nouvel ancrage.

## Configurer

Les mêmes réglages existent sur les six instances ; seuls l'ancrage et le thème par défaut diffèrent (A : journalier, couleurs perso ; B : séance US, thème Néon ; C : hebdomadaire, thème Océan ; D : mensuel, thème Feu ; E : séance Europe, thème Pastel ; F : séance Asie, thème Monochrome). Le panneau se lit en sous-sections : les réglages généraux, puis une sous-section par trait, VWAP puis σ1 à σ6, ouverte par une case à cocher qui allume ou éteint ce trait.

| Réglage | Rôle | Défaut |
|---|---|---|
| Ancrage | Journalier, séance US, Asie, Europe, hebdomadaire, mensuel | selon l'instance |
| Séance : début, fin | « Auto » suit les sessions de TT ; sinon une heure au quart d'heure | auto, auto |
| Séance : fuseau | Fuseau dans lequel les heures forcées sont lues | New York |
| Source du prix | Footprint sinon (H+L+C)/3, ou (H+L+C)/3, ou clôture | footprint |
| Historique | Toutes les périodes chargées, ou la période en cours seule | toutes |
| Thème de couleurs | Perso, Turning Trade, Néon, Océan, Feu, Pastel, Monochrome ; un thème remplace les couleurs saisies | selon l'instance |
| Étiquettes de prix | VWAP seul, VWAP et bandes, aucune | VWAP seul |
| **VWAP** | Case à cocher : trace ou masque le trait central et son étiquette | cochée |
| Couleur, épaisseur, style | Le trait central | orange TT, 1,5, plein |
| **σ1 à σ6** | Case à cocher : allume le palier | σ1 à σ3 cochées |
| Multiplicateur | Distance en écarts-types ; 0 éteint aussi le palier, l'ordre de saisie n'importe pas | 1 à 6 |
| Couleur, épaisseur, style | La paire de bandes du palier | palette TT, 1, tirets |
| Opacité de la bande intérieure | Remplissage entre ce palier et le palier juste en dessous, 0 pour aucun | 0,08, 0,05, 0,03, puis 0 |

### Limites connues

- Six paliers au plus par instance ; six instances au plus, parce que Turning Trade n'accepte qu'une étude par identifiant et mémorise les réglages par identifiant (pas de duplication d'une étude avec d'autres réglages). Il n'y a pas de champ texte dans le panneau de réglages de TT, d'où des paliers fixes plutôt qu'une liste libre.
- Le panneau de TT n'a pas de vrai titre de section : chaque sous-section commence par sa case à cocher, suivie d'un filet.
- Les séances Asie et Europe n'ont de barres que sur un graphe ETH ; sur un graphe RTH elles ne dessinent rien.
- Le footprint ne date pas ses barres : l'hebdomadaire et le mensuel y retombent sur la séance affichée, et les heures de séance sont lues à la date du jour.
- Turning Trade ne sert aux bougies que les vingt dernières séances : vers la fin d'un mois de plus de vingt séances, le mensuel disparaît du graphe en ticks comme du graphe en minutes, faute de son début. Un jour manquant isolé ne se distingue pas d'un férié et n'est pas détecté. Un premier jour ouvré férié (1er janvier) fait passer la période pour incomplète. Sur un graphe en ticks, la période complétée apparaît une fois le fichier minute lu, une fraction de seconde après l'ouverture.
- Une fenêtre de séance qui enjambe l'ouverture du graphe (par exemple 17:00 → 18:30 New York sur un graphe ETH) est coupée à l'ouverture.
- Les offsets d'heure d'été sont calculés à midi de la date de la séance : le jour exact d'un changement d'heure, la fenêtre peut être décalée d'une heure sur les barres du soir.
- **Premier affichage** d'un long historique, ou après un changement de réglage : le calcul s'étale sur quelques images pour ne pas figer le graphe, les traits apparaissent une fraction de seconde après le reste.
- **Zoom arrière** : au-delà d'une barre par pixel, les traits ne gardent qu'un point tous les deux pixels. C'est invisible à l'œil, et c'est ce qui permet de tracer six paliers sans dépasser les 8 ms par image au-delà desquelles Turning Trade suspend une étude.

---

# VWAP Pro · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the bars loaded in the chart and on the configured session hours. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

Turning Trade's VWAP is daily and stops at two standard deviations. VWAP Pro keeps the same math and anchors it where you want: US session (RTH), Asian session, European session, day, week or month. Each instance carries up to six standard-deviation levels whose multiplier (1, 2, 2.5, 3.2, 3.9…), colour, thickness, style and fill opacity you choose band by band, plus ready-made colour themes. Six identical instances, A to F, let you stack for instance the daily, the RTH and the weekly VWAP.

## A bit of math

**VWAP.** Volume-weighted average price since the anchor: VWAP = Σ price × volume / Σ volume. Volume is taken per price from each bar's footprint when available; otherwise the bar's volume sits at its typical price (high + low + close) / 3, or at its close, per the "Price source" setting.

**Standard deviation.** σ = √(Σ price² × volume / Σ volume − VWAP²), weighted by the same volume. A band with multiplier k is drawn at VWAP ± k σ. Sums restart from zero at every new anchor.

**Anchors.** *Daily*: the chart's session, so on an ETH chart the Globex day from 18:00 to 17:00 New York, and on an RTH chart the regular session. *US, Asian, European session*: the bars of the day whose time falls inside the session window, nothing outside. *Weekly*: the sessions of one ISO week, Monday to Sunday. *Monthly*: the sessions of one calendar month.

**Incomplete week or month.** A tick chart only goes back two weeks or so. When its first bar falls after the start of the week or month, VWAP Pro adds the one-minute bars Turning Trade serves the candles, which carry volume per price: the VWAP and bands are then those of a minute chart holding the whole period. If those bars do not reach the period's first business day either, or have a hole of more than four days, the period is not drawn: no value computed on missing data. On a minute chart, cut from the same file, an incomplete first period is masked straight away.

**Session hours.** By default the study reads Turning Trade's "world sessions", the ones that tint the chart background and are edited in the app: Tokyo at 18:00 New York, London at 08:00 London time, New York at 09:30, close at 16:00. A session runs until the next one starts. Each instance can force its start and end, expressed in the time zone of your choice; the conversion to New York time accounts for daylight saving on both sides.

## What it is for

The VWAP is the average price paid by every participant since the anchor: above it, the period's buyers are winning; below it, the sellers are. The bands measure the distance of price from that average in units of realised volatility. An Asian or European session VWAP gives the reference of those participants before New York opens; a weekly or monthly VWAP gives the reference of longer positions.

What it changes for the decision: the slope of the VWAP says who dominates the period, the return to the VWAP is the natural target of an excess, and a reached outer band is a place to wait for a reaction rather than chase. Several anchors crossing at the same price weigh more than one.

## Reading the chart

- **VWAP line**, solid by default, and its symmetric bands in dashes.
- **Fill** of each level's inner band, between that level and the one just below it (or the VWAP), on both sides, in the level's colour and at its opacity. By default σ1, σ2 and σ3 are filled paler and paler. To shade only the band between σ4 and σ5, give σ5 an opacity and leave the others at 0.
- **Label** `DVWAP`, `wVWAP`, `mVWAP`, `VWAP RTH`, `VWAP Asia` or `VWAP EU` at the right edge, with the bands if requested.
- **Breaks**: the line stops outside the session and restarts from zero at each new anchor.

## Settings

The same settings exist on all six instances; only the default anchor and theme differ (A: daily, custom colours; B: US session, Neon theme; C: weekly, Ocean theme; D: monthly, Fire theme; E: European session, Pastel theme; F: Asian session, Monochrome theme). The panel reads in sub-sections: general settings, then one sub-section per line, VWAP then σ1 to σ6, opened by a checkbox that turns that line on or off. Labels below are those shown when Turning Trade is set to English.

| Setting | Role | Default |
|---|---|---|
| Anchoring | Daily, US, Asian, European session, weekly, monthly | per instance |
| Session: start, end | "Auto" follows TT's sessions; otherwise a time on the quarter hour | auto, auto |
| Session: time zone | Time zone in which forced hours are read | New York |
| Price source | Footprint else (H+L+C)/3, or (H+L+C)/3, or close | footprint |
| History | Every loaded period, or the current period only | all |
| Color theme | Custom, Turning Trade, Neon, Ocean, Fire, Pastel, Monochrome; a theme overrides the colours entered | per instance |
| Price labels | VWAP only, VWAP and bands, none | VWAP only |
| **VWAP** | Checkbox: draws or hides the central line and its label | checked |
| Color, Thickness, Style | The central line | TT orange, 1.5, solid |
| **σ1 to σ6** | Checkbox: turns the level on | σ1 to σ3 checked |
| Multiplier | Distance in standard deviations; 0 also turns the level off, entry order does not matter | 1 to 6 |
| Color, Thickness, Style | The level's pair of bands | TT palette, 1, dashes |
| Inner band opacity | Fill between this level and the one just below it, 0 for none | 0.08, 0.05, 0.03, then 0 |

### Known limits

- At most six levels per instance and six instances, because Turning Trade accepts one study per id and stores settings per id (a study cannot be duplicated with other settings). TT's settings panel has no text field, hence fixed slots rather than a free list.
- TT's panel has no real section title: each sub-section starts with its checkbox, followed by a rule.
- Asian and European sessions only have bars on an ETH chart; on an RTH chart they draw nothing.
- The footprint does not date its bars: weekly and monthly fall back to the displayed session there, and session hours are read at today's date.
- Turning Trade only serves the candles the last twenty sessions: towards the end of a month of more than twenty sessions, the monthly VWAP disappears from the tick chart as from the minute chart, its start being gone. A lone missing day cannot be told from a holiday and is not detected. A first business day that is a holiday (1 January) makes the period look incomplete. On a tick chart, the completed period shows once the minute file is read, a split second after opening.
- A session window that straddles the chart's open (for instance 17:00 → 18:30 New York on an ETH chart) is cut at the open.
- Daylight-saving offsets are computed at noon of the session date: on the exact day of a clock change, the window may be off by one hour on the evening bars.
- **First display** of a long history, or after a settings change: the computation spreads over a few frames so the chart does not freeze, the lines show a split second after the rest.
- **Zoomed out**: beyond one bar per pixel, the lines keep one point every two pixels. The eye cannot tell, and it is what lets six levels draw within the 8 ms per frame beyond which Turning Trade suspends a study.
