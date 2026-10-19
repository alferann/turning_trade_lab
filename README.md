# Turning Trade Lab

*English version below.*

Études tierces pour [Turning Trade](https://turningtrade.com), le terminal de trading de futures : des indicateurs qui se chargent dans les graphes en bougies et en footprint par le système d'extensions de la plateforme. Chaque étude passe en anglais quand Turning Trade est réglé en anglais.

> Projet personnel, sans lien avec l'éditeur de Turning Trade. Les études aident à lire le marché ; ce ne sont pas des conseils d'investissement, elles ne sont pas parfaites et ne remplacent jamais votre jugement.

## Études

| Étude | Fichier | En bref | Prise en main |
|---|---|---|---|
| VWAP Pro | `extensions/vwap_pro.js` | VWAP ancré sur la séance US, Asie ou Europe, le jour, la semaine ou le mois ; jusqu'à six écarts-types libres ; six instances à superposer | [`docs/vwap_pro.md`](docs/vwap_pro.md) |
| Points pivots | `extensions/pivots.js` | PP, R1 à R3, S1 à S3 journaliers, hebdomadaires et mensuels ; formule classique, Fibonacci, Camarilla, Woodie ou DeMark | [`docs/pivots.md`](docs/pivots.md) |
| Divergences CVD | `extensions/cvd_div.js` | Divergences entre le prix et le delta cumulé (UE, UA, DE, DA), suivies jusqu'à confirmation ou cassure, avec notifications ; volet CVD dans le même fichier | [`docs/divergences_cvd.md`](docs/divergences_cvd.md) |
| POC par barre | `extensions/poc_barre.js` | Le prix le plus échangé de chaque barre, en trait sur la largeur du corps de la bougie ; une couleur ou teinté par le delta | [`docs/poc_barre.md`](docs/poc_barre.md) |

## Installer

1. Copier le fichier de l'étude dans le dossier d'extensions de Turning Trade, sous Linux `~/.local/share/TurningTrade/extensions/` :
   ```bash
   cp extensions/vwap_pro.js ~/.local/share/TurningTrade/extensions/
   ```
   Le chemin exact sur votre machine est le champ `dossier` de `curl -s http://127.0.0.1:8765/api/ext/liste`, Turning Trade ouvert.
2. Redémarrer Turning Trade, ou ouvrir l'Éditeur d'études et « Enregistrer » le fichier : la plateforme ne lit les extensions qu'à l'ouverture des graphes.
3. Cocher l'étude dans le panneau d'études du graphe. Les réglages sont mémorisés par étude et par type de graphe, et survivent aux mises à jour du fichier.

## Tester

Chaque étude a un banc Node (testé avec Node.js 26) qui la rejoue sur des barres ES réelles archivées par Turning Trade (`_footprint_db_rec_ES.json` dans son dossier de données ; `TT_DATA` pour en changer).

```bash
node tests/vwap_pro_test.mjs
node tests/pivots_test.mjs
node tests/cvd_div_test.mjs
node tests/poc_barre_test.mjs
node tests/i18n_test.mjs   # anglais de toutes les études, comparé au dictionnaire de Turning Trade (TT_PAYLOAD)
```

## Branches

`main` porte les études publiées. `dev` est le labo : d'autres études, en cours d'écriture ou d'essai.

## Licence

[CC BY-NC 4.0](LICENSE) : partage et adaptation libres avec attribution, sans usage commercial.

---

# Turning Trade Lab

Third-party studies for [Turning Trade](https://turningtrade.com), the futures trading terminal: indicators loaded into candlestick and footprint charts through the platform's extension system. Every study switches to English when Turning Trade is set to English.

> Personal project, not affiliated with the publisher of Turning Trade. The studies help read the market; they are not investment advice, they are not perfect and never replace your own judgment.

## Studies

| Study | File | In short | Getting started |
|---|---|---|---|
| VWAP Pro | `extensions/vwap_pro.js` | VWAP anchored on the US, Asian or European session, the day, the week or the month; up to six free standard deviations; six instances to stack | [`docs/vwap_pro.md`](docs/vwap_pro.md) |
| Pivot Points | `extensions/pivots.js` | Daily, weekly and monthly PP, R1 to R3, S1 to S3; classic, Fibonacci, Camarilla, Woodie or DeMark formula | [`docs/pivots.md`](docs/pivots.md) |
| CVD Divergences | `extensions/cvd_div.js` | Divergences between price and cumulative delta (UE, UA, DE, DA), tracked until confirmed or broken, with notifications; CVD pane in the same file | [`docs/divergences_cvd.md`](docs/divergences_cvd.md) |
| Bar POC | `extensions/poc_barre.js` | The most traded price of each bar, as a line across the candle body; one color or tinted by the delta | [`docs/poc_barre.md`](docs/poc_barre.md) |

The getting-started guides are in French first, then in English.

## Install

1. Copy the study file into Turning Trade's extensions folder, on Linux `~/.local/share/TurningTrade/extensions/`:
   ```bash
   cp extensions/vwap_pro.js ~/.local/share/TurningTrade/extensions/
   ```
   The exact path on your machine is the `dossier` field of `curl -s http://127.0.0.1:8765/api/ext/liste`, with Turning Trade running.
2. Restart Turning Trade, or open the Study editor and save the file: the platform only reads extensions when charts open.
3. Tick the study in the chart's study panel. Settings are remembered per study and per chart type, and survive file updates.

## Test

Each study has a Node bench (tested with Node.js 26) that replays it on real ES bars archived by Turning Trade (`_footprint_db_rec_ES.json` in its data folder; `TT_DATA` to change it).

```bash
node tests/vwap_pro_test.mjs
node tests/pivots_test.mjs
node tests/cvd_div_test.mjs
node tests/poc_barre_test.mjs
node tests/i18n_test.mjs   # English of every study, checked against Turning Trade's dictionary (TT_PAYLOAD)
```

## Branches

`main` holds the published studies. `dev` is the lab: other studies, being written or tried out.

## License

[CC BY-NC 4.0](LICENSE): free to share and adapt with attribution, no commercial use.
