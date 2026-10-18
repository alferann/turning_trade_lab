# Turning Trade Lab

Études tierces pour [Turning Trade](https://turningtrade.com) et leurs bancs d'essai.

Cette branche, `dev`, est le labo : toutes les études, y compris celles en cours. La branche `main` ne porte que les études publiées, avec un README d'installation en français et en anglais.

> Projet personnel, sans lien avec l'éditeur de Turning Trade. Les études aident à lire le marché ; ce ne sont pas des conseils d'investissement, elles ne sont pas parfaites et ne remplacent jamais votre jugement.

## Contenu

| Dossier | Rôle |
|---|---|
| `extensions/` | Les études. Le dossier `~/.local/share/TurningTrade/extensions` est un lien vers celui-ci. |
| `tests/` | Bancs Node qui rejouent chaque étude sur des barres ES réelles archivées par TT. |
| `docs/` | Prise en main de chaque étude, en français puis en anglais : maths, usage, réglages, avertissement. |

## Démarrer

```bash
# Relier le dossier d'extensions de TT au dépôt (une fois, ou après réinstallation)
ln -s "$PWD/extensions" ~/.local/share/TurningTrade/extensions

# Tester les études
node tests/cvd_div_test.mjs
node tests/confluence_test.mjs
node tests/vwap_pro_test.mjs
node tests/pivots_test.mjs
node tests/noeuds_volume_test.mjs
node tests/profil_periode_test.mjs
node tests/absorption_test.mjs
node tests/i18n_test.mjs   # anglais de toutes les études
```

Après modification d'une étude, redémarrer Turning Trade ou passer par Éditeur d'études puis « Enregistrer » : TT ne relit pas un fichier modifié sur le disque.

Toutes les études passent en anglais quand Turning Trade est réglé en anglais : nom, description, réglages, textes du graphe et notifications.

## Études

### Divergences CVD, `cvd_div.js`

Quatre types, UE et UA baissiers, DE et DA haussiers, à trois niveaux de structure. Un pivot prix n'est retenu que si un pivot CVD de même sens tombe à quelques barres près ; chaque pivot est comparé à tous les pivots retenus antérieurs dans l'écart max. Trois états après confirmation du pivot : en attente, confirmée quand le prix casse l'extrême opposé du segment, cassée quand il redépasse le pivot d'arrivée. Zones de pré-tir au niveau du dernier pivot, notifications de bureau pour les nouveaux signaux.

Deux études dans le fichier : « Divergences CVD · prix » porte tous les réglages de détection ; « Divergences CVD · volet CVD » dessine le delta cumulé et suit ces réglages.

Prise en main : [`docs/divergences_cvd.md`](docs/divergences_cvd.md).

### Confluence Scanner, `confluence.js`

Sept familles de niveaux calculées sur le graphe, VWAP et écarts-types, profil de volume de la séance et de la veille, pivots journaliers et hebdomadaires, niveaux clés, plages overnight et de séance, plages d'ouverture, regroupées par proximité et notées. Les zones s'allument quand le prix approche. Prise en main : [`docs/confluence.md`](docs/confluence.md).

### VWAP Pro, `vwap_pro.js`

VWAP ancré au choix sur la séance US (RTH), Asie, Europe, la journée, la semaine ISO ou le mois, avec jusqu'à six écarts-types libres (multiplicateur, couleur, épaisseur, style et opacité de remplissage pour chacun), réglés en sous-sections, et thèmes de couleurs. Les heures de séance suivent les sessions monde de TT ou se forcent dans le fuseau voulu. Trois instances A, B, C pour superposer plusieurs ancrages. Prise en main : [`docs/vwap_pro.md`](docs/vwap_pro.md).

### Points pivots, `pivots.js`

PP, R1 à R3 et S1 à S3 journaliers, hebdomadaires et mensuels, chaque période allumée par sa case à cocher et tracée dans sa couleur, en marches sur l'historique. Formule classique, Fibonacci, Camarilla, Woodie ou DeMark, calcul possible sur RTH seul. Une semaine ou un mois précédent incomplet dans l'historique ne donne pas de pivots. Prise en main : [`docs/pivots.md`](docs/pivots.md).

### Nœuds du profil de volume, `noeuds_volume.js`

HVN, LVN, ledges et shelves détectés sur les profils que dessinent les panneaux de profil de volume du graphe (SVP séance, CVP fenêtre visible, CMP composite N séances), mêmes rangées que TT, tracés en zones étiquetées. Sommets par proéminence, creux par hauteur des murs, ledges par rapport de volume entre les deux côtés d'une limite, shelves en paliers plats adossés à un ledge. Prise en main : [`docs/noeuds_volume.md`](docs/noeuds_volume.md).

### Profil de volume par période, `profil_periode.js`

Le profil de volume de la séance, de la semaine ISO ou du mois en cours, en histogramme collé au bord droit, avec POC, VAH et VAL prolongés depuis le début de la période. La période suit le calendrier, à la différence du composite glissant des panneaux VP de TT. Prise en main : [`docs/profil_periode.md`](docs/profil_periode.md).

### Absorptions et reprises, `absorption.js`

Deux études. « Absorptions » repère sur barres closes le volume piégé à l'extrême, l'effort sans résultat, le niveau défendu sur plusieurs barres et, en direct, les paliers de tape qui ont tenu (proxy d'iceberg, sans le carnet). Seuils comparés aux barres récentes de l'instrument, zones prolongées jusqu'à la clôture qui les traverse. « Reprises après absorption » marque la cassure de la barre d'absorption avec un delta franc ou des déséquilibres empilés, et relit les réglages de détection de la première. Notifications de bureau pour les deux. Prise en main : [`docs/absorption.md`](docs/absorption.md).

## Licence

[CC BY-NC 4.0](LICENSE) : partage et adaptation libres avec attribution, sans usage commercial.
