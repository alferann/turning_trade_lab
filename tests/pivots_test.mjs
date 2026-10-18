// Self-check for extensions/pivots.js: daily pivots on real ES bars baked by Turning Trade,
// weekly and monthly on synthetic sessions (the archive holds a single week).
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

// 2. Daily on real ES bars: each session carries the pivots of the previous one, the first none.
{
  const P = E.calcul(g(), defaut);
  assert.equal(P.jour.length, db.sessions.length, 'une période par séance');
  assert.equal(P.jour[0].niv, null, 'pas de veille pour la première séance');
  let i0 = 0;
  db.sessions.forEach((s, k) => {
    assert.equal(P.jour[k].deb, i0, 'début de séance ' + s.date); i0 += s.bars.length;
    assert.equal(P.jour[k].fin, i0 - 1, 'fin de séance ' + s.date);
    if (!k) return;
    const v = hlc(db.sessions[k - 1].bars), R = prix(P.jour[k].niv);
    proche(R.PP, (v.H + v.L + v.C) / 3, 'PP ' + s.date);
    proche(R.R1, 2 * R.PP - v.L, 'R1 ' + s.date);
    proche(R.S3, v.L - 2 * (v.H - R.PP), 'S3 ' + s.date);
  });
  // One week of data starting on a Tuesday: no complete week or month before it.
  assert.ok(P.sem.every(p => !p.niv) && P.mois.every(p => !p.niv), 'semaine et mois incomplets : rien');
}

// 3. RTH only on an ETH chart: the previous session's 09:30-16:00 bars.
{
  const P = E.calcul(g(), avec({ rth: true }));
  const veille = db.sessions[db.sessions.length - 2].bars.filter(b => b.m >= 930 && b.m < 1320), v = hlc(veille);
  proche(prix(P.jour[P.jour.length - 1].niv).PP, (v.H + v.L + v.C) / 3, 'PP sur RTH');
  assert.notEqual(prix(P.jour[P.jour.length - 1].niv).PP, prix(E.calcul(g(), defaut).jour[P.jour.length - 1].niv).PP, 'RTH change le résultat');
}

// 4. Footprint-like bars without _date: sessions split where m falls back, daily only.
{
  const sans = bars.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  const P = E.calcul(g(sans), defaut);
  assert.equal(P.jour.length, db.sessions.length, 'séances retrouvées sans date');
  proche(prix(P.jour[P.jour.length - 1].niv).PP, prix(E.calcul(g(), defaut).jour[P.jour.length - 1].niv).PP, 'même PP sans date');
  assert.equal(P.sem.length + P.mois.length, 0, 'ni semaine ni mois sans date');
}

// Synthetic weekday sessions of three one-minute bars, prices drifting with the session index.
const jours = (de, a) => { const out = []; for (let d = new Date(de + 'T00:00:00Z'); d <= new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); return out; };
const synth = dates => dates.flatMap((date, s) => [0, 1, 2].map(k => { const b = 100 + 3 * Math.sin(s) + k; return { _date: date, m: k, o: b, h: b + 2 + (s % 5), l: b - 1 - (s % 3), c: b + 1, v: 1, lv: [] }; }));
const de = (B, f) => hlc(B.filter(f));

// 5. Week and month completeness. Sept 1 2026 is a Tuesday, ISO week 36 opens Monday Aug 31.
{
  assert.equal(E.outils.premierOuvre('mois', '2026-09-01'), true, '1er septembre, mardi');
  assert.equal(E.outils.premierOuvre('mois', '2026-11-02'), true, 'lundi 2 novembre après un week-end');
  assert.equal(E.outils.premierOuvre('mois', '2026-11-03'), false, 'mardi 3 novembre');
  assert.equal(E.outils.premierOuvre('sem', '2026-09-07'), true, 'lundi');
  assert.equal(E.outils.premierOuvre('sem', '2026-09-01'), false, 'mardi');

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
  rec.length = 0; E.dessine(g(), defaut);
  let T = rec.filter(x => x.k === 'trait');
  assert.equal(T.length, 7, 'veille seule sur une séance visible');
  assert.ok(T.every(t => t.o.couleur === defaut.jourC), 'couleur journalière');
  assert.ok(T.every(t => t.p[1][0] === 1e6 && t.p[0][0] === N - 300), 'séance en cours jusqu\'au bord droit');
  assert.equal(T.filter(t => t.o.epaisseur === 1.5).length, 1, 'PP plus épais');
  assert.deepEqual(rec.filter(x => x.k === 'texte').map(x => x.s).sort(), ['PP', 'R1', 'R2', 'R3', 'S1', 'S2', 'S3']);

  rec.length = 0; E.dessine(g(), avec({ etiq: false }));
  assert.equal(rec.filter(x => x.k === 'texte').length, 0, 'sans étiquettes');
  rec.length = 0; E.dessine(g(), avec({ jour: false }));
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
  const B = jours('2026-09-22', '2026-10-16').flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => { const b = 7000 + 20 * Math.sin(s + m / 200); return { _date: date, m, o: b, h: b + 1, l: b - 1, c: b + 0.25, v: 1, lv: [] }; }));
  const G = Object.assign(g(B), { sym: 'MES' }), r = avec({ formule: 'fibonacci' });
  const t0 = performance.now(); E.dessine(G, r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 50; k++) E.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(froid < 8 && chaud < 1, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(3));
  const P = E.calcul(g(), defaut), dernier = prix(P.jour[P.jour.length - 1].niv);
  console.log('OK', N, 'barres ES,', db.sessions.length, 'séances | PP', dernier.PP.toFixed(2), 'R1', dernier.R1.toFixed(2), 'S1', dernier.S1.toFixed(2),
    '|', B.length, 'barres synthétiques, froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
