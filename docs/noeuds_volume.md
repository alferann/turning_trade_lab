# Nœuds du profil de volume · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses nœuds dépendent du profil chargé et de seuils qui restent des conventions. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du profil et du graphe. Elle propose, vous décidez.

## En deux mots

Les panneaux de profil de volume de Turning Trade (SVP pour la séance, CVP pour la fenêtre visible, CMP pour le composite de N séances) montrent où le volume s'est échangé. L'étude lit ces mêmes profils, rangée par rangée, et y repère quatre formes : les **HVN**, sommets où le marché a accepté le prix ; les **LVN**, creux qu'il a traversés vite ; les **ledges**, ruptures nettes où le volume tombe d'un coup ; les **shelves**, paliers plats adossés à un ledge. Elle les trace en zones horizontales sur le graphe, étiquetées au bord droit.

## Un peu de maths

**Le profil.** Celui du panneau, tel que TT le construit : le volume de chaque rangée, une rangée regroupant un ou plusieurs ticks pour que le profil tienne en 320 rangées environ (ES sur une séance : 0,5 point ; composite de 90 séances : 2,5 points). Les prix sans volume comptent pour zéro. Les seuils se comptent en rangées, ce qui garde la même lecture d'un panneau à l'autre.

**Lissage.** Moyenne glissante triangulaire sur L rangées de chaque côté, pour qu'une rangée isolée ne fabrique pas de nœud. HVN, LVN et shelves se lisent sur le profil lissé, les ledges sur le profil brut.

**HVN.** Un sommet local dont la proéminence, sa hauteur au-dessus du plus haut des deux cols qui le séparent d'un sommet plus haut, atteint X % du volume du POC. La zone va jusqu'à mi-proéminence, à travers les petites bosses, sans passer le col qui la sépare d'un autre HVN ni atteindre un LVN.

**LVN.** Un creux local dont les deux murs, le plus haut volume de chaque côté avant de retomber sous le creux, valent au moins M fois le creux, avec au moins 10 % du volume du POC d'écart. La zone va jusqu'à mi-profondeur, avec les mêmes bornes. Une plage de prix sans aucun volume est le LVN par excellence.

**Ledge.** À chaque limite entre deux rangées, le volume moyen des k rangées de dessous contre celui des k rangées de dessus. Ledge quand le côté épais vaut au moins R fois le côté mince et porte au moins 25 % du volume de la rangée la plus chargée ; on garde le meilleur rapport à k rangées près. *Ledge haut* : l'épais est dessous, le profil s'amincit au-dessus. *Ledge bas* : l'inverse.

**Shelf.** Depuis chaque ledge, côté épais, tant que le profil reste plat : l'écart entre la plus haute et la plus basse rangée du palier ne dépasse pas T % de leur moyenne. Shelf s'il fait au moins H rangées et porte en moyenne 25 % du volume du POC. Un palier bordé de deux ledges n'en fait qu'un.

## À quoi ça sert

Un HVN est un prix accepté : le marché y a passé du temps et du volume, il a tendance à y ralentir, à y tourner, à y revenir. Un LVN est un prix refusé ou traversé : peu de contrepartie, le marché le traverse vite ou s'y retourne net. Un ledge marque le bord d'une zone d'acceptation : tant qu'il tient, le prix reste dans l'épais ; s'il cède, le prix a de bonnes chances de traverser vite le côté mince jusqu'à la zone épaisse suivante. Un shelf est la zone épaisse et plate adossée à ce bord, souvent défendue.

Pour la décision : chercher les réactions aux bords (ledges, bords d'un HVN) plutôt qu'au milieu d'un HVN où le prix tourne ; garder en tête qu'un LVN cassé se traverse souvent d'un trait, ce qui fait une cible, ou une alerte pour un stop posé dedans. Des nœuds de profils différents (séance et composite) au même prix pèsent plus qu'un seul.

## Lire le graphe

- **HVN** : zone orange et trait plein au sommet.
- **LVN** : zone violette et trait en tirets au fond du creux.
- **Ledge** : trait bleu clair épais à la limite des deux rangées, étiqueté `Ledge haut` ou `Ledge bas`.
- **Shelf** : zone verte, du ledge au bout du palier.
- **Étiquettes** au bord droit, suivies de `· SVP`, `· CVP` ou `· CMP 90` quand plusieurs profils sont suivis ; une étiquette trop proche de la précédente saute.
- Sans panneau ouvert, un message gris en haut à gauche le dit.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Profil analysé | Les panneaux de profil ouverts sur le graphe (deux panneaux de même portée n'en font qu'un), ou une portée imposée même sans panneau : séance, fenêtre visible, composite (nombre de séances de son panneau s'il existe, sinon 90) | panneaux ouverts |
| Lissage (rangées) | L ; 0 pour le profil brut | 2 |
| Opacité des zones | Remplissage ; 0 pour des traits seuls | 0,10 |
| Étiquettes | Noms des nœuds au bord droit | cochée |
| **HVN** | Case à cocher : affiche les HVN | cochée |
| Proéminence mini (% du POC) | X : plus haut, seules les vraies distributions restent | 15 |
| **LVN** | Case à cocher : affiche les LVN | cochée |
| Murs mini (× le creux) | M : plus haut, seuls les creux profonds restent | 2 |
| **Ledges** | Case à cocher : affiche les ledges | cochée |
| Rapport mini côté épais / côté mince | R : plus haut, seules les ruptures franches restent | 2 |
| Rangées comparées de chaque côté | k : plus grand, des ruptures plus larges et moins nombreuses | 3 |
| **Shelves** | Case à cocher : affiche les shelves, calculés même ledges masqués | cochée |
| Hauteur mini (rangées) | H | 4 |
| Écart toléré sur le palier (%) | T : plus haut, des paliers plus longs et moins plats | 25 |

Chaque sous-section finit par sa couleur : orange, violet, bleu clair, vert par défaut.

### Limites connues

- L'étude lit les panneaux par une interface interne de TT (`HFQVPPanels`, `caVppBundle`, `fpVppBundle`) : une mise à jour de TT peut la casser, le message « profil de volume indisponible sur ce graphe » le signale.
- Seuils en rangées : un même réglage donne des nœuds plus larges en prix sur un composite que sur une séance. Les seuils de 10 % et 25 % sont fixes.
- Le composite se recalcule une fois par séance du graphe, une seule fois par graphe sur le footprint qui ne date pas ses barres. TT met environ 0,6 s à le construire sur 90 séances : le premier affichage peut marquer un temps. Pendant que l'historique en ticks se remplit, il se recalcule aussi, mais au plus une fois par minute.
- En direct, le profil suit la barre en cours au plus toutes les 300 ms, et une image sur deux au plus recalcule un profil, pour rester sous le budget de 8 ms par image : les nœuds peuvent avoir une image de retard.
- Les nœuds sont ceux du profil entier, sur toute la largeur du graphe : l'étude ne dit pas quand un nœud s'est formé ni s'il a déjà été retesté.

---

# Volume profile nodes · getting started

> **Disclaimer.** This study is a tool in constant evolution: it is not perfect, its nodes depend on the loaded profile and on thresholds that remain conventions. It never replaces your own judgment or your visual reading of the profile and the chart. It suggests, you decide.

## In short

Turning Trade's volume profile panels (SVP for the session, CVP for the visible window, CMP for the N-session composite) show where volume traded. The study reads those same profiles, row by row, and finds four shapes: **HVN**, peaks where the market accepted price; **LVN**, troughs it went through fast; **ledges**, sharp breaks where volume drops at once; **shelves**, flat plateaus backed by a ledge. It draws them as horizontal zones on the chart, labelled at the right edge.

## A bit of math

**The profile.** The panel's own, as TT builds it: the volume of each row, a row grouping one or more ticks so that the profile fits in about 320 rows (ES over a session: 0.5 point; 90-session composite: 2.5 points). Prices without volume count as zero. Thresholds are counted in rows, which keeps the same reading from one panel to another.

**Smoothing.** Triangular moving average over L rows on each side, so that a single row does not make a node. HVN, LVN and shelves are read on the smoothed profile, ledges on the raw one.

**HVN.** A local peak whose prominence, its height above the higher of the two cols separating it from a higher peak, reaches X % of the POC volume. The zone runs to half prominence, through minor bumps, without crossing the col to another HVN or reaching an LVN.

**LVN.** A local trough whose two walls, the highest volume on each side before falling back below the trough, are at least M times the trough, at least 10 % of the POC volume above it. The zone runs to half depth, with the same bounds. A price range with no volume at all is the LVN par excellence.

**Ledge.** At each boundary between two rows, the mean volume of the k rows below against the k rows above. A ledge when the thick side is at least R times the thin side and carries at least 25 % of the busiest row's volume; the best ratio within k rows is kept. *Upper ledge*: thick below, the profile thins out above. *Lower ledge*: the reverse.

**Shelf.** From each ledge, on the thick side, as long as the profile stays flat: the spread between the highest and lowest row of the plateau stays within T % of their mean. A shelf if it spans at least H rows and averages 25 % of the POC volume. A plateau bounded by two ledges counts once.

## What it is for

An HVN is an accepted price: the market spent time and volume there, it tends to slow down, rotate and come back. An LVN is a rejected or skipped price: little liquidity, the market crosses it fast or turns sharply. A ledge marks the edge of an acceptance area: while it holds, price stays in the thick part; when it gives way, price is likely to cross the thin side quickly to the next thick area. A shelf is the flat thick area backed by that edge, often defended.

For the decision: look for reactions at the edges (ledges, HVN edges) rather than in the middle of an HVN where price rotates; keep in mind that a broken LVN is often crossed in one go, which makes a target, or a warning for a stop placed inside it. Nodes from different profiles (session and composite) at the same price weigh more than one.

## Reading the chart

- **HVN**: orange zone and solid line at the peak.
- **LVN**: purple zone and dashed line at the bottom of the trough.
- **Ledge**: thick light blue line at the boundary between the two rows, labelled `Upper ledge` or `Lower ledge`.
- **Shelf**: green zone, from the ledge to the end of the plateau.
- **Labels** at the right edge, followed by `· SVP`, `· CVP` or `· CMP 90` when several profiles are followed; a label too close to the previous one is skipped.
- With no panel open, a grey message at the top left says so.

## Settings

| Setting | Role | Default |
|---|---|---|
| Profile analyzed | The profile panels open on the chart (two panels of the same scope count once), or a forced scope even without a panel: session, visible window, composite (its panel's session count if there is one, else 90) | open panels |
| Smoothing (rows) | L; 0 for the raw profile | 2 |
| Zone opacity | Fill; 0 for lines only | 0.10 |
| Labels | Node names at the right edge | checked |
| **HVN** | Checkbox: shows HVN | checked |
| Minimum prominence (% of POC) | X: higher keeps only real distributions | 15 |
| **LVN** | Checkbox: shows LVN | checked |
| Minimum walls (× the trough) | M: higher keeps only deep troughs | 2 |
| **Ledges** | Checkbox: shows ledges | checked |
| Minimum thick side / thin side ratio | R: higher keeps only clean breaks | 2 |
| Rows compared on each side | k: larger gives wider, fewer breaks | 3 |
| **Shelves** | Checkbox: shows shelves, computed even with ledges hidden | checked |
| Minimum height (rows) | H | 4 |
| Tolerated spread on the plateau (%) | T: higher gives longer, less flat plateaus | 25 |

Each sub-section ends with its colour: orange, purple, light blue, green by default.

### Known limits

- The study reads the panels through an internal TT interface (`HFQVPPanels`, `caVppBundle`, `fpVppBundle`): a TT update may break it, and the message "volume profile unavailable on this chart" says so.
- Thresholds in rows: the same setting gives wider nodes in price on a composite than on a session. The 10 % and 25 % thresholds are fixed.
- The composite is rebuilt once per chart session, only once per chart on the footprint, which does not date its bars. TT takes about 0.6 s to build it over 90 sessions: the first display may pause. While tick history fills in, it is rebuilt too, at most once a minute.
- Live, the profile follows the current bar at most every 300 ms, and at most one frame in two rebuilds a profile, to stay within TT's 8 ms per frame budget: nodes may lag by one frame.
- Nodes come from the whole profile and span the whole chart width: the study does not tell when a node formed or whether it was already retested.
