// Self-check for extensions/confluence.js on real ES bars baked by Turning Trade.
// Run: node tests/confluence_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/confluence.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
// The archive grows live and holds cut recordings: the chart ends after the last session that reaches 16:00 ET
// with a previous session that does too, so the RTH levels and the previous day exist.
const complete = s => s && s.bars.some(b => b.m >= 1320);
const sessions = db.sessions.slice(0, db.sessions.findLastIndex((s, k) => complete(s) && complete(db.sessions[k - 1])) + 1);
const bars = [];
for (const s of sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date, v: b.lv.reduce((a, l) => a + l[1] + l[2], 0) }, b));
const N = bars.length, tick = db.tick;
const J = e => !e || !e.length ? { n: 0, prix: () => 0, bid: () => 0, ask: () => 0 }
  : { n: e.length, prix: k => e[k][0], bid: k => e[k][1] || 0, ask: k => e[k][2] || 0 };

const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console, Math, Date, String, Number, Object, Array, isNaN, isFinite, NaN, Infinity }));
const def = defs[0];
const defaut = Object.fromEntries(def.reglages.map(x => [x.k, x.defaut]));
const rec = [];
const g = (B = bars, seance = 'eth') => ({ n: B.length, premiere: B.length - 300, derniere: B.length - 1, tick, seance, sym: 'ES', tf: 1, echelle: 1, ctx: null,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: 500 }, barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv), x: i => i, y: v => v,
  zone(a, b, o) { rec.push({ k: 'zone', a, b, o }); }, ligne(p, o) { rec.push({ k: 'ligne', p, o }); }, etiquette(p, o) { rec.push({ k: 'etiq', p, o }); }, texte() {} });

const R = def.calcul(g(), defaut);
const niv = Object.fromEntries(R.niveaux.map(l => [l.nom, l.prix]));
const cur = sessions[sessions.length - 1], veille = sessions[sessions.length - 2];
const rthCur = cur.bars.filter(b => b.m >= 930);
const hist = (bs) => { const vol = new Map(); let sv = 0; for (const b of bs) for (const [p, bid, ask] of b.lv) { vol.set(p, (vol.get(p) || 0) + bid + ask); sv += bid + ask; } return { vol, sv }; };

// 1. Daily VWAP and bands from the per-price volume of the whole session.
{
  let sv = 0, spv = 0, spv2 = 0;
  for (const b of cur.bars) for (const [p, bid, ask] of b.lv) { const v = bid + ask; sv += v; spv += p * v; spv2 += p * p * v; }
  const vwap = spv / sv, sd = Math.sqrt(spv2 / sv - vwap * vwap);
  assert.ok(Math.abs(niv.DVWAP - vwap) < 1e-6, 'DVWAP');
  assert.ok(Math.abs(niv['DVWAP+2'] - (vwap + 2 * sd)) < 1e-6 && Math.abs(niv['DVWAP-1'] - (vwap - sd)) < 1e-6, 'bandes σ');
}

// 2. Weekly VWAP over the sessions of the current ISO week (all four loaded sessions here).
{
  const sem = d => { const x = new Date(d + 'T00:00:00Z'); const j = x.getUTCDay() || 7; x.setUTCDate(x.getUTCDate() + 4 - j); return x.getUTCFullYear() + '-' + Math.ceil(((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7); };
  const semCur = sem(cur.date.slice(0, 10));
  let sv = 0, spv = 0;
  for (const s of sessions) if (sem(s.date.slice(0, 10)) === semCur) for (const b of s.bars) for (const [p, bid, ask] of b.lv) { sv += bid + ask; spv += p * (bid + ask); }
  assert.ok(Math.abs(niv.wVWAP - spv / sv) < 1e-6, 'wVWAP');
  const semaines = new Set(sessions.map(s => sem(s.date.slice(0, 10))));
  if (semaines.size > 1) assert.ok('wPP' in niv, 'pivots hebdo présents'); else assert.ok(!('wPP' in niv), 'pas de pivots hebdo sans semaine précédente');
}

// 3. Volume profile on the RTH portion once RTH is open: POC is the busiest price, value area ≥ 70 %.
{
  const { vol, sv } = hist(rthCur);
  const poc = [...vol.entries()].sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(niv.RTHPOC, poc, 'RTHPOC');
  assert.ok(niv.RTHVAL <= niv.RTHPOC && niv.RTHPOC <= niv.RTHVAH, 'POC dans la zone de valeur');
  let va = 0; for (const [p, v] of vol) if (p >= niv.RTHVAL && p <= niv.RTHVAH) va += v;
  assert.ok(va >= 0.7 * sv, 'zone de valeur ≥ 70 %');
  const tout = def.calcul(g(), Object.assign({}, defaut, { vpRth: false }));
  const { vol: volT } = hist(cur.bars);
  assert.equal(tout.niveaux.find(l => l.nom === 'POC').prix, [...volT.entries()].sort((a, b) => b[1] - a[1])[0][0], 'POC de la séance entière sans vpRth');
}

// 4. TPO profile: each 30-minute period covers every tick of its high-low range; the TPOC
//    is a price covered by the most periods of the RTH portion.
{
  const per = new Map();
  for (const b of rthCur) { const k = Math.floor(b.m / 30), p = per.get(k) || { lo: Infinity, hi: -Infinity }; p.lo = Math.min(p.lo, b.l); p.hi = Math.max(p.hi, b.h); per.set(k, p); }
  const compte = prix => [...per.values()].filter(p => prix >= p.lo - 1e-9 && prix <= p.hi + 1e-9).length;
  let max = 0; for (const p of per.values()) for (let t = Math.round(p.lo / tick); t <= Math.round(p.hi / tick); t++) max = Math.max(max, compte(t * tick));
  assert.equal(compte(niv.TPOC), max, 'TPOC');
  assert.ok(niv.TVAL <= niv.TPOC && niv.TPOC <= niv.TVAH, 'TPOC dans sa zone de valeur');
}

// 5. Previous day on its RTH portion: PDH/PDL/PDC, floor pivots, previous-day profile.
{
  const rth = veille.bars.filter(b => b.m >= 930);
  const H = Math.max(...rth.map(b => b.h)), L = Math.min(...rth.map(b => b.l)), C = rth[rth.length - 1].c;
  assert.deepEqual([niv.PDH, niv.PDL, niv.PDC], [H, L, C], 'veille RTH');
  const pp = (H + L + C) / 3;
  assert.ok(Math.abs(niv.PP - pp) < 1e-9 && Math.abs(niv.R1 - (2 * pp - L)) < 1e-9 && Math.abs(niv.S2 - (pp - (H - L))) < 1e-9, 'pivots journaliers');
  const { vol } = hist(rth);
  assert.equal(niv.pdPOC, [...vol.entries()].sort((a, b) => b[1] - a[1])[0][0], 'pdPOC');
  const Rall = def.calcul(g(), Object.assign({}, defaut, { pdRth: false }));
  assert.equal(Rall.niveaux.find(l => l.nom === 'PDH').prix, Math.max(...veille.bars.map(b => b.h)), 'veille sur la séance entière quand pdRth est décoché');
}

// 6. Opens and ranges: ETH, 0h, H4, RTH opens; opening range, initial balance, overnight, HOD/LOD.
{
  const last = cur.bars[cur.bars.length - 1], h4 = Math.floor(last.m / 240) * 240;
  assert.equal(niv.OpenETH, cur.bars[0].o, 'ouverture ETH');
  assert.equal(niv.Open0h, cur.bars.find(b => b.m >= 360).o, 'ouverture 0h');
  assert.equal(niv.OpenH4, cur.bars.find(b => b.m >= h4).o, 'ouverture H4');
  assert.equal(niv.OpenRTH, cur.bars.find(b => b.m >= 930).o, 'ouverture RTH');
  const or = cur.bars.filter(b => b.m >= 930 && b.m < 945), ib = cur.bars.filter(b => b.m >= 930 && b.m < 990), on = cur.bars.filter(b => b.m < 930);
  assert.deepEqual([niv.ORH, niv.ORL], [Math.max(...or.map(b => b.h)), Math.min(...or.map(b => b.l))], 'plage d\'ouverture');
  assert.deepEqual([niv.IBH, niv.IBL], [Math.max(...ib.map(b => b.h)), Math.min(...ib.map(b => b.l))], 'balance initiale');
  assert.deepEqual([niv.ONH, niv.ONL], [Math.max(...on.map(b => b.h)), Math.min(...on.map(b => b.l))], 'overnight');
  assert.deepEqual([niv.HOD, niv.LOD], [Math.max(...cur.bars.map(b => b.h)), Math.min(...cur.bars.map(b => b.l))], 'HOD/LOD');
}

// 7. Zones: sorted, bounded width, score = number of levels, every level inside its zone.
{
  const largeur = defaut.largeur * tick;
  let prev = -Infinity;
  for (const z of R.zones) {
    assert.ok(z.bas >= prev, 'zones triées'); prev = z.haut;
    assert.ok(z.haut - z.bas <= 2 * largeur + 1e-9, 'largeur bornée');
    assert.equal(z.score, z.items.length, 'score');
    for (const l of z.items) assert.ok(l.prix >= z.bas && l.prix <= z.haut, 'niveau dans sa zone');
  }
  assert.equal(R.zones.reduce((a, z) => a + z.items.length, 0), R.niveaux.length, 'chaque niveau dans une zone');
}

// 8. Drawing without a canvas: one zone and one label per cluster at or above minScore, glow lines only near the price.
{
  rec.length = 0; def.dessine(g(), defaut);
  const attendu = R.zones.filter(z => z.score >= defaut.minScore).length;
  assert.equal(rec.filter(x => x.k === 'zone').length, attendu, 'zones dessinées');
  assert.equal(rec.filter(x => x.k === 'etiq').length, attendu, 'étiquettes');
  const marge = tick * defaut.prox, pad = tick * defaut.largeur / 2;
  const proches = R.zones.filter(z => z.score >= defaut.minScore && R.prix >= z.bas - pad - marge && R.prix <= z.haut + pad + marge).length;
  const seuls = R.zones.filter(z => z.score < defaut.minScore).reduce((a, z) => a + z.items.length, 0);
  assert.equal(rec.filter(x => x.k === 'ligne').length, 2 * proches + seuls, 'halo de proximité et niveaux isolés');
  rec.length = 0; def.dessine(g(), Object.assign({}, defaut, { minScore: 1 }));
  assert.equal(rec.filter(x => x.k === 'zone').length, R.zones.length, 'minScore 1 montre tout');
}

// 9. Switching sources off removes their levels.
{
  const sans = def.calcul(g(), Object.assign({}, defaut, { vwap: false, vwapH: false, tpo: false, orMin: 0, ibMin: 0 }));
  assert.ok(!sans.niveaux.some(l => l.src === 'vwap' || l.src === 'tpo' || l.src === 'or'), 'sources désactivables');
}

// Bars inserted before the last one read (tick history filling a missing day, the previous one included):
// the levels are those of a fresh computation, in a fresh context.
{
  const frais = () => { const d = []; vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(x) { d.push(x); return true; } }, console, Math, Date, String, Number, Object, Array, isNaN, isFinite, NaN, Infinity })); return d[0]; };
  for (const s of [sessions[1], veille]) {
    const T = frais();
    T.calcul(g(bars.filter(b => b._date !== s.date)), defaut);
    assert.deepEqual(JSON.parse(JSON.stringify(T.calcul(g(), defaut).niveaux)), JSON.parse(JSON.stringify(frais().calcul(g(), defaut).niveaux)), 'insertion de la séance ' + s.date);
  }
}

// 10. Budget: cold compute on a fresh key, then cached.
{
  const G = g(); const r = Object.assign({}, defaut, { largeur: 7 });
  const t0 = performance.now(); def.dessine(G, r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 50; k++) def.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(froid < 8 && chaud < 1, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(3));
  console.log('OK', N, 'barres,', R.niveaux.length, 'niveaux,', R.zones.length, 'zones dont', R.zones.filter(z => z.score >= 2).length, 'à score ≥ 2 | froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
  console.log('  zones :', R.zones.filter(z => z.score >= 2).map(z => z.score + ' · ' + z.items.map(l => l.nom).join(' ') + ' @ ' + z.bas + (z.haut > z.bas ? '–' + z.haut : '')).join(' | '));
}
