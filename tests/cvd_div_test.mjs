// Self-check for extensions/cvd_div.js on real ES bars baked by Turning Trade.
// Run: node tests/cvddiv_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/cvd_div.js'), 'utf8');
// Real bars baked by Turning Trade live in its data folder, not in the repo.
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const N = bars.length;

// Same semantics as hfq-ext.js J(): levels are [price, bid, ask].
const J = e => !e || !e.length ? { n: 0, deltaTotal: () => 0 }
  : { n: e.length, deltaTotal() { let d = 0; for (const r of e) d += (r[2] || 0) - (r[1] || 0); return d; } };

// Loads the file in a fresh context: HFQExt stub, HFQNotify stub that records pushes.
let defs, pushes, surch = {}, demandes = 0;
function charger() {
  defs = []; pushes = [];
  const HFQExt = {
    etude(d) { defs.push(d); return true; },
    redessiner() { demandes++; },
    etudes() {
      const p = defs.find(d => d.id === 'cvddiv-prix');
      return [{ id: 'ext:cvddiv-prix', params: p.reglages.map(x => ({ k: x.k, get: () => x.k in surch ? surch[x.k] : x.defaut })) }];
    }
  };
  // No HFQNotify in Turning Trade 0.4.6: the study falls back to desktop notifications.
  class Notification { constructor(titre, o) { pushes.push({ titre, texte: o && o.body }); } }
  Notification.permission = 'granted';
  vm.runInContext(SRC, vm.createContext({ HFQExt, window: {}, Notification, setTimeout: f => f(), performance, console, Math, String, Number, Object, Array, isNaN, isFinite, NaN, Infinity }));
  return { prix: defs.find(d => d.id === 'cvddiv-prix'), cvd: defs.find(d => d.id === 'cvddiv-cvd') };
}
let { prix, cvd } = charger();
const defaut = d => Object.fromEntries(d.reglages.map(x => [x.k, x.defaut]));

function g(B, premiere, derniere, rec) {
  return { premiere, derniere, n: B.length, tick: db.tick, seance: 'eth', sym: 'ES', tf: 1, echelle: 1, ctx: null,
    cadre: { gauche: 0, droite: 1000, haut: 0, bas: 500 },
    barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv), x: i => i, y: v => v,
    trait(p, o) { rec.push({ k: 'trait', p, o }); }, texte(x, y, s) { rec.push({ k: 'texte', x, s }); } };
}
function signaux(def, r, B = bars, premiere = 300, derniere = B.length - 1) {
  surch = r; const rec = [];
  def.dessine(g(B, premiere, derniere, rec), Object.assign(defaut(def), r));
  const out = [];
  for (let i = 0; i < rec.length - 1; i++) {
    const t = rec[i], e = rec[i + 1];
    if (t.k !== 'trait' || e.k !== 'texte') continue;
    const m = /^(UE|UA|DE|DA)(\d)(\?)?( ✗)?$/.exec(e.s);
    if (m) out.push({ t: m[1], n: +m[2], etat: m[3] ? 'formation' : m[4] ? 'cassee' : t.o.pointille ? 'attente' : 'confirmee', a: t.p[0][0], b: t.p[1][0], pa: t.p[0][1], pb: t.p[1][1], o: t.o });
  }
  out.preTir = rec.filter(x => x.k === 'texte' && /pré-tir$/.test(x.s)).map(x => x.s);
  return out;
}
const synthetique = (h, cvRef) => h.map((hh, i) => { const d = cvRef[i] - (i ? cvRef[i - 1] : 0);
  return { _date: '2026-01-02', m: i, o: hh - 1, h: hh, l: hh - 2, c: hh - 0.5, lv: [[hh, d < 0 ? -d : 0, d > 0 ? d : 0]] }; });

// 1. Two studies in one file.
assert.equal(defs.length, 2); assert.ok(prix && cvd);

// 2. A divergence that straddles an intermediate retained pivot (the ES 1000T case of
//    2026-10-16 16:38 -> 16:49 NY): A high, lower high in between with a slightly lower
//    CVD than B, then B higher high with a far lower CVD. Expected: one UE from A to B.
{
  const synth = synthetique(
    [100, 100, 101, 101, 102, 103, 104, 105, 106, 108, 110, 108, 106, 104, 103, 102, 101, 102, 103, 104, 105, 104, 103, 102, 101, 102, 104, 106, 108, 110, 112, 110, 108, 106, 104, 103, 102, 101, 100, 100],
    [0, 50, 100, 150, 200, 300, 450, 600, 800, 900, 1000, 900, 700, 500, 350, 200, 150, 180, 220, 240, 250, 230, 200, 150, 120, 100, 140, 200, 260, 290, 300, 280, 250, 230, 200, 180, 170, 160, 150, 140]);
  const s = signaux(prix, { conf: 'pivot', tol: 0 }, synth, 0);
  const ue = s.filter(x => x.t === 'UE' && x.n === 1);
  assert.deepEqual(ue.map(x => [x.a, x.b]), [[10, 30]], 'UE de A(10) à B(30) par-dessus le pivot intermédiaire 20 : ' + JSON.stringify(s));
}

// 3. Confirmed signals on real bars: classification invariants, same session, no line across the RTH split.
const conf = signaux(prix, { conf: 'pivot' });
assert.ok(conf.length > 20, 'des signaux');
for (const s of conf) {
  assert.equal(bars[s.a]._date, bars[s.b]._date, 'même séance');
  assert.equal((bars[s.a].m >= 930), (bars[s.b].m >= 930), 'même segment RTH');
  if (s.t === 'UE' || s.t === 'DA') assert.ok(s.pb >= s.pa, s.t + ' : prix plus haut ou égal');
  if (s.t === 'UA' || s.t === 'DE') assert.ok(s.pb <= s.pa, s.t + ' : prix plus bas ou égal');
  assert.ok(s.b - s.a > 3, 'pas deux barres du même plateau');
}
{ const vus = new Set(); for (const s of conf) { const k = s.n + ':' + s.b + ':' + s.t[0]; assert.ok(!vus.has(k), 'une seule ligne par pivot B et par sens'); vus.add(k); } }
// Two B pivots on the same side are never closer than p1 bars: a flat top is one pivot.
for (const s of conf) for (const u of conf) if (s !== u && s.t[0] === u.t[0] && s.n === u.n) assert.ok(Math.abs(s.b - u.b) > 3, 'pas deux B sur un même plateau : ' + s.b + ' / ' + u.b);
// A two-bar flat top at A and at B gives one UE, anchored on the last bar of each plateau.
{
  const synth = synthetique(
    [100, 100, 101, 101, 102, 103, 104, 105, 106, 110, 110, 108, 106, 104, 103, 102, 101, 102, 103, 104, 105, 104, 103, 102, 101, 102, 104, 106, 108, 112, 112, 110, 108, 106, 104, 103, 102, 101, 100, 100],
    [0, 50, 100, 150, 200, 300, 450, 600, 800, 900, 1000, 900, 700, 500, 350, 200, 150, 180, 220, 240, 250, 230, 200, 150, 120, 100, 140, 200, 260, 290, 300, 280, 250, 230, 200, 180, 170, 160, 150, 140]);
  const ue = signaux(prix, { conf: 'pivot', tol: 1 }, synth, 0).filter(x => x.t === 'UE');
  assert.deepEqual(ue.map(x => [x.a, x.b]), [[10, 30]], 'plateaux : un seul UE, sur la dernière barre : ' + JSON.stringify(ue));
}

// 4. Equal highs/lows are accepted ; states : broken dashed and hideable, confirmed solid, no level duplicates.
assert.ok(conf.some(s => s.pa === s.pb), 'doubles sommets ou creux acceptés');
const casses = conf.filter(s => s.etat === 'cassee'), confirmees = conf.filter(s => s.etat === 'confirmee');
assert.ok(casses.length > 0 && casses.every(s => s.o.pointille), 'cassées en pointillé');
assert.ok(confirmees.length > 0 && confirmees.every(s => !s.o.pointille), 'confirmées en trait plein');
const sansCassees = signaux(prix, { conf: 'pivot', voirCassees: false });
assert.ok(sansCassees.length === conf.length - casses.length && sansCassees.every(s => s.etat !== 'cassee'), 'option Montrer les cassées');
{ const vus = new Set(); for (const s of conf) { const k = s.t + ':' + s.a + ':' + s.b; assert.ok(!vus.has(k), 'une paire A..B dessinée une seule fois'); vus.add(k); } }
assert.ok(signaux(prix, { conf: 'pivot', minF: 0.5 }).length < conf.length, 'force relative mini');

// 5. The RTH anchor changes the result (CVD reset at 09:30 on an ETH chart).
assert.notEqual(JSON.stringify(signaux(prix, { conf: 'pivot', anc: 'rth' })), JSON.stringify(signaux(prix, { conf: 'pivot', anc: 'eth' })));

// 6. CVD floor and tolerance actually filter.
assert.ok(signaux(prix, { conf: 'pivot', minD: 250 }).length < conf.length, 'plancher CVD');
assert.ok(signaux(prix, { conf: 'pivot', tol: 0 }).length < conf.length, 'tolérance 0 plus stricte');

// 7. CVD pane follows the price study settings and draws the same signals on CVD pivots.
const pane = signaux(cvd, { conf: 'pivot' });
assert.equal(pane.length, conf.length, 'mêmes signaux dans le volet');
assert.ok(pane.every((s, i) => s.t === conf[i].t && s.n === conf[i].n), 'mêmes types et niveaux');
// A non-default setting of the price study reaches the pane (fewer signals with tolerance 0).
assert.equal(signaux(cvd, { conf: 'pivot', tol: 0 }).length, signaux(prix, { conf: 'pivot', tol: 0 }).length, 'tolérance lue sur l\'étude prix');

// 8. Pre-shot zone: price comes back within preZ ticks of the last retained high while CVD
//    sits far below it. Expected: one label 'UE pré-tir'. Off by setting, gone out of range.
{
  const synth = synthetique(
    [100, 100, 101, 101, 102, 103, 104, 105, 106, 108, 110, 108, 106, 104, 103, 102, 101, 102, 103, 104, 105, 106, 107, 108, 109, 109.5],
    [0, 50, 100, 150, 200, 300, 450, 600, 800, 900, 1000, 900, 700, 500, 350, 200, 150, 150, 160, 170, 180, 200, 230, 260, 280, 300]);
  assert.deepEqual(signaux(prix, { conf: 'pivot', tol: 0 }, synth, 0).preTir, ['UE pré-tir'], 'zone de pré-tir UE');
  assert.deepEqual(signaux(prix, { conf: 'pivot', tol: 0, pre: false }, synth, 0).preTir, [], 'pré-tir désactivable');
  assert.deepEqual(signaux(prix, { conf: 'pivot', tol: 0, preZ: 1 }, synth, 0).preTir, [], 'hors distance');
}

// 9. Notifications, in a fresh load: the first frame only primes the memory, the next frame
//    with 40 more bars notifies the recent formations and confirmations once, never the history.
{
  // Bar by bar, as live frames arrive: an event older than 2*p1 bars is never replayed.
  const rejouer = (r) => { ({ prix } = charger()); surch = {}; const rec = [];
    prix.dessine(g(bars, N - 1380 + 300, N - 41, rec), r);
    assert.equal(pushes.length, 0, 'aucune notification au premier passage');
    for (let d = N - 40; d <= N - 1; d++) prix.dessine(g(bars, N - 1380 + 300, d, rec), r);
    return rec; };
  const r = defaut(prix), rec = rejouer(r);
  const n1 = pushes.length;
  assert.ok(n1 > 0 && pushes.every(m => m.titre === 'Divergence CVD' && /^ES · (UE|UA|DE|DA)\d (en formation|confirmée) à /.test(m.texte)), 'notifications des nouveaux signaux : ' + JSON.stringify(pushes.slice(0, 2)));
  prix.dessine(g(bars, N - 1380 + 300, N - 1, rec), r);
  assert.equal(pushes.length, n1, 'une seule fois par signal');
  console.log('  notifications sur 40 barres :', n1, '| exemple :', pushes[0].texte);
  rejouer(Object.assign({}, r, { alForm: false, alConf: false }));
  assert.equal(pushes.length, 0, 'alertes désactivables');
}

// 10. Budget: one visible session for both studies, cold then warm, under 8 ms.
({ prix, cvd } = charger()); surch = {};
const rec = [];
const G = g(bars, N - 1380 + 300, N - 1, rec), rp = defaut(prix), rc = defaut(cvd);
const tf = performance.now(); prix.dessine(G, rp); const froid = performance.now() - tf; cvd.dessine(G, rc);
const t0 = performance.now(); for (let k = 0; k < 50; k++) { prix.dessine(G, rp); cvd.dessine(G, rc); }
const ms = (performance.now() - t0) / 50;
assert.ok(froid < 8 && ms < 8, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + ms.toFixed(2));

// 11. Wicks of the CVD pane, read from the tape. Same shape as hfq-ext.js X(): times in
//     centiseconds since the open, avant(s) = last print at or before s seconds.
function ruban(cs, sz, sd) {
  return { n: cs.length, t: k => cs[k] / 100, prix: () => 0, taille: k => sz[k], achat: k => sd[k] === 1,
    avant(s) { const a = s * 100; let u = 0, c = cs.length; while (u < c) { const l = (u + c) >> 1; if (cs[l] <= a) u = l + 1; else c = l; } return u - 1; } };
}
// Canvas stub recording fillRect; x = 10 px per bar so a 1 px wick never looks like a 6.2 px body.
function toile() {
  let fs = null; const rects = [];
  let chemin = [];
  const t = { rects, fillRect(x, y, w, h) { rects.push({ x, y, w, h, fs }); }, get fillStyle() { return fs; }, set fillStyle(v) { fs = v; },
    beginPath() { chemin = []; }, rect(x, y, w, h) { chemin.push({ x, y, w, h }); }, fill() { for (const q of chemin) { q.fs = fs; rects.push(q); } } };
  return new Proxy(t, { get: (o, k) => k in o ? o[k] : () => {} });
}
// Draws frames until the study stops asking for a redraw; `images`, `pire` (worst frame, ms) and `suspendue`
// (three frames in a row over 8 ms, TT's suspension rule, so a lone GC pause does not count) are kept.
let images, pire, suspendue;
function meches(B, P, r = {}, premiere = 0) {
  let M, lents = 0;
  for (images = 0, pire = 0, suspendue = false, demandes = 1; demandes; images++) {
    assert.ok(images < 50, 'rattrapage fini');
    demandes = 0;
    const c = toile(), G = Object.assign(g(B, premiere, B.length - 1, []), { ctx: c, x: i => i * 10, prints: P });
    const t = performance.now(); cvd.dessine(G, Object.assign(defaut(cvd), r)); const ms = performance.now() - t;
    pire = Math.max(pire, ms); lents = ms > 8 ? lents + 1 : 0; suspendue ||= lents >= 3;
    M = Object.fromEntries(c.rects.filter(q => q.w === 1).map(q => [Math.round(q.x / 10), [q.y, q.y + q.h]]));
  }
  return M;
}
{
  ({ prix, cvd } = charger()); surch = {};
  const d = [1, 2, 3, -1, -2, 4, 0, 1, 2, 5, -3, 2];
  const B = d.map((x, m) => ({ _date: '2026-01-02', m, o: 100, h: 101, l: 99, c: 100, lv: [[100, x < 0 ? -x : 0, x > 0 ? x : 0]] }));
  // Bar 9: +10 -7 +2 (last print 1 cs before bar 10), bar 10: -4 +6 -5 from its first
  // centisecond, bar 11: +1 against a level delta of +2, so no wick.
  const T = [[54500, 10, 1], [55000, 7, 0], [59999, 2, 1], [60000, 4, 0], [61000, 6, 1], [62000, 5, 0], [66500, 1, 1]];
  const P = k => ruban(T.slice(0, k).map(p => p[0]), T.map(p => p[1]), T.map(p => p[2]));
  // Opening CVD of bar 9 is 10, of bar 10 is 15: wicks 10..20 and 11..17.
  const attendu = { 9: [10, 20], 10: [11, 17] };
  assert.deepEqual(meches(B, P(5)), { 9: [10, 20] }, 'barre 10 incomplète : delta tape ≠ niveaux, pas de mèche');
  assert.deepEqual(meches(B, P(7)), attendu, 'barre en formation étendue par ses nouveaux prints');
  assert.deepEqual(meches(B, P(5)), { 9: [10, 20] }, 'retour en arrière du replay');
  ({ prix, cvd } = charger());
  assert.deepEqual(meches(B, P(7)), attendu, 'même résultat à froid');
  assert.deepEqual(meches(B, P(7), { meches: false }), {}, 'mèches désactivables');
  assert.deepEqual(meches(B, null), {}, 'sans tape, corps seul');
}
const DATA = path.dirname(DB);
function tapeReelle(sym, date) {
  const f = path.join(DATA, '_hmrust_rec_' + sym + '_' + date + '.dots');
  if (!fs.existsSync(f)) return null;
  const buf = fs.readFileSync(f), n = buf.length >> 4, cs = new Uint32Array(n), sz = new Uint32Array(n), sd = new Uint8Array(n);
  // 16-byte records: centiseconds since the open, price row, size, side (1 = buyer aggressor).
  for (let k = 0, o = 0; k < n; k++, o += 16) { cs[k] = buf.readUInt32LE(o); sz[k] = buf.readUInt32LE(o + 8); sd[k] = buf.readUInt32LE(o + 12); }
  return { cs, sz, sd };
}
{
  // Last session of the archive against its recorded tape, all sessions on the chart: only
  // the tape day gets wicks, and exactly where the per-minute tape delta equals the levels.
  const date = bars[N - 1]._date, R = tapeReelle('ES', date);
  if (!R) console.warn('pas d\'enregistrement de tape, mèches réelles sautées :', date);
  else {
    ({ prix, cvd } = charger()); surch = {};
    const parMin = new Map();
    for (let k = 0; k < R.cs.length; k++) {
      const m = Math.floor(R.cs[k] / 6000), e = parMin.get(m) || { run: 0, h: 0, l: 0 };
      e.run += R.sd[k] === 1 ? R.sz[k] : -R.sz[k]; e.h = Math.max(e.h, e.run); e.l = Math.min(e.l, e.run); parMin.set(m, e);
    }
    const M = meches(bars, ruban(R.cs, R.sz, R.sd), {}, 300);
    const attendu = {};
    let cum = 0, cle = null;
    for (let i = 0; i < N; i++) {
      const b = bars[i], k = b._date + (b.m >= 930 ? 'R' : ''), dl = J(b.lv).deltaTotal();
      if (k !== cle) { cum = 0; cle = k; }
      const e = b._date === date && parMin.get(b.m);
      if (i >= 300 && e && e.run === dl) attendu[i] = [cum + e.l, cum + e.h];
      cum += dl;
    }
    assert.ok(Object.keys(attendu).length > 50, 'des minutes couvertes par la tape');
    assert.deepEqual(M, attendu, 'mèches = extrêmes du delta cumulé de la tape, minute par minute');
    console.log('  mèches ES', date, ':', Object.keys(M).length, 'barres sur', bars.filter(b => b._date === date).length, 'de la séance');
  }
  // Budget on the busiest recorded session, all of it visible: cold pass over the whole tape, then warm.
  const date2 = '2026-10-16', R2 = tapeReelle('ES', date2);
  if (R2) {
    const B = db.sessions.find(s => s.date === date2).bars.map(b => Object.assign({ _date: date2 }, b)), P = ruban(R2.cs, R2.sz, R2.sd);
    ({ prix, cvd } = charger()); surch = {};
    // Catch-up frames, then warm frames, never three in a row over 8 ms.
    const M = meches(B, P), n = images, froid = pire, suspFroid = suspendue;
    meches(B, P); const chaud = pire;
    assert.ok(n > 1 && !suspFroid && !suspendue, 'budget mèches 8 ms, pire image ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(2));
    ({ prix, cvd } = charger()); surch = {};
    const fin = meches(B, P, {}, B.length - 30);
    // The CVD starts at the window start, so a shifted window shifts the wicks: compare their spans.
    const long = w => w && w[1] - w[0];
    assert.ok(Object.keys(fin).length > 0 && Object.keys(fin).every(i => long(M[i]) === long(fin[i])), 'rattrapage = passage direct sur les barres visibles');
    console.log('  mèches ES', date2, ':', R2.cs.length, 'prints,', Object.keys(M).length, 'barres |', n, 'images de rattrapage, pire', froid.toFixed(2), 'ms, chaud', chaud.toFixed(2), 'ms');
  }
}

const parType = {}; for (const s of conf) parType[s.t + s.n] = (parType[s.t + s.n] || 0) + 1;
console.log('OK', N, 'barres,', conf.length, 'signaux', JSON.stringify(parType), '| confirmées', confirmees.length, '| cassées', casses.length, '| en attente', conf.filter(s => s.etat === 'attente').length, '| égalités', conf.filter(s => s.pa === s.pb).length, '| calcul à froid', froid.toFixed(2), 'ms, deux études à chaud', ms.toFixed(2), 'ms/image');
