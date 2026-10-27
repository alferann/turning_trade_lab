# Absorptions et reprises · prise en main

*English version below.*

> **Avertissement.** Ces deux études sont des outils en évolution permanente : elles ne sont pas parfaites, leurs seuils se calent sur les barres chargées et la tape reçue. Elles ne remplacent en aucun cas votre propre jugement ni votre lecture visuelle du footprint. Elles proposent, vous décidez.

## En deux mots

Deux études dans le même fichier, sur bougies et footprint.

- **Absorptions** repère les endroits où l'agression d'un camp a été encaissée par des ordres passifs sans faire avancer le prix, selon quatre signatures, et trace la zone absorbée jusqu'à ce qu'une clôture la traverse.
- **Reprises après absorption** marque la barre où le camp qui a absorbé reprend l'initiative : clôture au-delà de la barre d'absorption, avec un delta franc ou des déséquilibres empilés dans son sens.

**Haussière** : des vendeurs agressifs absorbés par des acheteurs passifs, au bas. **Baissière** : des acheteurs agressifs absorbés par des vendeurs passifs, au haut.

## Un peu de maths

Tout part des niveaux de chaque barre : volume au bid (vendeurs agressifs) et à l'ask (acheteurs agressifs) prix par prix. Delta = Σ ask − Σ bid. Les seuils sont **adaptatifs** : chaque barre est comparée à la médiane des N barres précédentes du même graphe (Mémoire), jamais à un nombre de lots écrit. Le même réglage tient donc sur ES, NQ, MES, en 1 min comme en 5 min.

| Signature | Condition (barre close) | Zone |
|---|---|---|
| Volume piégé à l'extrême (`ext`) | ask sur les Z ticks du haut ≥ k × médiane, clôture à au moins 25 % du range sous le haut (miroir au bas avec le bid) | les Z ticks de l'extrême |
| Effort sans résultat (`Δ`) | \|delta\| ≥ k × médiane des \|delta\|, et clôture à plat ou contre le delta | de l'extrême au prix le plus frappé |
| Niveau défendu (`niv`) | N tests en W barres : extrême dans une même étendue de prix, volume agressif sur l'extrême ≥ k × médiane, aucune clôture à travers | l'étendue testée |
| Tape (`tape`) | un palier (exécutions agressives d'un côté à un même prix) qui a tenu, plus gros que le quantile 1 − 1/N des 2000 derniers paliers | le prix du palier |

Un palier a **tenu** quand le même côté frappe ensuite un prix plus favorable à l'absorbeur : bid frappé à 7000,00 puis vendeurs à 7000,25, les acheteurs passifs de 7000,00 ont tenu. La tolérance du niveau défendu suit le range médian des barres (15 %, au moins un tick : 1 tick sur ES en 1 min, 6 sur NQ).

Une reprise est la première des N barres suivant l'absorption qui clôture au-delà de l'extrême opposé de la barre d'absorption (au-dessus du haut pour une haussière) et montre un delta ≥ k × médiane dans son sens **ou** au moins K déséquilibres diagonaux consécutifs (ask d'un prix ≥ ratio × bid du tick du dessous pour l'achat). Si une clôture traverse la zone d'abord, l'absorption est morte et il n'y a pas de reprise.

## À quoi ça sert

Une absorption montre où un intervenant passif a tenu face à l'agression : souvent un support ou une résistance de court terme, parfois le début d'un retournement. Seule, elle ne donne pas de sens : l'absorbeur peut céder plus tard. La reprise ajoute la preuve que son camp passe à l'offensive.

Ce que ça change pour la décision : une zone précise pour attendre le prix ou placer un stop derrière, et un déclencheur (la reprise) plutôt qu'une anticipation. Une zone que le prix retraverse en clôture est invalidée : elle cesse de se prolonger.

Ordres de grandeur mesurés sur quatre séances ETH (13 au 16/10/2026, 1 min, réglages par défaut) : environ 40 absorptions et 21 reprises par séance sur ES comme sur NQ ; sur la tape ES, 3 à 4 paliers retenus par heure, de 180 à 400 lots. Ce sont des fréquences, pas des taux de réussite.

## Lire le graphe

- **Zones** bleues (haussières) ou orange (baissières), de la barre d'absorption jusqu'à la clôture qui les traverse ou jusqu'à un trou dans les données, ou jusqu'au bord droit tant qu'elles tiennent.
- **Triangle creux** sous la barre (haussière) ou au-dessus (baissière), avec l'étiquette des signatures et leurs volumes : `ext 386`, `Δ 447`, `niv 1085`, plusieurs séparées par `·` quand elles tombent sur la même barre.
- **Cercle** au prix exact d'un palier de tape, étiqueté `tape 401`.
- **Triangle plein « R »** vert (reprise acheteuse) ou rose (vendeuse) sur la barre de reprise, relié en pointillé à son absorption.
- La barre en formation n'est jamais jugée : rien ne se repeint, une alerte ne sonne qu'une fois, à la clôture de la barre.

## Configurer

### Absorptions

Les réglages généraux, puis une sous-section par signature ouverte par sa case à cocher.

| Réglage | Rôle | Défaut |
|---|---|---|
| Mémoire (barres) | Nombre de barres précédentes pour les médianes ; rien n'est détecté avant la moitié | 100 |
| Absorption haussière / baissière | Couleurs | bleu / orange |
| Opacité des zones | Opacité du remplissage | 0,18 |
| Étiquettes | Signatures et volumes sous ou sur les marqueurs | cochée |
| Notification d'absorption | Notification de bureau à chaque nouvelle absorption | cochée |
| **Volume piégé à l'extrême** | Case à cocher de la signature | cochée |
| Volume mini (× médiane) | Seuil du volume agressif sur l'extrême | 5 |
| Ticks de l'extrême | Z, nombre de ticks comptés au haut et au bas | 2 |
| **Effort sans résultat** | Case à cocher de la signature | cochée |
| Delta mini (× médiane) | Seuil du \|delta\| | 3 |
| **Niveau défendu sur plusieurs barres** | Case à cocher de la signature | cochée |
| Tests mini | Nombre de tests qui font le signal | 3 |
| Volume d'un test (× médiane) | Volume agressif minimal sur l'extrême pour compter un test | 2,5 |
| Fenêtre (barres) | Les tests doivent tenir dans cette fenêtre | 15 |
| **Absorption sur la tape (proxy iceberg)** | Case à cocher de la signature | cochée |
| Rareté (1 palier sur N) | Ne garde que les paliers plus gros que le quantile 1 − 1/N | 1000 |

### Reprises après absorption

Les réglages de détection des absorptions sont relus dans l'étude Absorptions, même masquée.

| Réglage | Rôle | Défaut |
|---|---|---|
| Fenêtre après l'absorption (barres) | Délai maximal de la reprise | 10 |
| Clôture au-delà de la barre d'absorption | Exige la cassure de l'extrême opposé | cochée |
| Delta et déséquilibres | L'un ou l'autre, ou les deux exigés | l'un ou l'autre |
| Reprise acheteuse / vendeuse | Couleurs | vert / rose |
| Étiquettes | « R » sous ou sur le marqueur | cochée |
| Notification de reprise | Notification de bureau à chaque nouvelle reprise | cochée |
| **Delta franc** | Case à cocher du critère | cochée |
| Delta mini (× médiane) | Delta minimal dans le sens de la reprise | 1 |
| **Déséquilibres empilés** | Case à cocher du critère | cochée |
| Rapport de déséquilibre (×) | Ratio diagonal d'un déséquilibre | 3 |
| Déséquilibres consécutifs mini | K | 3 |

Sans delta ni déséquilibres cochés, la cassure seule suffit ; sans rien de coché, la barre suivante confirme toujours.

### Limites connues

- **La tape n'est lue qu'en direct**, sur la séance en cours : aucun historique de tape n'existe dans TT. Pendant le rattrapage d'une séance chargée, l'étude affiche « lecture de la tape » quelques secondes.
- **Proxy d'iceberg, pas un iceberg.** HFQExt ne donne pas les tailles du carnet : l'étude voit un gros volume exécuté à un prix qui a tenu, pas un ordre qui se recharge au-delà de ce qu'il affichait. Les pastilles iceberg du ladder, qui lisent le carnet, restent la référence.
- Les déséquilibres sont plus fréquents sur un instrument aux niveaux minces (NQ) : un ask de 3 contre un bid de 0 compte. Pas de volume minimal par niveau.
- « Ticks de l'extrême » reste en ticks : sur NQ, où une barre d'une minute couvre une quarantaine de ticks, 4 à 8 ticks peuvent mieux convenir.
- Les seuils démarrent après la moitié de la Mémoire : les 50 premières barres du graphe ne donnent rien. Les barres sans niveaux et le blanc dont TT comble un jour absent n'entrent ni dans les médianes ni dans la détection.
- **Rien ne tient à travers un trou.** Le blanc dont TT comble un jour absent, ou un jour ouvré manquant entre deux séances chargées (graphe en ticks, footprint), arrête les zones encore ouvertes et les fenêtres de reprise, et efface les tests d'un niveau défendu : on ne sait pas ce que le prix a fait pendant. Les jours fériés ne sont pas connus et comptent comme manquants : le lendemain d'une fermeture complète (Vendredi saint, Noël, Jour de l'an), les zones de la veille s'arrêtent à l'ouverture.
- La détection attend la clôture : un signal arrive à la clôture de sa barre, jamais pendant (sauf la tape, jugée dès que le prix quitte le palier).

---

# Absorptions and resumptions · getting started

> **Warning.** Both studies are tools in constant evolution: they are not perfect, their thresholds follow the bars loaded and the tape received. They never replace your own judgment or your visual reading of the footprint. They suggest, you decide.

## In short

Two studies in the same file, on candles and footprint.

- **Absorptions** spots where one side's aggression was absorbed by passive orders without moving price, through four signatures, and draws the absorbed zone until a close crosses it.
- **Resumptions after absorption** marks the bar where the absorbing side takes the initiative back: a close beyond the absorption bar, with a strong delta or stacked imbalances in its direction.

**Bullish**: aggressive sellers absorbed by passive buyers, at the low. **Bearish**: aggressive buyers absorbed by passive sellers, at the high.

## A bit of math

Everything starts from each bar's levels: volume at the bid (aggressive sellers) and at the ask (aggressive buyers), price by price. Delta = Σ ask − Σ bid. Thresholds are **adaptive**: each bar is compared with the median of the previous N bars of the same chart (Memory), never with a written number of lots. The same setting therefore holds on ES, NQ, MES, on 1 min as on 5 min.

| Signature | Condition (closed bar) | Zone |
|---|---|---|
| Volume trapped at the extreme (`ext`) | ask on the top Z ticks ≥ k × median, close at least 25 % of the range below the high (mirrored at the low with the bid) | the Z extreme ticks |
| Effort without result (`Δ`) | \|delta\| ≥ k × median \|delta\|, and close flat or against the delta | from the extreme to the most hit price |
| Level defended (`lvl`) | N tests in W bars: extreme within the same price span, aggressive volume on the extreme ≥ k × median, no close through | the tested span |
| Tape (`tape`) | a run (aggressive executions on one side at one price) that held, larger than the 1 − 1/N quantile of the last 2000 runs | the run's price |

A run **held** when the same side then hits a price better for the absorber: bid hit at 7000.00 then sellers at 7000.25, the passive buyers at 7000.00 held. The defended level's tolerance follows the median bar range (15 %, at least one tick: 1 tick on ES at 1 min, 6 on NQ).

A resumption is the first of the N bars after the absorption that closes beyond the opposite extreme of the absorption bar (above the high for a bullish one) and shows a delta ≥ k × median in its direction **or** at least K consecutive diagonal imbalances (ask at a price ≥ ratio × bid one tick below, for buying). If a close crosses the zone first, the absorption is dead and there is no resumption.

## What it is for

An absorption shows where a passive participant held against aggression: often short-term support or resistance, sometimes the start of a reversal. On its own it gives no direction: the absorber may give way later. The resumption adds the proof that its side goes on the offensive.

What it changes for the decision: a precise zone to wait for price or to place a stop behind, and a trigger (the resumption) rather than an anticipation. A zone that price closes back through is invalidated: it stops extending.

Orders of magnitude measured on four ETH sessions (Oct 13 to 16, 2026, 1 min, default settings): about 40 absorptions and 21 resumptions per session on ES as on NQ; on the ES tape, 3 to 4 runs kept per hour, from 180 to 400 lots. These are frequencies, not hit rates.

## Reading the chart

- **Zones**, blue (bullish) or orange (bearish), from the absorption bar to the close that crosses them or to a gap in the data, or to the right edge while they hold.
- **Hollow triangle** below the bar (bullish) or above (bearish), labelled with the signatures and their volumes: `ext 386`, `Δ 447`, `lvl 1085`, several joined by `·` when they fall on the same bar.
- **Circle** at the exact price of a tape run, labelled `tape 401`.
- **Filled "R" triangle**, green (buying resumption) or pink (selling), on the resumption bar, linked by a dotted line to its absorption.
- The forming bar is never judged: nothing repaints, an alert sounds once, at the bar's close.

## Settings

### Absorptions

General settings, then one subsection per signature opened by its checkbox.

| Setting | Role | Default |
|---|---|---|
| Memory (bars) | Number of previous bars for the medians; nothing is detected before half of it | 100 |
| Bullish / bearish absorption | Colours | blue / orange |
| Zone opacity | Fill opacity | 0.18 |
| Labels | Signatures and volumes under or over the markers | checked |
| Absorption notification | Desktop notification for each new absorption | checked |
| **Volume trapped at the extreme** | Signature checkbox | checked |
| Minimum volume (× median) | Threshold of the aggressive volume on the extreme | 5 |
| Ticks at the extreme | Z, number of ticks counted at the high and the low | 2 |
| **Effort without result** | Signature checkbox | checked |
| Minimum delta (× median) | \|delta\| threshold | 3 |
| **Level defended over several bars** | Signature checkbox | checked |
| Minimum tests | Number of tests that make the signal | 3 |
| Volume of a test (× median) | Minimum aggressive volume on the extreme to count a test | 2.5 |
| Window (bars) | The tests must fit in this window | 15 |
| **Absorption on the tape (iceberg proxy)** | Signature checkbox | checked |
| Rarity (1 run in N) | Keeps only runs larger than the 1 − 1/N quantile | 1000 |

### Resumptions after absorption

The absorption detection settings are read from the Absorptions study, even when hidden.

| Setting | Role | Default |
|---|---|---|
| Window after the absorption (bars) | Maximum delay of the resumption | 10 |
| Close beyond the absorption bar | Requires the break of the opposite extreme | checked |
| Delta and imbalances | Either one, or both required | either one |
| Buying / selling resumption | Colours | green / pink |
| Labels | "R" under or over the marker | checked |
| Resumption notification | Desktop notification for each new resumption | checked |
| **Strong delta** | Criterion checkbox | checked |
| Minimum delta (× median) | Minimum delta in the resumption's direction | 1 |
| **Stacked imbalances** | Criterion checkbox | checked |
| Imbalance ratio (×) | Diagonal ratio of an imbalance | 3 |
| Minimum consecutive imbalances | K | 3 |

With neither delta nor imbalances checked, the break alone is enough; with nothing checked, the next bar always confirms.

### Known limits

- **The tape is read live only**, on the current session: TT keeps no tape history. While a loaded session is caught up, the study shows "reading the tape" for a few seconds.
- **An iceberg proxy, not an iceberg.** HFQExt gives no book sizes: the study sees a large volume executed at a price that held, not an order refilling beyond what it displayed. The ladder's iceberg dots, which read the book, remain the reference.
- Imbalances are more frequent on an instrument with thin levels (NQ): an ask of 3 against a bid of 0 counts. No minimum volume per level.
- "Ticks at the extreme" stays in ticks: on NQ, where a one-minute bar spans about forty ticks, 4 to 8 ticks may suit better.
- Thresholds start after half of the Memory: the first 50 bars of the chart give nothing. Bars without levels and the blank TT fills a missing day with enter neither the medians nor the detection.
- **Nothing holds through a gap.** The blank TT fills a missing day with, or a weekday missing between two loaded sessions (tick chart, footprint), ends the zones still open and the resumption windows, and clears the tests of a defended level: what price did meanwhile is unknown. Holidays are not known and count as missing: the day after a full closure (Good Friday, Christmas, New Year's Day), the previous day's zones end at the open.
- Detection waits for the close: a signal comes at its bar's close, never during it (except the tape, judged as soon as price leaves the run).
