// Self-check for extensions/pivots.js: daily pivots on real ES bars baked by Turning Trade,
// weekly, monthly and session completeness on synthetic sessions (the archive changes as TT
// rewrites it, so nothing below depends on which days it holds).
// Run: node tests/pivots_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/pivots.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const N = bars.length;

const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console }));
assert.equal(defs.length, 1);
const E = defs[0];
assert.equal(E.id, 'pivots', 'id stable');
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

const rec = [];
const g = (B = bars, seance = 'eth', premiere = B.length - 300) => ({ n: B.length, premiere, derniere: B.length - 1, tick: 0.25, seance, sym: 'ES', tf: 1, echelle: 1,
  cadre: { gauche: 0, droite: 1e6, haut: 0, bas: 500 }, barre: i => B[i] || null, x: i => i, y: v => v,
  trait(p, o) { rec.push({ k: 'trait', p, o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); }, ligne() {}, zone() {}, etiquette() {} });

const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ' : ' + a + ' vs ' + b);
const hlc = bs => ({ H: Math.max(...bs.map(b => b.h)), L: Math.min(...bs.map(b => b.l)), C: bs[bs.length - 1].c, O: bs[0].o });
const prix = niv => Object.fromEntries(niv.map(([n, p]) => [n, p]));
// Same rule as the study on a one-minute ETH session: bars from the first hour to 4 h before 17:00 ET.
const complete = bs => bs.length > 0 && bs[0].m <= 60 && bs[bs.length - 1].m >= 1380 - 240;
const rthDe = s => s.bars.filter(b => b.m >= 930 && b.m < 1320);
const completeRth = bs => bs.length > 0 && bs[0].m <= 930 + 60 && bs[bs.length - 1].m >= 1320 - 240;
// No weekday strictly between two session dates: the previous session is the previous weekday.
const contigus = (a, b) => { for (let d = new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1) < new Date(b + 'T00:00:00Z');) if (d.getUTCDay() % 6) return false; return true; };
const veille = k => k > 0 && complete(db.sessions[k - 1].bars) && contigus(db.sessions[k - 1].date, db.sessions[k].date);
// Last archive session whose previous one is the previous weekday and covers its session (and its RTH window): the reference day below.
const K = db.sessions.findLastIndex((s, k) => veille(k) && completeRth(rthDe(db.sessions[k - 1])));
assert.ok(K > 0, 'une séance de l\'archive avec une veille complète');
const finK = db.sessions.slice(0, K + 1).reduce((n, s) => n + s.bars.length, 0);
const barsK = bars.slice(0, finK);

// 1. Formulas, by hand for H 110, L 90, C 105, O 95.
{
  const f = x => prix(E.outils.niveaux(x, 110, 90, 105, 95));
  const attendu = {
    classique: { PP: 305 / 3, R1: 113.3333333, S1: 93.3333333, R2: 121.6666667, S2: 81.6666667, R3: 133.3333333, S3: 73.3333333 },
    fibonacci: { PP: 305 / 3, R1: 109.3066667, S1: 94.0266667, R2: 114.0266667, S2: 89.3066667, R3: 121.6666667, S3: 81.6666667 },
    camarilla: { PP: 305 / 3, R1: 106.8333333, S1: 103.1666667, R2: 108.6666667, S2: 101.3333333, R3: 110.5, S3: 99.5 },
    woodie: { PP: 102.5, R1: 115, S1: 95, R2: 122.5, S2: 82.5, R3: 135, S3: 75 },
    demark: { PP: 103.75, R1: 117.5, S1: 97.5 }
  };
  for (const [nom, A] of Object.entries(attendu)) {
    const R = f(nom);
    assert.deepEqual(Object.keys(R).sort(), Object.keys(A).sort(), nom + ' : niveaux');
    for (const k in A) assert.ok(Math.abs(R[k] - A[k]) < 1e-6, nom + ' ' + k + ' : ' + R[k] + ' vs ' + A[k]);
  }
  // DeMark switches on the close against the open.
  proche(prix(E.outils.niveaux('demark', 110, 90, 95, 105)).PP, (110 + 180 + 95) / 4, 'DeMark, clôture sous l\'ouverture');
  proche(prix(E.outils.niveaux('demark', 110, 90, 100, 100)).PP, (110 + 90 + 200) / 4, 'DeMark, clôture égale');
}

// 2. Daily on real ES bars: each session carries the pivots of the previous one if that one
// is the previous weekday and covers its session, none otherwise; the first session has none.
{
  const P = E.calcul(g(), defaut);
  assert.equal(P.jour.length, db.sessions.length, 'une période par séance');
  assert.equal(P.jour[0].niv, null, 'pas de veille pour la première séance');
  let i0 = 0;
  db.sessions.forEach((s, k) => {
    assert.equal(P.jour[k].deb, i0, 'début de séance ' + s.date); i0 += s.bars.length;
    assert.equal(P.jour[k].fin, i0 - 1, 'fin de séance ' + s.date);
    if (!k) return;
    if (!veille(k)) return assert.equal(P.jour[k].niv, null, 'veille incomplète ou manquante, rien le ' + s.date);
    const v = hlc(db.sessions[k - 1].bars), R = prix(P.jour[k].niv);
    proche(R.PP, (v.H + v.L + v.C) / 3, 'PP ' + s.date);
    proche(R.R1, 2 * R.PP - v.L, 'R1 ' + s.date);
    proche(R.S3, v.L - 2 * (v.H - R.PP), 'S3 ' + s.date);
  });
}

// 3. RTH only on an ETH chart: the previous session's 09:30-16:00 bars.
{
  const P = E.calcul(g(), avec({ rth: true }));
  const v = hlc(rthDe(db.sessions[K - 1]));
  proche(prix(P.jour[K].niv).PP, (v.H + v.L + v.C) / 3, 'PP sur RTH');
  assert.notEqual(prix(P.jour[K].niv).PP, prix(E.calcul(g(), defaut).jour[K].niv).PP, 'RTH change le résultat');
}

// 4. Footprint-like bars without _date: sessions split where m falls back, daily only.
{
  const sans = bars.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  const P = E.calcul(g(sans), defaut);
  assert.equal(P.jour.length, db.sessions.length, 'séances retrouvées sans date');
  proche(prix(P.jour[K].niv).PP, prix(E.calcul(g(), defaut).jour[K].niv).PP, 'même PP sans date');
  assert.equal(P.sem.length + P.mois.length, 0, 'ni semaine ni mois sans date');
}

// Synthetic weekday sessions of three bars spread over the ETH session (18:00, 05:30, 16:59 ET), prices drifting with the session index.
const jours = (de, a) => { const out = []; for (let d = new Date(de + 'T00:00:00Z'); d <= new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); return out; };
const synth = dates => dates.flatMap((date, s) => [0, 690, 1379].map((m, k) => { const b = 100 + 3 * Math.sin(s) + k; return { _date: date, m, o: b, h: b + 2 + (s % 5), l: b - 1 - (s % 3), c: b + 1, v: 1, lv: [] }; }));
// Synthetic one-minute ETH sessions, 1380 bars each, every session at its own price level.
const minutes = dates => dates.flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => { const b = 7000 + 15 * s + 20 * Math.sin(s + m / 200); return { _date: date, m, o: b, h: b + 1, l: b - 1, c: b + 0.25, v: 1, lv: [] }; }));
const de = (B, f) => hlc(B.filter(f));

// 5. Week and month completeness. Sept 1 2026 is a Tuesday, ISO week 36 opens Monday Aug 31.
{
  assert.deepEqual(['2026-09-01', '2026-10-30', '2026-11-02', '2026-02-10'].map(d => E.outils.ouvres('mois', d)), [22, 22, 21, 20], 'jours ouvrés du mois');
  assert.equal(E.outils.ouvres('sem', '2026-09-01'), 5, 'cinq jours ouvrés par semaine');
  assert.deepEqual([['2026-10-16', '2026-10-19'], ['2026-10-19', '2026-10-22'], ['2026-10-22', '2026-10-26'], ['', '2026-10-26']].map(([a, b]) => E.outils.ouvresEntre(a, b)), [0, 2, 1, 0], 'jours ouvrés manquants entre deux séances');

  const B = synth(jours('2026-09-01', '2026-10-16'));
  const P = E.calcul(g(B), defaut);
  assert.deepEqual(Array.from(P.mois, p => p.cle), ['2026-09', '2026-10']);
  const sept = de(B, b => b._date < '2026-10'), oct = prix(P.mois[1].niv);
  proche(oct.PP, (sept.H + sept.L + sept.C) / 3, 'mPP d\'octobre sur septembre complet');
  assert.equal(P.sem[0].cle, '2026-36');
  assert.equal(P.sem[1].niv, null, 'semaine 36 ouverte un mardi : pas de pivots pour la 37');
  const s37 = de(B, b => E.outils.semaine(b._date) === '2026-37');
  proche(prix(P.sem[2].niv).PP, (s37.H + s37.L + s37.C) / 3, 'wPP de la semaine 38');
  assert.ok(P.sem.slice(2).every(p => p.niv), 'toutes les semaines suivantes');

  // Data starting on Sept 2: September is incomplete, October gets no monthly pivots.
  assert.equal(E.calcul(g(B.filter(b => b._date > '2026-09-01')), defaut).mois[1].niv, null, 'mois précédent incomplet : masqué');
}

// 6. Drawing: one segment per level and period, colour of the period, monthly first, current period to the right edge.
{
  rec.length = 0; E.dessine(g(barsK), defaut);
  let T = rec.filter(x => x.k === 'trait');
  assert.equal(T.length, 7, 'veille seule sur une séance visible');
  assert.ok(T.every(t => t.o.couleur === defaut.jourC), 'couleur journalière');
  const x0 = Math.max(finK - 300, finK - db.sessions[K].bars.length);
  assert.ok(T.every(t => t.p[1][0] === 1e6 && t.p[0][0] === x0), 'séance en cours jusqu\'au bord droit');
  assert.equal(T.filter(t => t.o.epaisseur === 1.5).length, 1, 'PP plus épais');
  assert.deepEqual(rec.filter(x => x.k === 'texte').map(x => x.s).sort(), ['PP', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3']);

  rec.length = 0; E.dessine(g(barsK), avec({ etiq: false }));
  assert.equal(rec.filter(x => x.k === 'texte').length, 0, 'sans étiquettes');
  rec.length = 0; E.dessine(g(barsK), avec({ jour: false }));
  assert.equal(rec.length, 0, 'journalier décoché');

  const B = synth(jours('2026-09-01', '2026-10-16')), n = B.length, debut = B.findIndex(b => b._date === '2026-10-12');
  const col = { jourC: '#000001', semC: '#000002', moisC: '#000003' };
  rec.length = 0; E.dessine(g(B, 'eth', debut), avec(col));
  T = rec.filter(x => x.k === 'trait');
  assert.deepEqual([...new Set(T.map(t => t.o.couleur))], ['#000003', '#000002', '#000001'], 'mois, semaine puis jour');
  assert.equal(T.filter(t => t.o.couleur === '#000003').length, 7, 'mois en cours');
  assert.equal(T.filter(t => t.o.couleur === '#000002').length, 7, 'semaine en cours');
  assert.equal(T.filter(t => t.o.couleur === '#000001').length, 5 * 7, 'cinq séances visibles');
  assert.ok(rec.some(x => x.k === 'texte' && x.s === 'mPP') && rec.some(x => x.k === 'texte' && x.s === 'wR3'), 'préfixes w et m');
  const jour = T.filter(t => t.o.couleur === '#000001');
  assert.ok(jour.slice(0, -7).every(t => t.p[1][0] < n), 'séances passées bornées à leurs barres');

  rec.length = 0; E.dessine(g(B, 'eth', debut), avec({ ...col, sem: false, mois: false, formule: 'demark' }));
  assert.equal(rec.filter(x => x.k === 'trait').length, 5 * 3, 'DeMark : PP, R1, S1');

  rec.length = 0; E.dessine(g(B, 'eth', debut), avec({ ...col, semO: 0.4 }));
  assert.ok(rec.filter(x => x.o.couleur === '#000002').every(x => x.o.opacite === 0.4), 'opacité hebdo, trait et étiquette');
  assert.ok(rec.filter(x => x.o.couleur !== '#000002').every(x => x.o.opacite === 1), 'autres périodes opaques');

  // Settings panel: one sub-section per period, opened by a checkbox, then its colour and opacity.
  assert.deepEqual(Array.from(E.reglages.filter(x => x.type === 'check'), x => x.k), ['rth', 'etiq', 'jour', 'sem', 'mois']);
  assert.deepEqual(['jour', 'sem', 'mois'].map(k => E.reglages[E.reglages.findIndex(x => x.k === k) + 1].k), ['jourC', 'semC', 'moisC']);
  assert.deepEqual(['jour', 'sem', 'mois'].map(k => E.reglages[E.reglages.findIndex(x => x.k === k) + 2].k), ['jourO', 'semO', 'moisO']);
}

// 7. Incremental: the last known bar grows, then a new session opens; same pivots as from scratch.
{
  const B = synth(jours('2026-09-01', '2026-10-16')), e = B.findIndex(b => b._date === '2026-10-16') - 1;
  const plein = B.slice(0, e + 2); plein[e] = Object.assign({}, B[e], { h: 200 });
  const sur = (bs, sym) => Object.assign(g(bs), { sym });
  E.calcul(sur(B.slice(0, e + 1), 'INC'), defaut);
  const t0 = performance.now(), P = E.calcul(sur(plein, 'INC'), defaut), pas = performance.now() - t0;
  const veille = hlc(plein.filter(b => b._date === '2026-10-15'));
  assert.equal(veille.H, 200);
  proche(prix(P.jour[P.jour.length - 1].niv).PP, (veille.H + veille.L + veille.C) / 3, 'barre grossie reprise');
  assert.deepEqual(JSON.parse(JSON.stringify(P)), JSON.parse(JSON.stringify(E.calcul(sur(plein, 'NEUF'), defaut))), 'incrémental = calcul complet');
  assert.ok(pas < 1, 'nouvelle barre en moins d\'une ms : ' + pas.toFixed(3));
}

// 8. Budget: one-minute ETH sessions as deep as TT's ES history (19 sessions), cold compute once, then cached frames.
{
  const B = minutes(jours('2026-09-22', '2026-10-16'));
  const G = Object.assign(g(B), { sym: 'MES' }), r = avec({ formule: 'fibonacci' });
  const t0 = performance.now(); E.dessine(G, r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 50; k++) E.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(froid < 8 && chaud < 1, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(3));
  const P = E.calcul(g(), defaut), ref = prix(P.jour[K].niv);
  console.log('OK', N, 'barres ES,', db.sessions.length, 'séances,', P.jour.filter(p => p.niv).length, 'avec pivots | PP du', db.sessions[K].date, ref.PP.toFixed(2), 'R1', ref.R1.toFixed(2), 'S1', ref.S1.toFixed(2),
    '|', B.length, 'barres synthétiques, froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}

// 9. Incomplete previous session: no pivots from a session cut at its start or end (history
// starting mid-session, tick history still loading), an early holiday close still counts.
{
  const d = jours('2026-10-05', '2026-10-08'), B = minutes(d);
  const sauf = f => B.filter(b => b._date !== d[1] || f(b));
  const jour = (bs, r = defaut) => E.calcul(Object.assign(g(bs), { sym: 'CPL' }), r).jour;
  assert.ok(jour(B).slice(1).every(p => p.niv), 'séances pleines : pivots partout');
  let J = jour(sauf(b => b.m >= 300));
  assert.ok(J[1].niv && !J[2].niv && J[3].niv, 'veille commencée à 23:00 : rien');
  J = jour(sauf(b => b.m < 600));
  assert.equal(J[2].niv, null, 'veille arrêtée à 03:59 : rien');
  J = jour(sauf(b => b.m < 1200));
  const v = hlc(B.filter(b => b._date === d[1] && b.m < 1200));
  proche(prix(J[2].niv).PP, (v.H + v.L + v.C) / 3, 'clôture anticipée à 14:00 : pivots gardés');
  const rth = sauf(b => b.m < 1050 || b.m >= 1320);
  assert.ok(jour(rth)[2].niv && !jour(rth, avec({ rth: true }))[2].niv, 'RTH seul : veille coupée à 11:30 masquée');
  assert.deepEqual([[0, 1380], [1379, 1380]].map(([a, b]) => E.outils.complete({ O: 1, m0: a, m1: b - 1 }, [0, b])), [true, false], 'complete()');

  // A week holding an incomplete session gives no pivots to the next one.
  const S = synth(jours('2026-09-07', '2026-10-02')), coupe = S.filter(b => !(b._date === '2026-09-16' && b.m > 0));
  const sem = E.calcul(Object.assign(g(coupe), { sym: 'SEM' }), defaut).sem;
  assert.deepEqual(Array.from(sem, p => p.cle + ':' + !!p.niv), ['2026-37:false', '2026-38:true', '2026-39:false', '2026-40:true'], 'semaine 38 entamée : pas de pivots pour la 39');
}

// 10. Bars inserted before the last one read (tick history filling a missing day): the cache
// starts over and gives what a fresh computation gives, no ghost sessions.
{
  const d = jours('2026-10-05', '2026-10-09'), B = minutes(d), trou = B.filter(b => b._date !== d[2]);
  const sur = bs => Object.assign(g(bs), { sym: 'INS' });
  E.calcul(sur(trou), defaut);
  const P = E.calcul(sur(B), defaut);
  assert.deepEqual(Array.from(P.jour, p => p.cle + ':' + p.deb), d.map((_, k) => 'j' + k + ':' + 1380 * k), 'séances retrouvées après insertion');
  assert.deepEqual(JSON.parse(JSON.stringify(P)), JSON.parse(JSON.stringify(E.calcul(Object.assign(g(B), { sym: 'NEUF2' }), defaut))), 'insertion = calcul complet');
  // Same bar count, other bars (a day filled in, the last one dropped): the cache must not serve the old result.
  const d6 = jours('2026-10-05', '2026-10-12'), C = minutes(d6), avant = C.filter(b => b._date !== d6[2]), apres = C.filter(b => b._date !== d6[5]);
  E.calcul(sur(avant), defaut);
  assert.deepEqual(JSON.parse(JSON.stringify(E.calcul(sur(apres), defaut))), JSON.parse(JSON.stringify(E.calcul(Object.assign(g(apres), { sym: 'NEUF3' }), defaut))), 'même nombre de barres, autre contenu');
}

// 11. Missing data: a weekday missing between two loaded sessions (tick history without TT's filler
// bars, footprint), TT's filler block for a missing day, a week or month short of one weekday.
{
  const d = jours('2026-10-05', '2026-10-16'), B = minutes(d), sans = jour => B.filter(b => b._date !== jour);
  // A symbol per chart: two charts with the same bar count and the same end bars share the cache key.
  let nc = 0;
  const jour = bs => E.calcul(Object.assign(g(bs), { sym: 'MQ' + nc++ }), defaut).jour;
  // Wednesday Oct 7 missing: Thursday gets nothing from Tuesday, Friday gets Thursday's pivots.
  let J = jour(sans('2026-10-07'));
  assert.deepEqual(Array.from(J, p => p.debut + ':' + !!p.niv).slice(1, 4), ['2026-10-06:true', '2026-10-08:false', '2026-10-09:true'], 'mercredi manquant : rien jeudi');
  // Monday after a weekend is contiguous; Monday after a missing Friday is not.
  J = jour(sans('2026-10-09'));
  assert.equal(J.find(p => p.debut === '2026-10-12').niv, null, 'vendredi manquant : rien lundi');
  assert.ok(jour(B).find(p => p.debut === '2026-10-12').niv, 'week-end : lundi garde ses pivots');
  // Footprint bars carry no _date; TT puts the session date in _sd, which is enough to see the gap.
  const fp = sans('2026-10-07').map(b => { const c = Object.assign({ _sd: b._date }, b); delete c._date; return c; });
  J = jour(fp);
  assert.deepEqual(Array.from(J, p => !!p.niv).slice(1, 4), [true, false, true], 'footprint : mercredi manquant vu par _sd');
  assert.equal(E.calcul(Object.assign(g(fp), { sym: 'MQF2' }), defaut).sem.length, 0, 'footprint : toujours ni semaine ni mois');
  // TT's filler block for a missing day: bars dated that day, m 0, _trou, no levels.
  const trou = B.filter(b => b._date < '2026-10-07').concat(Array.from({ length: 8 }, () => ({ _trou: true, _date: '2026-10-07', m: 0, o: 7000, h: 7000, l: 7000, c: 7000, lv: [] })), B.filter(b => b._date > '2026-10-07'));
  J = jour(trou);
  assert.deepEqual(Array.from(J, p => p.debut + ':' + !!p.niv).slice(2, 4), ['2026-10-07:true', '2026-10-08:false'], 'bloc de comblement : rien le lendemain');
  // Weeks: one complete (Oct 5-9), the next one short of a day, mid-week, Friday or Monday.
  const S = synth(jours('2026-10-05', '2026-10-30')), sem = bs => Array.from(E.calcul(Object.assign(g(bs), { sym: 'SM' + nc++ }), defaut).sem, p => p.cle + ':' + !!p.niv);
  assert.deepEqual(sem(S), ['2026-41:false', '2026-42:true', '2026-43:true', '2026-44:true'], 'semaines pleines');
  for (const manque of ['2026-10-14', '2026-10-16', '2026-10-12'])
    assert.deepEqual(sem(S.filter(b => b._date !== manque)), ['2026-41:false', '2026-42:true', '2026-43:false', '2026-44:true'], 'semaine 42 sans le ' + manque + ' : rien pour la 43');
  assert.deepEqual([sem(B), sem(trou)], [['2026-41:false', '2026-42:true'], ['2026-41:false', '2026-42:false']], 'semaine avec un bloc de comblement : rien pour la suivante');
  // Months: September complete gives October its pivots, unless a September weekday is missing.
  const M = synth(jours('2026-09-01', '2026-10-09')), mois = bs => E.calcul(Object.assign(g(bs), { sym: 'MO' + nc++ }), defaut).mois[1].niv;
  assert.ok(mois(M), 'septembre complet');
  assert.equal(mois(M.filter(b => b._date !== '2026-09-15')), null, 'septembre sans le 15 : rien en octobre');
  assert.equal(mois(M.filter(b => b._date !== '2026-09-30')), null, 'septembre sans son dernier jour : rien en octobre');
}
