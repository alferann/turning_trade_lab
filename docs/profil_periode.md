# Profil de volume par période · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent des barres chargées dans le graphe. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le profil de volume de la séance du graphe, de la séance US (RTH), Asie ou Europe, de la semaine ou du mois, sur le graphe en bougies ou le footprint. Chaque rangée montre les acheteurs et les vendeurs bout à bout, plus pâles hors de l'aire de valeur, ou le volume total coloré par l'aire de valeur. Le POC et les bornes de l'aire de valeur (VAH, VAL) sont tracés en lignes, leur prix écrit à gauche. La période en cours se colle au bord droit ou se pose sur ses barres ; les périodes précédentes se posent sur les leurs. Quatre instances (A à D) permettent de superposer plusieurs profils, par exemple la séance, la semaine et le mois.

## Un peu de maths

Pour chaque prix p au tick près, A(p) et V(p) sont les sommes, sur les barres de la période, du volume pris à l'ask (acheteurs agresseurs) et au bid (vendeurs agresseurs) à ce prix, lus sur les niveaux de chaque barre. Le volume du prix est A(p) + V(p). Le **POC** est le prix où il est maximal. L'**aire de valeur** part du POC et s'étend tick par tick du côté du voisin le plus fourni, jusqu'à contenir la part choisie du volume total (70 % par défaut) ; **VAL** et **VAH** en sont le bas et le haut. Les ex aequo se tranchent comme chez TT : le POC le plus bas, puis le côté haut d'abord. Sur les séances ES chargées, POC, VAH et VAL sont identiques à ceux du profil de séance (SVP) de TT, et le banc d'essai le vérifie.

Les séances US, Asie et Europe suivent les sessions monde de TT (modifiables dans TT), sinon Asie 18:00 New York, Europe 08:00 Londres, US 09:30 à 16:00 New York, chacune courant jusqu'à la suivante. La semaine est la semaine ISO (lundi à vendredi), le mois le mois civil ; les séances s'y rangent par leur date de séance.

## À quoi ça sert

Le profil montre où le marché a accepté de traiter longtemps (rangées épaisses) et où il est passé vite (rangées minces). Le partage acheteurs / vendeurs dit qui a pris l'initiative à chaque prix : une rangée épaisse dominée par les vendeurs en haut de profil, c'est de l'offre qui a tenu ; dominée par les acheteurs en bas, de la demande qui a tenu. Le POC sert de juste valeur de la période et attire souvent le prix ; VAH et VAL bornent cette valeur. Un prix qui s'installe hors de l'aire de valeur cherche une nouvelle valeur ; un prix qui y rentre et s'y maintient signale un rejet de l'extérieur et vise souvent l'autre borne.

Ce que ça change pour la décision : comparer la séance du jour à la valeur de la veille, de la semaine ou du mois (dedans, au-dessus, en dessous), voir si la valeur migre d'une séance à l'autre, et placer cibles, stops et zones d'attente autour du POC et des bornes. Un niveau ne vaut que par la réaction du prix quand il l'atteint.

## Lire le graphe

- **Profil en cours** : collé au bord droit (la rangée la plus fournie prend la largeur réglée), ou posé sur les barres de sa période.
- **Profils précédents** : chacun sur les barres de sa période, adossé à sa première barre et tourné vers la droite, ou adossé à sa clôture et tourné vers le passé. Sa rangée la plus fournie prend une part réglable de la durée de la période.
- **Rangées empilées** : les acheteurs contre l'adossement (le bord droit, ou le bord de la période), les vendeurs au bout ; la longueur totale est le volume du prix. Hors de l'aire de valeur, les deux couleurs pâlissent ; la rangée du POC est cerclée de la couleur du POC.
- **Rangées en volume total** : rangée du POC, rangées de l'aire de valeur et reste, chacune avec sa couleur et son opacité.
- **Lignes** : POC en trait plein, VAH et VAL en tirets par défaut. Celles de la période en cours vont de son début (ou du bord gauche si elle a commencé hors écran) jusqu'au bord droit ; celles des périodes précédentes s'arrêtent à leur clôture.
- **Prix à gauche** : « dPOC 6712.25 », « wVAH … », « mVAL … » (séance, semaine, mois), « POC RTH », « VAH Asie », « VAL EU » pour les séances, écrits juste au-dessus de leur ligne, au bord gauche ou au début de la période.
- **Légende** en haut à droite, une ligne par instance : la période (« Séance 2026-10-16 », « Séance US 2026-10-16 », « Semaine 42 », « Mois 2026-10 »), puis, si la période en cours est incomplète, « masqué : » et la raison, affichées même étiquettes décochées : « partiel, depuis le … » quand le graphe ne charge pas la semaine ou le mois depuis son début, « partiel » quand une séance (du graphe, US, Asie, Europe) est prise en retard ou tronquée, « séance manquante ou incomplète le … » quand une séance de la semaine ou du mois manque, commence en retard ou s'arrête avant sa fin, « x % des barres sans niveaux » quand des barres n'ont pas de volume par prix. Une période incomplète n'est jamais dessinée.

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Période | Journalier (séance du graphe), Séance US (RTH), Séance Asie, Séance Europe, Hebdomadaire (semaine ISO), Mensuel | A : jour, B : semaine, C : mois, D : US |
| Périodes précédentes | Nombre de profils précédents dessinés sur leur période | 0 |
| Période en cours | Collée au bord droit, ou sur sa période | bord droit |
| Profils posés sur leur période | Depuis la première barre vers la droite, ou depuis la clôture vers la gauche | première barre |
| Calcul sur RTH seul (graphe ETH) | Séance, semaine, mois : ne compte que les barres de 09:30 à 16:00 New York | décochée |
| Value Area % | Part du volume total contenue dans l'aire de valeur | 70 |
| Largeur au bord droit (% du graphe) | Longueur de la rangée la plus fournie du profil collé au bord droit | 25 |
| Largeur sur la période (% de sa durée) | Longueur de la rangée la plus fournie d'un profil posé sur sa période | 60 |
| Largeur maximale (% du graphe) | Plafond de la rangée la plus fournie de tous les profils, collés au bord droit ou posés sur leur période : un mois posé sur sa période ne couvre plus tout le graphe | 100 |
| Ticks par rangée (0 = auto) | Regroupe les prix par rangées ; 0 : au moins 3 pixels par rangée, les ticks se regroupent quand on dézoome | 0 |
| **Histogramme** | Affiche ou masque les rangées | cochée |
| Affichage du volume | Acheteurs et vendeurs empilés, ou total coloré par la Value Area | empilés |
| Couleur et opacité acheteurs, vendeurs | Mode empilé | vert, rouge, 0,5 |
| Opacité relative hors Value Area | Mode empilé : part de leur opacité que gardent acheteurs et vendeurs hors de l'aire de valeur ; 1 n'atténue rien | 0,4 |
| Couleur et opacité hors Value Area, Value Area | Mode total | gris, bleu, 0,5 |
| Couleur et opacité rangée POC | Rangée du POC en mode total, son cadre en mode empilé | orange, 0,6 |
| **Ligne POC** | Affiche ou masque la ligne ; couleur, style (plein, tirets, pointillés, pointillés fins, tiret-point), épaisseur, opacité | orange, plein, 1,5 |
| **Lignes VAH et VAL** | Mêmes réglages, communs aux deux lignes | bleu, tirets, 1 |
| Étiquettes à gauche et légende | Prix des niveaux de la période en cours et légende | cochée |

### Limites connues

- **Volume lu sur les niveaux des barres.** Une barre sans niveaux n'est pas devinée : une période qui en contient n'est pas dessinée, et la légende donne la part des barres qui en manquent.
- **Lecture étalée.** Chaque séance close, et le fichier minute d'une complétion, se lisent sur plusieurs images à 4 ms chacune (une séance de NQ coûte 10 à 17 ms d'un bloc) : sur un historique lourd, le profil apparaît après quelques dizaines d'images. En direct, seule la dernière barre est relue.
- **Période partielle.** L'historique ES de TT commence le mardi 22 septembre 2026 : sur un graphe en ticks, qui ne remonte qu'à deux semaines environ et commence où il veut dans la séance, la première période du graphe (séance, séance US, Asie ou Europe, semaine, mois) dont le début n'est pas chargé est complétée par les barres d'une minute que TT sert aux bougies (vingt séances glissantes), lues une fois à l'ouverture du graphe : le profil apparaît une fois qu'elles sont arrivées et lues, ce qui prend quelques images. Si elles ne la couvrent pas non plus (premier jour ouvré absent, séance entamée à plus d'une heure de son ouverture ou tronquée, deux jours ouvrés sans séance, arrêt plus d'une heure avant la première barre du graphe), la période n'est pas dessinée, en cours comme précédente, et la légende de la période en cours dit « masqué : partiel ». Un graphe en minutes vient déjà de ce fichier, et le footprint n'a pas de dates : il n'y a rien à compléter, la période est masquée. En fin de mois long, vingt séances peuvent ne plus remonter au 1er. Les jours fériés ne sont pas connus : une semaine ouverte par un lundi férié passe pour partielle si l'historique commence juste après.
- **Période incomplète.** Plus loin dans le graphe, une séance prise plus d'une heure après le début de sa fenêtre, ou tronquée (fenêtre finie dont la dernière barre tombe plus d'une heure avant sa fin et plus de 4 h avant la clôture de la séance, pour laisser passer les clôtures anticipées des jours fériés), n'est pas dessinée ; une semaine ou un mois qui contient une telle séance, un jour manquant (que TT marque d'un vide) ou un jour ouvré sans séance non plus. Les fermetures complètes du CME (Jour de l'An, Vendredi saint, Noël, reports compris) viennent du calendrier de Turning Trade et ne comptent pas comme des jours manquants ; les fériés à séance écourtée gardent leur séance. Seule la première période d'un graphe en ticks se complète par le fichier minute. Un trou au milieu d'une séance, sans vide marqué par TT, n'est pas détecté. Une session de TT qui enjambe l'ouverture du graphe (16:00 → 18:30 New York) est masquée après l'ouverture, faute de son début ; si elle commence pendant la pause de 17:00 à 18:00, l'ouverture la commence.
- **Séances US, Asie, Europe** : avant 09:30, la dernière séance US est celle de la veille ; elle est alors traitée comme la période en cours. Les heures se règlent dans les sessions monde de TT, pas dans l'étude.
- **Footprint** : ses barres ne sont pas datées ; seuls la séance du graphe et les séances US, Asie, Europe y sont disponibles, ces dernières avec l'heure d'été du jour.
- **Prix à gauche** pour la période en cours seulement ; les périodes précédentes n'ont que leurs lignes.
- **Premier affichage** d'une longue période ou d'un long historique : le calcul s'étale sur quelques images pour ne pas figer le graphe, les profils apparaissent une fraction de seconde après le reste.
- Le POC, VAH et VAL restent calculés au tick près quel que soit le regroupement des rangées.
- Pas de profil en delta (acheteurs moins vendeurs), pas de POC vierge prolongé.

---

# Period Volume Profile · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the bars loaded in the chart. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

The volume profile of the chart session, the US (RTH), Asian or European session, the week or the month, on the candlestick or footprint chart. Each row shows buyers and sellers end to end, paler outside the value area, or the total volume coloured by the value area. The POC and the value area bounds (VAH, VAL) are drawn as lines, their price written on the left. The current period is pinned to the right edge or set on its bars; previous periods are set on theirs. Four instances (A to D) let you stack several profiles, for instance the session, the week and the month.

## A bit of math

For each price p, to the tick, A(p) and V(p) are the sums over the period's bars of the volume taken at the ask (aggressive buyers) and at the bid (aggressive sellers) at that price, read from each bar's levels. The price's volume is A(p) + V(p). The **POC** is the price where it peaks. The **value area** starts at the POC and grows tick by tick towards the richer neighbour until it holds the chosen share of total volume (70 % by default); **VAL** and **VAH** are its low and high. Ties are broken as in TT: the lowest POC, then the upper side first. On the loaded ES sessions, POC, VAH and VAL are identical to TT's session volume profile (SVP), and the test bench checks it.

The US, Asian and European sessions follow TT's world sessions (editable in TT), else Asia 18:00 New York, Europe 08:00 London, US 09:30 to 16:00 New York, each running until the next one. The week is the ISO week (Monday to Friday), the month the calendar month; sessions fall into them by their session date.

## What it is for

The profile shows where the market accepted to trade for long (thick rows) and where it moved fast (thin rows). The buyers / sellers split tells who took the initiative at each price: a thick row dominated by sellers at the top of the profile is supply that held; dominated by buyers at the bottom, demand that held. The POC acts as the period's fair value and often draws price back; VAH and VAL bound that value. Price settling outside the value area is looking for new value; price coming back in and holding signals a rejection of the outside and often targets the other bound.

What it changes for the decision: comparing today's session with yesterday's, the week's or the month's value (inside, above, below), seeing whether value migrates from one session to the next, and placing targets, stops and waiting zones around the POC and the bounds. A level is only worth the price reaction when it gets there.

## Reading the chart

- **Current profile**: pinned to the right edge (the fullest row takes the set width), or set on its period's bars.
- **Previous profiles**: each on its period's bars, backed against its first bar and facing right, or against its close and facing the past. Its fullest row takes an adjustable share of the period's span.
- **Stacked rows**: buyers against the backing (the right edge, or the period's edge), sellers beyond; the total length is the price's volume. Outside the value area both colours fade; the POC row is outlined in the POC colour.
- **Total volume rows**: POC row, value area rows and the rest, each with its colour and opacity.
- **Lines**: POC solid, VAH and VAL dashed by default. The current period's lines run from its start (or the left edge if it started off screen) to the right edge; previous periods' lines stop at their close.
- **Prices on the left**: "dPOC 6712.25", "wVAH …", "mVAL …" (session, week, month), "POC RTH", "VAH Asia", "VAL EU" for the sessions, written just above their line, at the left edge or at the start of the period.
- **Caption** top right, one line per instance: the period ("Session 2026-10-16", "US session 2026-10-16", "Week 42", "Month 2026-10"), then, if the current period is incomplete, "hidden:" and the reason, shown even with labels off: "partial, since …" when the chart does not load the week or month from its start, "partial" when a session (chart, US, Asian, European) is joined late or cut short, "missing or incomplete session on …" when a session of the week or month is missing, starts late or stops before its end, "x % of bars without levels" when some bars carry no volume per price. An incomplete period is never drawn.

## Settings

Labels below are those shown when Turning Trade is set to English.

| Setting | Role | Default |
|---|---|---|
| Period | Daily (chart session), US session (RTH), Asian session, European session, Weekly (ISO week), Monthly | A: day, B: week, C: month, D: US |
| Previous periods | Number of previous profiles drawn on their period | 0 |
| Current period | Pinned to the right edge, or on its period | right edge |
| Profiles set on their period | From the first bar facing right, or from the close facing left | first bar |
| Computed on RTH only (ETH chart) | Session, week, month: counts only the 09:30 to 16:00 New York bars | unchecked |
| Value Area % | Share of total volume held in the value area | 70 |
| Width at the right edge (% of chart) | Length of the fullest row of the profile pinned to the right edge | 25 |
| Width on the period (% of its span) | Length of the fullest row of a profile set on its period | 60 |
| Maximum width (% of chart) | Cap on the fullest row of every profile, pinned to the right edge or set on its period: a month set on its period no longer covers the whole chart | 100 |
| Ticks per row (0 = auto) | Groups prices into rows; 0: at least 3 pixels per row, ticks merge when zooming out | 0 |
| **Histogram** | Shows or hides the rows | checked |
| Volume display | Buyers and sellers stacked, or total colored by the Value Area | stacked |
| Buyers, sellers color and opacity | Stacked mode | green, red, 0.5 |
| Relative opacity outside the Value Area | Stacked mode: share of their opacity buyers and sellers keep outside the value area; 1 fades nothing | 0.4 |
| Color and opacity outside the Value Area, Value Area | Total mode | grey, blue, 0.5 |
| POC row color and opacity | POC row in total mode, its outline in stacked mode | orange, 0.6 |
| **POC line** | Shows or hides the line; color, style (solid, dashed, dotted, fine dots, dash-dot), thickness, opacity | orange, solid, 1.5 |
| **VAH and VAL lines** | Same settings, shared by both lines | blue, dashed, 1 |
| Left labels and caption | Prices of the current period's levels and caption | checked |

### Known limits

- **Volume read from the bars' levels.** A bar without levels is not guessed: a period holding one is not drawn, and the caption gives the share of bars lacking them.
- **Spread-out reading.** Each closed session, and the minute file of a completion, is read over several frames at 4 ms each (a NQ session costs 10 to 17 ms in one block): on a heavy history, the profile shows after a few dozen frames. Live, only the last bar is read again.
- **Partial period.** TT's ES history starts on Tuesday 22 September 2026: on a tick chart, which goes back only about two weeks and starts anywhere in the session, the chart's first period (session, US, Asian or European session, week, month) whose start is not loaded is completed from the one-minute bars TT serves to candle charts (twenty rolling sessions), read once when the chart opens: the profile appears once they have arrived and been read, which takes a few frames. If they do not cover it either (first business day missing, a session joined more than an hour after its open or cut short, two business days without a session, a stop more than an hour before the chart's first bar), the period is not drawn, current or previous, and the current period's caption says "hidden: partial". A minute chart already comes from that file, and the footprint has no dates: there is nothing to complete, the period is masked. At the end of a long month, twenty sessions may no longer reach the 1st. Holidays are not known: a week opened by a Monday holiday counts as partial if the history starts right after it.
- **Incomplete period.** Further on in the chart, a session joined more than an hour after the start of its window, or cut short (a finished window whose last bar falls more than an hour before its end and more than 4 hours before the session close, so that holiday early closes pass), is not drawn; nor is a week or month holding such a session, a missing day (which TT marks with a blank) or a business day without a session. Full CME closures (New Year's Day, Good Friday, Christmas, observed days included) come from Turning Trade's calendar and do not count as missing days; holidays with a shortened session keep their session. Only the first period of a tick chart is completed from the minute file. A hole in the middle of a session, without a blank marked by TT, is not detected. A TT session straddling the chart's open (16:00 → 18:30 New York) is masked after the open, its start being missing; if it starts during the 17:00 to 18:00 break, the open starts it.
- **US, Asian, European sessions**: before 09:30, the last US session is yesterday's; it is then treated as the current period. Hours are set in TT's world sessions, not in the study.
- **Footprint**: its bars are not dated; only the chart session and the US, Asian, European sessions are available there, the latter with today's daylight saving time.
- **Prices on the left** for the current period only; previous periods only have their lines.
- **First display** of a long period or a long history: the computation spreads over a few frames so the chart does not freeze, the profiles show a split second after the rest.
- POC, VAH and VAL stay computed to the tick whatever the row grouping.
- No delta profile (buyers minus sellers), no extended naked POC.
