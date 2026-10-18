// Self-check for extensions/vwap_pro.js on real ES bars baked by Turning Trade.
// Run: node tests/vwap_pro_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/vwap_pro.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date, v: b.lv.reduce((a, l) => a + l[1] + l[2], 0) }, b));
const N = bars.length, tick = db.tick;
const J = e => !e || !e.length ? { n: 0, prix: () => 0, bid: () => 0, ask: () => 0 }
  : { n: e.length, prix: k => e[k][0], bid: k => e[k][1] || 0, ask: k => e[k][2] || 0 };

// No HFQSessionsMonde in the context: the study falls back to its built-in session defaults.
const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console }));
assert.equal(defs.length, 3, 'trois instances');
assert.deepEqual(defs.map(d => d.id), ['vwap-pro-a', 'vwap-pro-b', 'vwap-pro-c'], 'ids stables');
const A = defs[0];
const defaut = Object.fromEntries(A.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

const rec = [];
const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { rec.push({ k: 'fill', col: this.fillStyle, op: this.globalAlpha }); } };
const g = (B = bars, seance = 'eth', premiere = B.length - 300) => ({ n: B.length, premiere, derniere: B.length - 1, tick, seance, sym: 'ES', tf: 1, echelle: 1, ctx,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: 500 }, barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv), x: i => i, y: v => v,
  trait(p, o) { rec.push({ k: 'trait', p, o }); }, etiquette(p, o) { rec.push({ k: 'etiq', p, o }); }, ligne() {}, zone() {}, texte() {} });

// Brute-force VWAP and σ from the per-price volume of a set of bars.
const brute = bs => { let sv = 0, spv = 0, spv2 = 0; for (const b of bs) for (const [p, bid, ask] of b.lv) { const v = bid + ask; sv += v; spv += p * v; spv2 += p * p * v; } const vwap = spv / sv; return { vwap, sd: Math.sqrt(spv2 / sv - vwap * vwap) }; };
const cur = db.sessions[db.sessions.length - 1], iCur = N - cur.bars.length;
const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ' : ' + a + ' vs ' + b);

// 1. Daily anchor: the last bar carries the VWAP of the whole current session; the first bar of the session restarts the sums.
{
  const C = A.calcul(g(), defaut), B = brute(cur.bars);
  proche(C.vwap[N - 1], B.vwap, 'DVWAP'); proche(C.sd[N - 1], B.sd, 'σ journalière');
  proche(C.vwap[iCur], brute([cur.bars[0]]).vwap, 'remise à zéro à l\'ouverture');
  proche(C.vwap[iCur - 1], brute(db.sessions[db.sessions.length - 2].bars).vwap, 'veille complète');
}

// 2. Time zones: London 08:00 is 03:00 New York in October, Tokyo 09:00 is 20:00 New York the evening before.
{
  assert.equal(A.outils.versET(8 * 60, 'Europe/London', '2026-10-14'), 180, 'Londres → ET');
  assert.equal(A.outils.versET(9 * 60, 'Asia/Tokyo', '2026-10-14'), 1200, 'Tokyo → ET');
  assert.equal(A.outils.versET(9 * 60 + 30, 'America/Chicago', '2026-10-14'), 630, 'Chicago → ET');
  assert.deepEqual([...A.outils.bornesET('us', '2026-10-14', defaut)], [570, 960], 'RTH 09:30 → 16:00 ET');
  assert.deepEqual([...A.outils.bornesET('eu', '2026-10-14', defaut)], [180, 570], 'Europe 03:00 → 09:30 ET');
  assert.deepEqual([...A.outils.bornesET('asie', '2026-10-14', defaut)], [1080, 180], 'Asie 18:00 → 03:00 ET');
}

// 3. Session anchors on an ETH chart: RTH is m ∈ [930, 1320), Europe [540, 930), Asia [0, 540); outside, nothing.
{
  const fen = { us: [930, 1320], eu: [540, 930], asie: [0, 540] };
  for (const anc of Object.keys(fen)) {
    const C = A.calcul(g(), avec({ anc }));
    const dedans = [], dehors = [];
    for (let i = iCur; i < N; i++) (bars[i].m >= fen[anc][0] && bars[i].m < fen[anc][1] ? dedans : dehors).push(i);
    assert.ok(dehors.every(i => Number.isNaN(C.vwap[i])), anc + ' : rien hors séance');
    assert.ok(dedans.every(i => Number.isFinite(C.vwap[i])), anc + ' : une valeur par barre de séance');
    const fin = dedans[dedans.length - 1], B = brute(dedans.map(i => bars[i]));
    proche(C.vwap[fin], B.vwap, anc + ' : VWAP de séance'); proche(C.sd[fin], B.sd, anc + ' : σ de séance');
    proche(C.vwap[dedans[0]], brute([bars[dedans[0]]]).vwap, anc + ' : remise à zéro au début de séance');
  }
}

// 4. Forced hours in another zone: 09:30 Chicago = 10:30 New York = m 990, until 16:00 ET.
{
  const C = A.calcul(g(), avec({ anc: 'us', deb: '570', tz: 'America/Chicago' }));
  const premier = bars.findIndex((b, i) => i >= iCur && Number.isFinite(C.vwap[i]));
  assert.equal(bars[premier].m, 990, 'début forcé 09:30 Chicago');
  assert.ok(Number.isNaN(C.vwap[bars.findIndex((b, i) => i >= iCur && b.m === 1320)]), 'fin auto à 16:00 ET');
}

// 5. Weekly and monthly: all four loaded sessions share one ISO week and one month.
{
  const sem = new Set(db.sessions.map(s => A.outils.semaine(s.date.slice(0, 10))));
  assert.equal(sem.size, 1, 'jeu de données sur une seule semaine');
  const tout = brute(bars);
  proche(A.calcul(g(), avec({ anc: 'sem' })).vwap[N - 1], tout.vwap, 'wVWAP');
  proche(A.calcul(g(), avec({ anc: 'mois' })).vwap[N - 1], tout.vwap, 'mVWAP');
  assert.ok(Number.isFinite(A.calcul(g(), avec({ anc: 'sem' })).vwap[iCur]), 'la semaine ne repart pas à l\'ouverture');
}

// 6. Incremental cache: one more bar extends the sums instead of recomputing, same result as from scratch.
{
  const C1 = A.calcul(g(bars.slice(0, N - 1)), defaut);
  assert.equal(C1.n, N - 1);
  const C2 = A.calcul(g(), defaut);
  assert.equal(C2.n, N);
  proche(C2.vwap[N - 1], brute(cur.bars).vwap, 'extension d\'une barre');
  proche(C2.vwap[N - 2], brute(cur.bars.slice(0, -1)).vwap, 'barre précédente intacte');
}

// 7. Footprint-like bars without _date: sessions are split where m falls back.
{
  const sans = bars.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  const C = A.calcul(g(sans), defaut);
  proche(C.vwap[N - 1], brute(cur.bars).vwap, 'DVWAP sans _date');
  proche(C.vwap[iCur], brute([cur.bars[0]]).vwap, 'remise à zéro sans _date');
}

// 8. Drawing: one trait per line (VWAP + 2 per active level), one inner band per level with opacity > 0, labels.
{
  rec.length = 0; A.dessine(g(), defaut);
  const traits = rec.filter(x => x.k === 'trait');
  assert.equal(traits.length, 1 + 2 * 3, 'VWAP et trois paliers par défaut');
  assert.deepEqual(rec.filter(x => x.k === 'fill').map(x => x.op), [defaut.f1, defaut.f1, defaut.f2, defaut.f2, defaut.f3, defaut.f3], 'bandes intérieures, opacité de chaque palier');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 1, 'étiquette VWAP seule');
  const vwap = traits[traits.length - 1];
  assert.equal(vwap.o.couleur, defaut.vwapC, 'couleur perso du VWAP');
  assert.equal(vwap.p.filter(Boolean).length, 300, 'un point par barre visible');
  const sd1 = traits.find(t => t.o.couleur === defaut.c1);
  assert.ok(sd1 && sd1.o.pointille && sd1.o.pointille.length === 2, 'σ1 en tirets, couleur perso');

  const six = { on4: true, on5: true, on6: true, sd4: 2.5, sd5: 3.9, sd6: 0.5, f4: 0.1, f5: 0.1, f6: 0.1 };
  rec.length = 0; A.dessine(g(), avec({ ...six, theme: 'neon', etiq: 'tous', t1: 'plein' }));
  const T = rec.filter(x => x.k === 'trait');
  assert.equal(T.length, 1 + 2 * 6, 'six paliers');
  assert.equal(rec.filter(x => x.k === 'fill').length, 2 * 6, 'remplissages');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 1 + 2 * 6, 'étiquettes VWAP et bandes');
  assert.equal(T[T.length - 1].o.couleur, '#ffffff', 'VWAP du thème Néon');
  assert.ok(T.some(t => t.o.couleur === '#00f0ff' && t.o.pointille === null), 'σ1 néon, plein');

  // Only the band between σ4 and σ5 is filled: it belongs to σ5, the outer level.
  rec.length = 0; A.dessine(g(), avec({ on4: true, on5: true, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0.2 }));
  assert.deepEqual(rec.filter(x => x.k === 'fill').map(x => [x.col, x.op]), [[defaut.c5, 0.2], [defaut.c5, 0.2]], 'bande σ4 → σ5 seule');

  rec.length = 0; A.dessine(g(), avec({ on2: false, sd3: 0 }));
  assert.equal(rec.filter(x => x.k === 'trait').length, 3, 'case décochée ou multiplicateur nul : palier éteint');
  assert.equal(rec.filter(x => x.k === 'fill').length, 2, 'seule la bande de σ1');
  rec.length = 0; A.dessine(g(), avec({ vwapOn: false }));
  assert.equal(rec.filter(x => x.k === 'trait').length, 2 * 3, 'VWAP masqué, bandes gardées');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 0, 'pas d\'étiquette sans le trait');

  // Unsorted multipliers are filled from the inside out: the band 1σ→2.5σ takes the colour of the 2.5σ slot.
  rec.length = 0; A.dessine(g(), avec({ sd1: 2.5, sd2: 1, on3: false, f1: 0.1, f2: 0.1 }));
  const fills = rec.filter(x => x.k === 'fill');
  assert.deepEqual(fills.map(f => f.col), [defaut.c2, defaut.c2, defaut.c1, defaut.c1], 'paliers triés par multiplicateur');

  // TT's settings panel upper-cases every label except checkboxes: σ would read Σ.
  assert.equal(A.reglages.filter(x => x.type !== 'check' && /σ/.test(x.label)).map(x => x.k).join(), '', 'pas de σ hors des cases à cocher');
  assert.equal(A.reglages.filter(x => x.type === 'check').map(x => x.label.split(' ')[0]).join(), 'VWAP,σ1,σ2,σ3,σ4,σ5,σ6', 'une sous-section par trait');
}

// 9. Current period only: the view spans two sessions, only the last one is drawn.
{
  rec.length = 0; A.dessine(g(bars, 'eth', iCur - 200), avec({ hist: 'cour' }));
  const vwap = rec.filter(x => x.k === 'trait').pop();
  assert.equal(vwap.p.filter(Boolean).length, cur.bars.length, 'séance en cours seule');
  rec.length = 0; A.dessine(g(bars, 'eth', iCur - 200), defaut);
  assert.equal(rec.filter(x => x.k === 'trait').pop().p.filter(Boolean).length, cur.bars.length + 200, 'tout l\'historique');
}

// 10. Budget: cold compute on a fresh signature, then cached frames.
{
  const G = g(), r = avec({ anc: 'eu' });
  const t0 = performance.now(); A.dessine(G, r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 50; k++) A.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(froid < 8 && chaud < 1, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(3));
  const D = A.calcul(G, defaut);
  console.log('OK', N, 'barres,', db.sessions.length, 'séances | DVWAP', D.vwap[N - 1].toFixed(2), 'σ', D.sd[N - 1].toFixed(2), '| froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
