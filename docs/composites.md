# Composite de volume · prise en main

*English version below.*

> **Avertissement.** Cette étude est un outil en évolution permanente : elle n'est pas parfaite, ses valeurs dépendent de l'historique que Turning Trade a chargé. Elle ne remplace en aucun cas votre propre jugement ni votre lecture visuelle du graphe. Elle propose, vous décidez.

## En deux mots

Le profil de volume des N dernières séances : à chaque prix, le volume échangé sur toutes ces séances. C'est le même objet que le « Volume composite » de Turning Trade, calculé par l'étude, en quatre instances que l'on pose côte à côte : par exemple 30 séances collé au bord droit, et 14 séances juste à sa gauche. L'étude fonctionne sur le Market Profile, les bougies et le footprint.

## Un peu de maths

Le composite additionne, tick par tick, le volume (bid + ask) des N séances : les jours du Market Profile, ou les niveaux des barres sur les bougies et le footprint. Le POC est le tick le plus échangé (le plus bas en cas d'égalité). La Value Area part du POC et ajoute le voisin le plus fourni jusqu'à contenir « Value Area % » du volume ; VAH et VAL en sont les bornes, au tick. L'affichage regroupe ensuite les ticks en rangées (« Ticks par rangée ») : le regroupement ne change ni le POC ni la Value Area. Le Volume composite natif, lui, élargit ses rangées selon l'étendue du profil, d'où un composite de 30 séances plus grossier qu'un de 14 ; ses POC, VAH et VAL peuvent différer d'une rangée des nôtres.

## À quoi ça sert

Un composite long (30, 60 ou 90 séances) montre où le marché a accepté ou rejeté les prix sur plusieurs semaines. Un composite court (14 séances) montre où la valeur s'est déplacée récemment. Côte à côte, on voit si la valeur récente migre par rapport au long terme : un POC court au-dessus du POC long signale une valeur qui monte. Les zones épaisses attirent et freinent le prix, les zones creuses se traversent vite.

Ce que ça change pour la décision : une cible ou une zone de réaction tirée d'un horizon qui dépasse la séance, et la comparaison immédiate de deux horizons sans changer de réglage.

## Lire le graphe

- **Histogramme** collé au bord droit, ou décalé vers la gauche : acheteurs (ask) contre le bord, vendeurs (bid) au bout, hors Value Area atténué, rangée du POC cerclée. En mode « Total », une couleur pour la Value Area, une hors d'elle, la rangée du POC à part.
- **Lignes** POC, VAH et VAL sous le profil, ou depuis le bord gauche du graphe, avec leur prix écrit à gauche du profil (« POC 30 7745.25 »).
- **Légende** en haut à droite : « Composite 30 séances · du … au … ». Si l'historique ne suffit pas : « masqué : 22 séances disponibles ».

## Configurer

| Réglage | Rôle | Défaut |
|---|---|---|
| Séances du composite | Nombre de séances, de 5 à 260 | 30, 14, 60, 90 (A à D) |
| Largeur (% du graphe) | Longueur de la rangée la plus fournie | 12 |
| Décalage depuis le bord droit (% du graphe) | Distance entre le bord droit et le profil ; la largeur d'une autre instance pour se coller à sa gauche | 0, 12, 24, 36 (A à D) |
| Value Area % | Part du volume dans la Value Area | 70 |
| Ticks par rangée (0 = auto) | Regroupe les ticks par rangées ; 0 : la règle de Turning Trade, une rangée par point sur le Nasdaq (NQ, MNQ : 4 ticks), un tick ailleurs | 0 |
| Histogramme | Afficher les rangées | oui |
| Affichage du volume | Acheteurs et vendeurs empilés, ou total coloré par la Value Area | empilés |
| Couleurs et opacités | Acheteurs, vendeurs, hors Value Area, Value Area, rangée du POC ; opacité relative hors Value Area | vert, rose, gris, bleu, orange ; 0,4 |
| Lignes depuis | Le profil seulement, ou le bord gauche du graphe | le profil |
| Ligne POC, lignes VAH et VAL | Couleur, style, épaisseur, opacité | orange plein, bleu en tirets |
| Étiquettes | Prix des niveaux | oui |
| Légende | Ligne en haut à droite : séances couvertes, ou pourquoi le composite est masqué | oui |

Avec les défauts, B se colle à gauche de A, C à gauche de B, D à gauche de C.

### Limites à connaître

- Masqué si l'historique de Turning Trade ne couvre pas les N séances demandées : la légende dit combien il y en a. Turning Trade archive environ deux mois de séances (depuis le 27 août 2026 aujourd'hui).
- Une séance est un jour du Market Profile sur le Market Profile, une date de séance des barres sur les bougies et le footprint : seules les séances que le graphe tient comptent, sans complétion.
- Les séances se lisent une fois par séance et par graphe, partagées par les quatre instances, puis chaque instance regroupe à son réglage : un à-coup d'une image, quelques dizaines de millisecondes pour vingt-quatre séances d'ES. La séance en cours est figée à son état de la première lecture, comme dans le composite natif.
- Largeur et décalage sont en % du graphe : deux instances restent collées tant que le décalage de l'une vaut la largeur de l'autre.
- Les légendes se placent sous celles du Profil de volume par période.

---

# Volume Composite · getting started

> **Disclaimer.** This study is a work in constant progress: it is not perfect, its values depend on the history Turning Trade has loaded. It never replaces your own judgment or your visual reading of the chart. It suggests, you decide.

## In short

The volume profile of the last N sessions: at each price, the volume traded over all those sessions. It is the same object as Turning Trade's "Volume composite", computed by the study, in four instances you can set side by side: for instance 30 sessions pinned to the right edge, and 14 sessions right next to it on the left. The study works on the Market Profile, candles and footprint.

## A bit of math

The composite adds up, tick by tick, the volume (bid + ask) of the N sessions: the Market Profile's days, or the bars' levels on candles and footprint. The POC is the most traded tick (the lowest on a tie). The value area starts at the POC and adds the richer neighbour until it holds "Value Area %" of the volume; VAH and VAL are its bounds, to the tick. The display then groups ticks into rows ("Ticks per row"): grouping changes neither the POC nor the value area. The native Volume composite widens its rows with the profile's range instead, hence a 30-session composite coarser than a 14-session one; its POC, VAH and VAL may differ from ours by a row.

## What it is for

A long composite (30, 60 or 90 sessions) shows where the market accepted or rejected prices over several weeks. A short one (14 sessions) shows where value moved recently. Side by side, you see whether recent value migrates against the long term: a short POC above the long POC means value moving up. Thick zones attract and slow price down, thin zones are crossed quickly.

What it changes for a decision: a target or reaction zone taken from a horizon beyond the session, and an immediate comparison of two horizons without changing settings.

## Reading the chart

- **Histogram** pinned to the right edge, or offset to the left: buyers (ask) against the edge, sellers (bid) at the end, outside the value area dimmed, POC row outlined. In "Total" mode, one color for the value area, one outside it, the POC row apart.
- **Lines** POC, VAH and VAL under the profile, or from the chart's left edge, with their price written left of the profile ("POC 30 7745.25").
- **Caption** top right: "Composite 30 sessions · from … to …". If the history is too short: "hidden: 22 sessions available".

## Settings

| Setting | Role | Default |
|---|---|---|
| Composite sessions | Number of sessions, 5 to 260 | 30, 14, 60, 90 (A to D) |
| Width (% of chart) | Length of the fullest row | 12 |
| Offset from the right edge (% of chart) | Distance between the right edge and the profile; another instance's width to sit right next to it | 0, 12, 24, 36 (A to D) |
| Value Area % | Share of the volume in the value area | 70 |
| Ticks per row (0 = auto) | Groups ticks into rows; 0: Turning Trade's rule, one row per point on the Nasdaq family (NQ, MNQ: 4 ticks), one tick elsewhere | 0 |
| Histogram | Show the rows | on |
| Volume display | Buyers and sellers stacked, or total colored by the value area | stacked |
| Colors and opacities | Buyers, sellers, outside the value area, value area, POC row; relative opacity outside the value area | green, pink, grey, blue, orange; 0.4 |
| Lines from | The profile only, or the chart's left edge | the profile |
| POC line, VAH and VAL lines | Color, style, width, opacity | solid orange, dashed blue |
| Labels | Level prices | on |
| Legend | Line top right: sessions covered, or why the composite is hidden | on |

With the defaults, B sits left of A, C left of B, D left of C.

### Known limits

- Hidden if Turning Trade's history does not cover the N sessions asked: the caption says how many there are. Turning Trade archives about two months of sessions (since 27 August 2026 today).
- A session is a Market Profile day on the Market Profile, a bar session date on candles and footprint: only the sessions the chart holds count, with no completion.
- Sessions are read once per session and per chart, shared by the four instances, then each instance groups them at its own setting: a one-frame hitch, a few tens of milliseconds for twenty-four ES sessions. The current session is frozen at its state of the first read, like the native composite.
- Width and offset are in % of the chart: two instances stay side by side as long as one's offset equals the other's width.
- Captions sit below those of the Period Volume Profile.
