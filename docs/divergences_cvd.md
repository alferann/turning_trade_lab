# Divergences CVD · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, elle rate des divergences et en montre qui ne donneront rien. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le CVD (delta cumulé) additionne, barre après barre, les contrats échangés à l'ask moins ceux échangés au bid. Il dit qui pousse : les acheteurs agressifs ou les vendeurs agressifs. Une divergence, c'est quand le prix et le CVD ne racontent plus la même histoire. L'étude les repère, les classe en quatre types, les suit dans le temps et les dessine sur le prix et dans un volet CVD.

## Un peu de maths

**Le CVD.** À l'ancrage, le compteur repart de zéro. Puis pour chaque barre, CVD = CVD précédent + (volume à l'ask − volume au bid). L'ancrage est la séance du graphe, ou 09h30 New York si vous choisissez RTH sur un graphe ETH. Le cumul part toujours de l'ancrage, même quand l'écran commence des heures après lui.

**Les pivots.** Une barre est un pivot haut si aucune des L barres à sa gauche ni des L barres à sa droite n'a un haut plus élevé. Même chose en miroir pour un pivot bas. L vaut « Pivot court ». Un pivot de niveau moyen est un pivot court qui domine K pivots courts de chaque côté ; le niveau long fait pareil avec les pivots moyens. Deux barres voisines au même prix comptent pour un seul pivot, le dernier.

**L'accord des deux moteurs.** Le prix a ses pivots, le CVD a les siens, calculés séparément. Un pivot prix n'est retenu que si un pivot CVD de même sens tombe à « Tolérance » barres près.

**Les quatre types.** Entre deux pivots retenus A puis B, de même côté :

| Côté | Prix | CVD | Type | Lecture |
|---|---|---|---|---|
| sommets | B ≥ A | B < A | **UE** épuisement haussier | le prix monte, les acheteurs ne suivent plus |
| sommets | B ≤ A | B > A | **UA** absorption de l'achat | les acheteurs poussent, le prix ne monte pas |
| creux | B ≤ A | B > A | **DE** épuisement baissier | le prix baisse, les vendeurs ne suivent plus |
| creux | B ≥ A | B < A | **DA** absorption de la vente | les vendeurs poussent, le prix ne baisse pas |

UE et UA sont baissiers, DE et DA haussiers. Un prix égal compte : un double sommet avec un CVD plus bas est un UE.

**L'invalidation.** Entre A et B, ni le prix ni le CVD ne doivent dépasser le plus extrême des deux pivots. Une ligne qui traverserait un sommet intermédiaire plus haut n'est pas une divergence.

**Le choix de A.** Chaque pivot B est comparé à tous les pivots retenus avant lui dans « Écart max », pas seulement au précédent, car une divergence enjambe souvent un sommet intermédiaire. Si plusieurs A conviennent, on garde celui au plus grand écart CVD.

**La force relative.** Écart CVD entre A et B divisé par l'amplitude du CVD sur le segment. Près de 1, le CVD a fait tout le chemin en sens inverse ; près de 0, il a à peine bougé.

**Les états.** Tant que B n'est pas un pivot confirmé, la divergence est *en formation*. Ensuite, le premier événement l'emporte : le prix casse l'extrême opposé du segment A → B, elle est *confirmée* ; le prix redépasse B, elle est *cassée* ; rien encore, elle est *en attente*.

## À quoi ça sert

Le prix seul montre où l'on est ; le CVD montre avec quelle conviction on y est arrivé. Un nouveau plus haut avec moins d'acheteurs derrière est un plus haut fragile. Des vendeurs qui martèlent sans faire baisser le prix se heurtent à quelqu'un qui absorbe. Dans les deux cas, la divergence signale un déséquilibre entre effort et résultat, souvent avant que le prix ne tourne.

Ce que ça change pour la décision : une divergence confirmée au niveau où vous comptiez déjà agir ajoute une raison d'agir. Une divergence cassée vous dit que l'idée n'a pas pris. Sur quatre séances ES en 1 minute, environ une divergence sur deux a été confirmée avant d'être cassée, et les niveaux moyen et long font mieux que le court. C'est un filtre, pas un oracle.

## Lire le graphe

- **Ligne** entre les deux pivots : pleine si confirmée, pointillée si en attente ou en formation, pointillée atténuée si cassée. Épaisseur croissante avec le niveau.
- **Étiquette** au pivot B : type et niveau, `UE2` ; `?` en formation ; `✗` cassée.
- **Point** au pivot B sur le prix, **triangle** sur le volet CVD, pleins si confirmée.
- **Couleurs** : une par type, UE rose, UA mauve, DE vert, DA cyan.
- **Bande de pré-tir** au niveau du dernier pivot retenu quand le prix y revient alors que le CVD diverge déjà : la divergence est possible, pas encore formée.
- **Notification** de bureau pour chaque formation et chaque confirmation de la séance.

Le volet CVD dessine le delta cumulé en chandeliers, un par barre, du cumul d'ouverture au cumul de clôture, avec l'axe zéro. La mèche montre le plus haut et le plus bas atteints par le cumul pendant la barre. Seule la tape (les exécutions une à une) donne cet ordre, et TT ne la fournit que pour la séance affichée, en direct ou rejouée. Une barre n'a donc de mèche que si sa tape redonne exactement son delta : les séances précédentes, ou une barre où la tape commence ou s'interrompt, gardent le corps seul. Au chargement d'une séance chargée, les mèches apparaissent en quelques images.

**Rien n'est tracé sur des données manquantes.** Un CVD n'est juste que cumulé en entier depuis son ancrage. Une séance de CVD (la séance du graphe, ou chacune de ses deux parties avec l'ancrage RTH) prise après son ancrage, ou qui contient une barre de comblement, une barre sans niveaux (son delta est inconnu, pas nul) ou un trou de plus de 10 minutes au-delà de la durée d'une barre (le seuil des marques « sans donnée » de Turning Trade ; une heure sur les graphes en ticks, en volume ou en range), n'a ni CVD ni divergence à partir de là, jusqu'à la séance suivante. Ce qui précède le trou est juste et reste tracé. La légende « séance incomplète » le signale en haut à gauche, sur le prix et dans le volet.

## Configurer

Les réglages de détection, de filtrage et de couleur vivent sur l'étude **Divergences CVD · prix**. Le volet CVD les suit automatiquement et ne garde que son affichage.

### Détection

| Réglage | Rôle | Défaut |
|---|---|---|
| Ancrage CVD | Remise à zéro : séance du graphe, ou 09h30 NY sur un graphe ETH | RTH |
| Comparer sur | Pivots sur les mèches ou sur les clôtures | Mèche |
| Confirmation | Montrer les divergences en formation, ou seulement les pivots confirmés | Dès la clôture |
| Invalider si dépassement | Rejeter une ligne qu'un extrême intermédiaire traverse | oui |
| Tolérance prix ↔ CVD | Écart maximal en barres entre pivot prix et pivot CVD | 2 |
| Pivot CVD exigé | Niveau minimal du pivot CVD, 1 à 3 | 1 |
| Pivot court | Barres de chaque côté pour un pivot court | 3 |
| Agrégation moyen, long | Pivots dominés de chaque côté pour monter d'un niveau | 2, 2 |
| Écart max | Distance maximale A → B en barres | 120 |
| Amplitude mini si prix différents | Différence minimale entre les deux pivots prix, en ticks, les égalités passant toujours | 0 |
| Écart CVD mini | Différence minimale de CVD, en contrats | 0 |
| Force relative mini | Seuil 0 à 1 sur la force relative | 0 |
| Zones de pré-tir, distance | Activation et distance au pivot en ticks | oui, 8 |

### Filtres et couleurs

| Réglage | Rôle |
|---|---|
| Niveau court, moyen, long | Niveaux affichés |
| UE, UA, DE, DA | Types affichés |
| Montrer les cassées | Garder ou masquer les divergences cassées |
| Couleur UE, UA, DE, DA | Une couleur par type |

### Affichage et alertes

| Réglage | Étude | Rôle |
|---|---|---|
| Point au pivot B, rayon | prix | Marqueur sur le prix |
| Triangle au pivot B, taille, écart | volet | Marqueur sur le CVD |
| Écart marqueur → texte, étiquettes, taille, gras | les deux | Texte |
| Notifier les formations, les confirmées | prix | Alertes de bureau |
| Style du CVD, axes, couleurs des bougies | volet | Dessin du delta cumulé |
| Mèches (tape de la séance) | volet | Mèches des chandeliers, là où la tape couvre la barre |

### Réglages conseillés

- Trop de lignes en 1 minute : « Écart CVD mini » autour de 250 contrats sur ES, ou « Force relative mini » à 0,5 qui vaut pour tous les instruments, ou décocher « Niveau court ».
- Pour ne voir que ce qui a marché : décocher « Montrer les cassées ».
- Les réglages sont mémorisés par type de graphe, pas par instrument : un seuil en contrats réglé pour ES sera trop haut pour NQ.

## Limites connues

- Une séance prise en cours est masquée jusqu'à sa fin. Avec l'ancrage RTH, sa partie RTH revient dès 09h30 : un graphe NQ chargé à partir de 03h21 garde son CVD et ses divergences de la séance de New York.
- Les seuils de trou suivent ceux de Turning Trade sur les graphes en minutes. Sur les graphes en ticks, en volume ou en range, faute de durée de barre, seul un trou de plus d'une heure est vu.
- Au premier affichage d'une très longue séance de CVD (graphe en ticks fin, ancrage ETH), la lecture depuis l'ancrage s'étale sur quelques images, sans rien tracer pendant ce temps.

---

# CVD Divergences · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, it misses divergences and shows some that lead nowhere. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

CVD (cumulative volume delta) adds up, bar after bar, contracts traded at the ask minus contracts traded at the bid. It tells who is pushing: aggressive buyers or aggressive sellers. A divergence is when price and CVD stop telling the same story. The study finds them, sorts them into four types, tracks them over time and draws them on the price chart and in a CVD pane.

## A bit of math

**CVD.** At the anchor the counter restarts from zero. Then for each bar, CVD = previous CVD + (ask volume − bid volume). The anchor is the chart's session, or 09:30 New York if you pick RTH on an ETH chart. The total always starts at the anchor, even when the screen starts hours after it.

**Pivots.** A bar is a pivot high if none of the L bars to its left or the L bars to its right has a higher high. Mirror this for a pivot low. L is "Short pivot". An intermediate pivot is a short pivot that dominates K short pivots on each side; the long level does the same with intermediate pivots. Two neighbouring bars at the same price count as one pivot, the last one.

**Two engines agreeing.** Price has its pivots, CVD has its own, computed separately. A price pivot is kept only if a CVD pivot of the same side falls within "Price ↔ CVD tolerance" bars.

**The four types.** Between two kept pivots A then B on the same side:

| Side | Price | CVD | Type | Reading |
|---|---|---|---|---|
| highs | B ≥ A | B < A | **UE** uptrend exhaustion | price rises, buyers no longer follow |
| highs | B ≤ A | B > A | **UA** uptrend absorption | buyers push, price does not rise |
| lows | B ≤ A | B > A | **DE** downtrend exhaustion | price falls, sellers no longer follow |
| lows | B ≥ A | B < A | **DA** downtrend absorption | sellers push, price does not fall |

UE and UA are bearish, DE and DA bullish. Equal prices count: a double top with a lower CVD is a UE.

**Invalidation.** Between A and B, neither price nor CVD may exceed the more extreme of the two pivots. A line crossing a higher intermediate high is not a divergence.

**Choosing A.** Each pivot B is compared with every kept pivot before it within "Max gap", not only the previous one, because a divergence often straddles an intermediate swing. If several A qualify, the one with the largest CVD gap wins.

**Relative strength.** CVD gap between A and B divided by the CVD range over the segment. Near 1, CVD travelled all the way against price; near 0, it barely moved.

**States.** Until B is a confirmed pivot the divergence is *forming*. Then the first event wins: price breaks the opposite extreme of the A → B segment, it is *confirmed*; price exceeds B again, it is *broken*; nothing yet, it is *pending*.

## What it is for

Price alone shows where we are; CVD shows how much conviction got us there. A new high with fewer buyers behind it is a fragile high. Sellers hammering without pushing price down are running into someone absorbing. In both cases the divergence flags an imbalance between effort and result, often before price turns.

What it changes for a decision: a confirmed divergence at a level where you already planned to act adds a reason to act. A broken divergence tells you the idea did not take. On four ES sessions in 1 minute, about one divergence in two was confirmed before being broken, and the intermediate and long levels do better than the short one. It is a filter, not an oracle.

## Reading the chart

- **Line** between the two pivots: solid if confirmed, dashed if pending or forming, faded dashed if broken. Thicker with the level.
- **Label** at pivot B: type and level, `UE2`; `?` forming; `✗` broken.
- **Dot** at pivot B on price, **triangle** on the CVD pane, filled when confirmed.
- **Colours**: one per type, UE pink, UA mauve, DE green, DA cyan.
- **Pre-shot band** at the level of the last kept pivot when price comes back while CVD already diverges: the divergence is possible, not formed yet.
- **Desktop notification** for each forming and each confirmed divergence of the session.

The CVD pane draws cumulative delta as candles, one per bar, from the opening to the closing total, with the zero axis. The wick shows the highest and lowest total reached during the bar. Only the tape (trades one by one) gives that order, and TT only serves it for the displayed session, live or replayed. A bar therefore gets a wick only if its tape gives back exactly its delta: earlier sessions, or a bar where the tape starts or breaks off, keep the body alone. When a busy session loads, wicks appear within a few frames.

**Nothing is drawn from missing data.** A CVD is only right when summed in full from its anchor. A CVD session (the chart's session, or each of its two parts with the RTH anchor) joined after its anchor, or holding a filler bar, a bar without levels (its delta is unknown, not zero) or a hole of more than 10 minutes beyond one bar's duration (the threshold of Turning Trade's "no data" marks; one hour on tick, volume or range charts) has no CVD nor divergence from there on, until the next session. What comes before the hole is right and stays drawn. The "incomplete session" caption says so at the top left, on price and in the pane.

## Settings

Detection, filter and colour settings live on **Divergences CVD · prix**. The CVD pane follows them automatically and only keeps its own display settings.

### Detection

| Setting | Role | Default |
|---|---|---|
| CVD anchor | Reset: the chart's session, or 09:30 NY on an ETH chart | RTH |
| Compare on | Pivots on wicks or on closes | Wick |
| Confirmation | Show forming divergences, or confirmed pivots only | From the close |
| Invalidate if crossed | Reject a line crossed by an intermediate extreme | on |
| Price ↔ CVD tolerance | Maximum bars between price pivot and CVD pivot | 2 |
| Required CVD pivot | Minimum CVD pivot level, 1 to 3 | 1 |
| Short pivot | Bars on each side for a short pivot | 3 |
| Medium, long aggregation | Dominated pivots on each side to climb one level | 2, 2 |
| Max gap | Maximum A → B distance in bars | 120 |
| Min amplitude if prices differ | Minimum difference between the two price pivots in ticks, equal prices always pass | 0 |
| Min CVD gap | Minimum CVD difference in contracts | 0 |
| Min relative strength | 0 to 1 threshold on relative strength | 0 |
| Pre-shot zones, distance | Pre-shot bands and their distance to the pivot in ticks | on, 8 |

### Filters and colours

| Setting | Role |
|---|---|
| Short, medium, long level | Levels shown |
| UE, UA, DE, DA | Types shown |
| Show broken ones | Keep or hide broken divergences |
| UE, UA, DE, DA color | One colour per type |

### Display and alerts

| Setting | Study | Role |
|---|---|---|
| Dot at pivot B, radius | price | Marker on price |
| Triangle at pivot B, size, gap | pane | Marker on CVD |
| Marker → text gap, labels, size, bold | both | Text |
| Notify forming ones, confirmed ones | price | Desktop alerts |
| CVD style, axes, candle colors | pane | Cumulative delta drawing |
| Wicks (session tape) | pane | Candle wicks, where the tape covers the bar |

### Suggested tuning

- Too many lines in 1 minute: "Min CVD gap" around 250 contracts on ES, or "Min relative strength" at 0.5 which works for every instrument, or untick "Short level".
- To see only what worked: untick "Show broken ones".
- Settings are stored per chart type, not per instrument: a contract threshold tuned for ES will be too high for NQ.

## Known limits

- A session joined late is hidden until its end. With the RTH anchor its RTH part comes back from 09:30: an NQ chart loaded from 03:21 keeps its CVD and divergences of the New York session.
- Hole thresholds follow Turning Trade's on minute charts. On tick, volume or range charts, with no bar duration, only a hole of more than one hour is seen.
- The first time a very long CVD session shows (fine tick chart, ETH anchor), reading it from the anchor spreads over a few frames, with nothing drawn meanwhile.
