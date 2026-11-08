# Bougies hors bande VWAP · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des données que le graphe a chargées. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Sur un graphe en bougies, l'étude fait disparaître toutes les bougies qui touchent la bande comprise entre deux écarts-types de la VWAP journalière ou RTH (−1σ et +1σ par défaut), ne serait-ce que par une mèche. Seules restent visibles les bougies entièrement hors de la bande. Elle envoie aussi une notification à chaque clôture de barre au-delà d'un écart que vous choisissez, VWAP comprise.

## Un peu de maths

La VWAP d'une période est la moyenne des prix pondérée par le volume, cumulée depuis le début de la période : VWAP = Σ(p·v) / Σv. L'écart-type σ est celui des prix autour de la VWAP, pondéré de la même façon : σ = √(Σ(p²·v) / Σv − VWAP²). Le prix de chaque échange vient des niveaux du footprint quand la barre en a, sinon du prix typique (H+L+C)/3 de la barre. Les valeurs sont celles de VWAP Pro sur les mêmes ancrages.

Une bougie est masquée quand son bas est sous la borne haute et son haut au-dessus de la borne basse, égalité comprise. Avec deux bornes à 0, la bande se réduit à la VWAP : disparaissent les bougies qui la touchent.

## À quoi ça sert

Entre −1σ et +1σ, le prix est dans sa zone d'équilibre de la journée : c'est là qu'il passe le plus de temps, et c'est souvent du bruit. En masquant ces bougies, il ne reste à l'écran que les excursions hors de la valeur, celles qui peuvent annoncer une extension ou un retour à la moyenne. Les alertes préviennent quand une barre clôture au-delà d'un écart, sans devoir surveiller le graphe.

Ce que ça change pour la décision : un graphe épuré qui met en avant les sorties de la zone de valeur, et un signal à la clôture plutôt qu'au premier tick. Une clôture au-delà de +2σ n'est ni un achat ni une vente : c'est un fait à replacer dans votre lecture.

## Lire le graphe

- **Bougies visibles** : entièrement au-dessus de la borne haute ou au-dessous de la borne basse.
- **Espace vide** : une bougie masquée. Le fond du graphe est repeint par-dessus, dégradé compris.
- **Trait orange plein** : la VWAP. **Tirets bleus** : les deux bornes du masque.
- **Rien de masqué, aucun trait** : la période n'est pas chargée depuis son début (voir les limites).

Une notification indique l'instrument, l'ancrage, le niveau franchi et le prix de clôture, par exemple « ES · DVWAP — Clôture au-dessus de +2σ : 6850.25 ».

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Ancrage | Journalier (séance du graphe, 18:00 ET en ETH) ou séance US (RTH, 09:30 à 16:00 ET selon les sessions de TT) | Journalier |
| Source du prix | Footprint sinon (H+L+C)/3, (H+L+C)/3 × volume, ou clôture × volume | Footprint |
| Masquer les bougies dans la bande | Allume ou éteint le masque | cochée |
| Borne haute, borne basse | Les deux écarts qui délimitent la bande, en multiples de σ, de −6 à +6, dans n'importe quel ordre ; 0 = la VWAP | +1 et −1 |
| Tracer la VWAP, Couleur | La VWAP par-dessus le masque | cochée, orange |
| Tracer les bornes, Couleur | Les deux bornes en tirets | cochée, bleu |
| Alertes à la clôture | Allume ou éteint les notifications | cochée |
| Réarmement (ticks) | Après une alerte sur un niveau, la suivante sur ce même niveau attend une clôture revenue d'au moins N ticks de l'autre côté ; 0 = dès qu'une clôture repasse du côté de la VWAP | 2 |
| Niveau 1 à 6, Multiplicateur | Jusqu'à six écarts surveillés, chacun des deux côtés de la VWAP ; 0 = la VWAP, franchie dans les deux sens | 1, 2, 3 cochés ; 0, 1,5, 2,5 décochés |

### Les alertes

- Un niveau +nσ sonne quand une barre **clôture au-dessus**, un niveau −nσ quand elle **clôture au-dessous**. La VWAP sonne dans les deux sens.
- Un niveau n'est armé qu'après une clôture du côté de la VWAP : la première clôture d'une période ne déclenche rien.
- Rien ne sonne pour l'historique chargé à l'ouverture du graphe, ni pour les barres qu'un saut de replay enjambe. En replay qui avance barre par barre, les alertes sonnent comme en direct.
- Sur un graphe d'une minute avec quatre niveaux (VWAP, ±1σ, ±2σ, ±3σ), une séance d'ES peut donner plusieurs dizaines de notifications : relevez le réarmement ou retirez des niveaux si c'est trop.
- Les notifications passent par le système (Mako sous Hyprland). Le navigateur demande la permission la première fois.

### Limites connues

- Graphes en bougies japonaises seulement. En Heikin Ashi, les bougies dessinées ne suivent pas l'OHLC réel et le masque peut en laisser dépasser.
- Le masque repeint le fond : tout ce que TT et les études chargées avant celle-ci dessinent sur une bougie masquée disparaît avec elle (VWAP native, grille, marques, zones d'absorption). Les études chargées après restent visibles : les fichiers se chargent par ordre alphabétique, et un fichier enregistré dans l'Éditeur d'études passe en dernier.
- Une période que le graphe ne prend pas dans l'heure qui suit son début (graphe en ticks qui commence au milieu d'une séance) n'est ni masquée ni surveillée, et une barre de comblement arrête tout jusqu'à la période suivante. Pas de complément par le fichier minute, contrairement à VWAP Pro.
- Les niveaux d'alerte ne sont pas tracés : allumez VWAP Pro sur le même ancrage pour les voir, il donne les mêmes valeurs.

---

# Candles outside VWAP band · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the data the chart has loaded. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

On a candlestick chart, the study hides every candle that touches the band between two standard deviations of the daily or RTH VWAP (−1σ and +1σ by default), even by a wick. Only the candles fully outside the band stay visible. It also sends a notification on every bar close beyond a deviation you choose, the VWAP included.

## A little math

The VWAP of a period is the volume-weighted average price, accumulated from the start of the period: VWAP = Σ(p·v) / Σv. The standard deviation σ is that of prices around the VWAP, weighted the same way: σ = √(Σ(p²·v) / Σv − VWAP²). Each trade price comes from the footprint levels when the bar has them, else from the bar's typical price (H+L+C)/3. The values are VWAP Pro's on the same anchors.

A candle is hidden when its low is below the upper bound and its high above the lower bound, equality included. With both bounds at 0, the band shrinks to the VWAP: the candles touching it disappear.

## What it is for

Between −1σ and +1σ, price is in the day's balance area: it spends most of its time there, and it is often noise. Hiding those candles leaves on screen only the excursions out of value, the ones that may announce an extension or a mean reversion. The alerts tell you when a bar closes beyond a deviation, without watching the chart.

What it changes for the decision: a cleaner chart that highlights moves out of the value area, and a signal on the close rather than on the first tick. A close beyond +2σ is neither a buy nor a sell: it is a fact to place in your own reading.

## Reading the chart

- **Visible candles**: fully above the upper bound or below the lower bound.
- **Empty space**: a hidden candle. The chart background is painted over it, gradient included.
- **Solid orange line**: the VWAP. **Blue dashes**: the two bounds of the mask.
- **Nothing hidden, no line**: the period is not loaded from its start (see limits).

A notification gives the instrument, the anchor, the level crossed and the close, for instance "ES · DVWAP — Close above +2σ: 6850.25".

## Settings

| Setting | Role | Default |
|---|---|---|
| Anchoring | Daily (chart session, 18:00 ET on ETH) or US session (RTH, 09:30 to 16:00 ET from TT's sessions) | Daily |
| Price source | Footprint else (H+L+C)/3, (H+L+C)/3 × volume, or close × volume | Footprint |
| Hide candles in the band | Turns the mask on or off | checked |
| Upper bound, lower bound | The two deviations that bound the band, in multiples of σ, from −6 to +6, in any order; 0 = the VWAP | +1 and −1 |
| Draw the VWAP, Color | The VWAP on top of the mask | checked, orange |
| Draw the bounds, Color | The two bounds, dashed | checked, blue |
| Close alerts | Turns the notifications on or off | checked |
| Re-arm (ticks) | After an alert on a level, the next one on that level waits for a close back at least N ticks on the other side; 0 = as soon as a close is back on the VWAP side | 2 |
| Level 1 to 6, Multiplier | Up to six watched deviations, each on both sides of the VWAP; 0 = the VWAP, crossed both ways | 1, 2, 3 checked; 0, 1.5, 2.5 unchecked |

### Alerts

- A +nσ level rings when a bar **closes above** it, a −nσ level when a bar **closes below** it. The VWAP rings both ways.
- A level is armed only after a close on the VWAP side: the first close of a period triggers nothing.
- Nothing rings for the history loaded when the chart opens, nor for the bars a replay jump skips. In a replay stepping bar by bar, alerts ring as in live.
- On a one-minute chart with four levels (VWAP, ±1σ, ±2σ, ±3σ), an ES session can give several dozen notifications: raise the re-arm or remove levels if that is too many.
- Notifications go through the system (Mako under Hyprland). The browser asks for permission the first time.

### Known limits

- Candlestick charts only. On Heikin Ashi, the drawn candles do not follow the real OHLC and the mask may leave parts showing.
- The mask paints the background: anything TT and the studies loaded before this one draw on a hidden candle disappears with it (native VWAP, grid, marks, absorption zones). Studies loaded after stay visible: files load in alphabetical order, and a file saved in the Study editor goes last.
- A period the chart does not take within an hour of its start (a tick chart starting mid-session) is neither masked nor watched, and a filler bar stops everything until the next period. No completion from the minute file, unlike VWAP Pro.
- Alert levels are not drawn: turn on VWAP Pro on the same anchor to see them, it gives the same values.
