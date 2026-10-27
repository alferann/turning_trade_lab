// Self-check for extensions/absorption.js: synthetic bars for each signature and each
// resumption rule, real ES and NQ bars baked by Turning Trade for counts, incremental
// against full computation and timing, real tape recorded by the heatmap (.dots) for
// the tape proxy.
// Run: node tests/absorption_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/absorption.js'), 'utf8');
// TT's market calendar (hfq-sessions.js): full CME closures (New Year, Good Friday, Christmas) are no missing day.
const HFQSessions = (() => { const c = {}; vm.runInContext(fs.readFileSync(path.join(process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload', 'hfq-sessions.js'), 'utf8'), vm.createContext(c)); return c.HFQSessions; })();
const DATA = process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade');
const TICK = 0.25;

// Same semantics as hfq-ext.js J(): levels are [price, bid, ask], order not guaranteed.
const J = e => {
  e = e || [];
  return { n: e.length, prix: k => e[k][0], bid: k => e[k][1] || 0, ask: k => e[k][2] || 0,
    haut: () => e.length ? Math.max(...e.map(x => x[0])) : null, bas: () => e.length ? Math.min(...e.map(x => x[0])) : null };
};
const SANS_TAPE = { n: 0, t: () => 0, prix: () => 0, taille: () => 0, achat: () => false, avant: () => -1 };

// Loads the file in a fresh context; etudes() serves the absorption settings with `surch` on top.
let defs, pushes, surch = {};
function charger() {
  defs = []; pushes = []; surch = {};
  const HFQExt = {
    etude(d) { defs.push(d); return true; },
    etudes() {
      const a = defs.find(d => d.id === 'absorption');
      return [{ id: 'ext:absorption', params: a.reglages.map(x => ({ k: x.k, get: () => x.k in surch ? surch[x.k] : x.defaut })) }];
    }
  };
  class Notification { constructor(titre, o) { pushes.push({ titre, texte: o && o.body }); } }
  Notification.permission = 'granted';
  vm.runInContext(SRC, vm.createContext({ HFQExt, window: {}, Notification, performance, console, HFQSessions }));
  return { abs: defs.find(d => d.id === 'absorption'), rep: defs.find(d => d.id === 'absorption-reprise') };
}
let { abs, rep } = charger();
assert.deepEqual(defs.map(d => d.id), ['absorption', 'absorption-reprise'], 'ids stables');
const defaut = d => Object.fromEntries(d.reglages.map(x => [x.k, x.defaut]));
const RA = (o = {}) => Object.assign(defaut(abs), o), RR = (o = {}) => Object.assign(defaut(rep), o);

const ctx = rec => new Proxy({}, { get: (t, k) => k === 'fillRect' ? (...a) => rec.push({ k: 'zone', a }) : (k in t ? t[k] : () => {}), set: (t, k, v) => (t[k] = v, true) });
function g(B, { prints = SANS_TAPE, rec = [], sym = 'ES', premiere = 0 } = {}) {
  return { n: B.length, premiere, derniere: B.length - 1, tick: TICK, seance: 'eth', sym, tf: 1, graphe: 'footprint', echelle: 1,
    cadre: { gauche: 0, droite: 1e6, haut: 0, bas: 1e6 }, barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv),
    prints, x: i => i, y: v => v, ctx: ctx(rec),
    trait(p, o) { rec.push({ k: 'trait', p, o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } };
}
// The shared engine reads with a time budget: call until it has caught up.
const complet = (G, r) => { let C; for (let k = 0; k < 1e4 && !(C = abs.calcul(G, r)).pret; k++); return C; };
const vue = e => ({ i: e.i, s: e.s, tags: e.tags.join('+'), haut: e.haut, bas: e.bas, fin: e.fin });

// ── Synthetic bars ──────────────────────────────────────────────────────────────────────────
// Five ticks from `base`; `lv` gives [bid, ask] per tick from the low, listed high to low like the archive.
let mn = 0;
function barre(base, o, c, lv) {
  const L = lv.map(([bi, as], k) => [base + k * TICK, bi, as]).reverse();
  return { m: mn++, o: base + o * TICK, c: base + c * TICK, h: base + (lv.length - 1) * TICK, l: base, v: 0, lv: L };
}
const hausse = base => barre(base, 1, 3, [[10, 12], [10, 12], [10, 12], [10, 12], [10, 12]]);   // delta +10, closes up
const baisse = base => barre(base, 3, 1, [[12, 10], [12, 10], [12, 10], [12, 10], [12, 10]]);   // delta -10, closes down
const fond = (n, base = 5000) => Array.from({ length: n }, (_, k) => k % 2 ? baisse(base) : hausse(base));
const forme = base => hausse(base);   // the bar still forming, never judged

// 1. Volume trapped at the high: 200 lots lifted on the top two ticks, close back near the low, delta flat.
{
  mn = 0;
  const B = fond(120).concat([barre(5000, 3, 1, [[10, 10], [50, 10], [150, 10], [10, 100], [10, 100]]), forme(5000)]);
  const C = complet(g(B), RA());
  assert.deepEqual(Array.from(C.ev, vue), [{ i: 120, s: -1, tags: 'ext', haut: 5001, bas: 5000.75, fin: -1 }], 'volume piégé au haut seul');
  assert.equal(C.ev[0].vols[0], 200, 'volume absorbé');
  // Below the threshold, or with the close at the high, nothing.
  assert.equal(complet(g(B), RA({ extK: 10 })).ev.length, 0, 'sous 10 × la médiane');
  const B2 = B.slice(); B2[120] = Object.assign({}, B[120], { c: 5001 });
  assert.equal(complet(g(B2), RA()).ev.length, 0, 'clôture au plus haut : pas d\'absorption');
  assert.equal(complet(g(B), RA({ ext: false })).ev.length, 0, 'signature coupée');
  // The zone dies at the first close above it.
  const B3 = B.slice(0, 121).concat([hausse(5000), barre(5001, 1, 3, [[10, 12], [10, 12], [10, 12], [10, 12], [10, 12]]), forme(5001)]);
  assert.equal(complet(g(B3), RA()).ev[0].fin, 122, 'zone traversée par la clôture 5001.75');
}

// 2. Effort without result: delta -120, the bar still closes up. Zone from the low to the most hit bid.
{
  mn = 0;
  const B = fond(120).concat([barre(5000, 1, 3, [[40, 20], [60, 20], [40, 20], [40, 20], [40, 20]]), forme(5000)]);
  const C = complet(g(B), RA());
  assert.deepEqual(Array.from(C.ev, vue), [{ i: 120, s: 1, tags: 'eff', haut: 5000.25, bas: 5000, fin: -1 }], 'effort sans résultat');
  assert.equal(C.ev[0].vols[0], 120, '|delta|');
  // The same delta with a close down is a result, not an absorption.
  const B2 = B.slice(); B2[120] = Object.assign({}, B[120], { o: 5000.75, c: 5000.25 });
  assert.equal(complet(g(B2), RA()).ev.length, 0, 'delta suivi d\'effet');
}

// 3. Level defended: three lows on 5000 with 70 lots hit there, within 15 bars, no close below.
{
  mn = 0;
  const test = () => barre(5000, 1, 4, [[35, 10], [35, 10], [10, 30], [10, 20], [10, 12]]);
  const B = fond(120).concat([test(), hausse(5000), test(), hausse(5000), test(), forme(5000)]);
  const C = complet(g(B), RA());
  assert.deepEqual(Array.from(C.ev, vue), [{ i: 124, s: 1, tags: 'niv', haut: 5000, bas: 5000, fin: -1 }], 'troisième test');
  assert.equal(C.ev[0].vols[0], 210, 'volume des trois tests');
  assert.equal(complet(g(B), RA({ nivTests: 4 })).ev.length, 0, 'quatre tests exigés');
  assert.equal(complet(g(B), RA({ nivBarres: 4 })).ev.length, 0, 'fenêtre trop courte');
  // A close below the level in between resets it.
  const B2 = B.slice(); B2[123] = barre(4999.5, 3, 1, [[12, 10], [12, 10], [12, 10], [12, 10], [12, 10]]);
  assert.equal(complet(g(B2), RA()).ev.length, 0, 'niveau traversé entre deux tests');
}

// 4. The forming bar is never judged; once closed, it is.
{
  mn = 0;
  const piege = () => barre(5000, 3, 1, [[10, 10], [50, 10], [150, 10], [10, 100], [10, 100]]);
  const B = fond(120).concat([piege()]);
  assert.equal(complet(g(B), RA()).ev.length, 0, 'barre en formation ignorée');
  B.push(forme(5000));
  assert.equal(complet(g(B), RA()).ev.length, 1, 'jugée une fois close');
}

// 5. Resumptions after the effort absorption of section 2 (haussière, bar high 5001).
{
  mn = 0;
  const abso = barre(5000, 1, 3, [[40, 20], [60, 20], [40, 20], [40, 20], [40, 20]]);
  const fort = barre(5000.5, 0, 4, [[10, 25], [10, 25], [10, 25], [10, 25], [10, 25]]);         // delta +75, closes 5001.5
  const faible = barre(5000.5, 0, 4, [[20, 21], [20, 21], [20, 21], [20, 21], [20, 21]]);       // delta +5
  const empile = barre(5000.5, 0, 4, [[20, 10], [3, 12], [3, 12], [3, 12], [20, 10]]);          // delta +7, three asks over 3 x the bid below
  const run = (suite, rr) => { const B = fond(120).concat([abso], suite, [forme(5001)]); return rep.calcul(g(B), RA(), RR(rr)).ev.find(e => e.i === 120); };
  assert.equal(run([fort], {}).rep, 121, 'cassure + delta');
  // Nothing confirms yet and the 10-bar window is still open: pending, not refused.
  const ATTENTE = undefined;
  assert.equal(run([faible], {}).rep, ATTENTE, 'cassure sans delta ni déséquilibres');
  assert.equal(run([empile], {}).rep, 121, 'cassure + déséquilibres empilés');
  assert.equal(run([empile], { combine: 'et' }).rep, ATTENTE, 'les deux exigés, delta manquant');
  assert.equal(run([empile], { desqN: 4 }).rep, ATTENTE, 'quatre déséquilibres exigés');
  assert.equal(run([faible].concat(fond(10)), {}).rep, -1, 'fenêtre écoulée sans confirmation');
  assert.equal(run([faible], { delta: false, desq: false }).rep, 121, 'cassure seule');
  assert.equal(run([hausse(5000), fort], {}).rep, 122, 'première barre qui confirme');
  assert.equal(run([hausse(5000), fort], { fenetre: 1 }).rep, -1, 'hors fenêtre');
  // A close below the zone first kills the absorption, and with it the resumption.
  const casse = barre(4999, 3, 0, [[12, 10], [12, 10], [12, 10], [12, 10], [12, 10]]);
  const e = run([casse, fort], {});
  assert.equal(e.fin, 121, 'zone traversée');
  assert.equal(e.rep, -1, 'pas de reprise après la cassure');
  // Stacked imbalances, both directions, against hand counts.
  const L = J([[5003, 1, 9], [5002, 3, 9], [5001, 3, 9], [5000, 3, 2]]);
  assert.equal(abs.outils.empile(L, 1, 3, 3, 1), true, 'trois déséquilibres acheteurs');
  assert.equal(abs.outils.empile(L, 1, 3.5, 3, 1), false, 'ratio 3,5 : rompu');
  assert.equal(abs.outils.empile(J([[5002, 9, 1], [5001, 9, 1], [5000, 9, 1]]), -1, 3, 2, 1), true, 'deux déséquilibres vendeurs');
}

// 6. Notifications: history only primes, a new absorption sounds once, then its resumption.
{
  ({ abs, rep } = charger());
  mn = 0;
  const B = fond(120).concat([forme(5000)]);
  abs.dessine(g(B), RA()); rep.dessine(g(B), RR());
  assert.equal(pushes.length, 0, 'l\'historique ne sonne pas');
  B.splice(120, 1, barre(5000, 1, 3, [[40, 20], [60, 20], [40, 20], [40, 20], [40, 20]]), forme(5000));
  abs.dessine(g(B), RA()); abs.dessine(g(B), RA());
  assert.deepEqual(pushes.map(p => p.titre), ['Absorption haussière'], 'une notification d\'absorption');
  assert.match(pushes[0].texte, /^ES · 5000\.00–5000\.25 · Δ 120$/);
  B.splice(121, 1, barre(5000.5, 0, 4, [[10, 25], [10, 25], [10, 25], [10, 25], [10, 25]]), forme(5001));
  rep.dessine(g(B), RR()); rep.dessine(g(B), RR());
  assert.deepEqual(pushes.map(p => p.titre), ['Absorption haussière', 'Reprise acheteuse'], 'puis la reprise');
  assert.match(pushes[1].texte, /^ES · 5001\.50 · après absorption à 5000\.00–5000\.25 \(Δ 120\)$/);
  // The resumption study reads the detection settings of the absorption study.
  ({ abs, rep } = charger());
  surch = { eff: false };
  const rec = [];
  rep.dessine(g(B, { rec }), RR());
  assert.equal(rec.filter(x => x.k === 'texte' && x.s === 'R').length, 0, 'effort coupé dans l\'étude absorption : pas de reprise');
  ({ abs, rep } = charger());
  rep.dessine(g(B, { rec }), RR());
  assert.equal(rec.filter(x => x.k === 'texte' && x.s === 'R').length, 1, 'réglages par défaut : une reprise');
}

// ── Real bars ───────────────────────────────────────────────────────────────────────────────
function archive(sym) {
  const db = JSON.parse(fs.readFileSync(path.join(DATA, '_footprint_db_rec_' + sym + '.json'), 'utf8'));
  const B = [];
  for (const s of db.sessions) for (const b of s.bars) B.push(Object.assign({ _date: s.date }, b));
  return { db, B };
}

// 7. Counts per session on ES and NQ, incremental equals full, time per frame.
for (const sym of ['ES', 'NQ']) {
  ({ abs, rep } = charger());
  const { db, B } = archive(sym), r = RA(), ns = db.sessions.length;
  let t0 = performance.now();
  const C = complet(g(B, { sym }), r);
  const tPlein = performance.now() - t0;
  const par = t => C.ev.filter(e => e.tags.includes(t)).length / ns;
  for (const t of ['ext', 'eff', 'niv']) assert.ok(par(t) >= 1 && par(t) <= 80, sym + ' ' + t + ' : ' + par(t) + ' par séance');
  assert.ok(C.ev.every(e => e.haut >= e.bas && e.fin !== e.i), sym + ' zones bien formées');
  const plein = Array.from(C.ev, vue);
  // Grow the chart bar by bar from 300 bars: same events, same ends.
  ({ abs, rep } = charger());
  let pire = 0;
  complet(g(B.slice(0, 300), { sym }), r);
  for (let n = 301; n <= B.length; n++) {
    t0 = performance.now();
    abs.calcul(g(B.slice(0, n), { sym }), r);
    pire = Math.max(pire, performance.now() - t0);
  }
  const inc = Array.from(complet(g(B, { sym }), r).ev, vue);
  assert.deepEqual(inc, plein, sym + ' incrémental = complet');
  // Resumptions on real bars: some, never on or before the absorption bar.
  const R = rep.calcul(g(B, { sym }), r, RR()).ev.filter(e => e.rep >= 0);
  assert.ok(R.length / ns >= 2 && R.every(e => e.rep > e.i && e.rep <= e.i + 10 && (e.fin < 0 || e.rep < e.fin)), sym + ' reprises');
  // Drawing a 300-bar window stays far below the 8 ms budget.
  const rec = [];
  t0 = performance.now();
  abs.dessine(g(B, { sym, rec, premiere: B.length - 300 }), r);
  rep.dessine(g(B, { sym, rec, premiere: B.length - 300 }), RR());
  const tDessin = performance.now() - t0;
  assert.ok(pire < 8 && tDessin < 8, sym + ' budget');
  console.log('OK', sym, '|', B.length, 'barres |', (C.ev.length / ns).toFixed(1), 'absorptions/séance (ext', par('ext').toFixed(1), '· Δ', par('eff').toFixed(1), '· niv', par('niv').toFixed(1) + ') |',
    (R.length / ns).toFixed(1), 'reprises/séance | complet', tPlein.toFixed(1), 'ms, pire image', pire.toFixed(2), 'ms, dessin', tDessin.toFixed(2), 'ms');
}

// ── Tape ────────────────────────────────────────────────────────────────────────────────────
// Prints as hfq-ext.js X() serves them: t in seconds since the session open, price, size, aggressor.
function ruban(T) {
  return { n: T.length, t: k => T[k][0], prix: k => T[k][1], taille: k => T[k][2], achat: k => T[k][3] === 1, avant: () => -1 };
}

// 8. Synthetic tape: a run of sells on one price that holds is an absorption, one that breaks is not.
{
  ({ abs, rep } = charger());
  mn = 0;
  const B = fond(40).concat([forme(5000)]), T = [];
  let t = 0;
  // 1200 small runs alternating between two prices, then the big ones.
  for (let k = 0; k < 1200; k++) T.push([t += 0.1, 5000 + (k % 2) * TICK, 1 + (k % 3), 0]);
  const gros = (px, apres) => { for (let k = 0; k < 20; k++) T.push([t += 0.1, px, 25, 0]); T.push([t += 0.1, apres, 1, 0]); };
  gros(5000, 5000.25);   // held: the next sell is higher
  gros(5000.25, 5000);   // broken: the next sell is lower
  const C = complet(g(B, { prints: ruban(T) }), RA());
  assert.equal(C.tape.length, 1, 'un seul palier tenu');
  // Its last print comes at 122 s, in the bar opened at minute 2.
  assert.deepEqual([C.tape[0].s, C.tape[0].bas, C.tape[0].vols[0], C.tape[0].i], [1, 5000, 500, 2], 'palier haussier de 500 lots');
  assert.equal(complet(g(B, { prints: ruban(T) }), RA({ tape: false })).tape.length, 0, 'signature coupée');
}

// 9. Real tape recorded by the heatmap for ES on 2026-10-16, against that session's bars.
{
  const date = '2026-10-16', meta = path.join(DATA, '_hmrust_rec_ES_' + date + '.json');
  if (!fs.existsSync(meta)) console.warn('pas d\'enregistrement de tape, section sautée :', meta);
  else {
    ({ abs, rep } = charger());
    const { priceBottom } = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const buf = fs.readFileSync(path.join(DATA, '_hmrust_rec_ES_' + date + '.dots')), T = [];
    // 16-byte records: centiseconds since the open, price row, size, side (1 = buyer aggressor).
    for (let o = 0; o + 16 <= buf.length; o += 16)
      T.push([buf.readUInt32LE(o) / 100, priceBottom + buf.readInt32LE(o + 4) * TICK, buf.readUInt32LE(o + 8), buf.readUInt32LE(o + 12)]);
    const B = archive('ES').db.sessions.find(s => s.date === date).bars.map(b => Object.assign({ _date: date }, b));
    let images = 0, C;
    const t0 = performance.now();
    while (!(C = abs.calcul(g(B, { prints: ruban(T) }), RA())).pret) images++;
    const h = (T[T.length - 1][0] - T[0][0]) / 3600, ok = C.tape.filter(e => e.i >= 0);
    assert.equal(ok.length, C.tape.length, 'chaque palier posé sur une barre');
    assert.ok(ok.every(e => B[e.i].m * 60 <= e.t && (e.i === B.length - 1 || e.t < B[e.i + 1].m * 60) && e.bas >= B[e.i].l && e.bas <= B[e.i].h), 'palier dans sa barre');
    assert.ok(ok.length / h >= 0.5 && ok.length / h <= 20, 'paliers par heure : ' + (ok.length / h).toFixed(1));
    console.log('OK tape ES', date, '|', T.length, 'prints,', h.toFixed(1), 'h |', ok.length, 'paliers retenus (' + (ok.length / h).toFixed(1) + '/h), de',
      Math.min(...ok.map(e => e.vols[0])), 'à', Math.max(...ok.map(e => e.vols[0])), 'lots |', images, 'images de rattrapage,', (performance.now() - t0).toFixed(0), 'ms');
  }
}

// 10. Missing data: nothing holds through bars the chart does not have. TT's filler block for a
// missing day, or a missing weekday between two sessions (tick chart, footprint through _sd), ends
// the zones still open, drops the levels being tested and closes the resumption windows.
{
  const comble = n => Array.from({ length: n }, () => ({ _trou: true, m: 0, o: 5000, h: 5000, l: 5000, c: 5000, v: 0, lv: [] }));
  const piege = () => barre(5000, 3, 1, [[10, 10], [50, 10], [150, 10], [10, 100], [10, 100]]);
  const test = () => barre(5000, 1, 4, [[35, 10], [35, 10], [10, 30], [10, 20], [10, 12]]);
  const date = (B, d, cle = '_date') => B.map(b => Object.assign({}, b, { [cle]: d }));
  const zone = B => { ({ abs, rep } = charger()); return Array.from(complet(g(B), RA()).ev, vue); };
  // The bearish zone of section 1 stays open over plain bars, ends at the first filler bar.
  mn = 0;
  const avant = fond(120).concat([piege()], fond(3)), apres = fond(5).concat([forme(5000)]);
  assert.deepEqual(zone(avant.concat(apres)).map(e => e.fin), [-1], 'zone ouverte sans trou');
  assert.deepEqual(zone(avant.concat(comble(8), apres)).map(e => [e.i, e.fin]), [[120, 124]], 'zone arrêtée au bloc de comblement');
  // Missing Wednesday between two dated sessions, no filler: the zone ends at the next session's first bar.
  assert.deepEqual(zone(date(avant, '2026-10-06').concat(date(apres, '2026-10-08'))).map(e => e.fin), [124], 'mercredi manquant');
  assert.deepEqual(zone(date(avant, '2026-10-06', '_sd').concat(date(apres, '2026-10-08', '_sd'))).map(e => e.fin), [124], 'footprint : mercredi manquant vu par _sd');
  assert.deepEqual(zone(date(avant, '2026-10-09').concat(date(apres, '2026-10-12'))).map(e => e.fin), [-1], 'week-end : la zone tient');
  assert.deepEqual(zone(date(avant, '2026-04-02').concat(date(apres, '2026-04-06'))).map(e => e.fin), [-1], 'Vendredi saint (calendrier de TT) : la zone tient');
  // Level defended: two tests before the gap and one after are not three tests.
  mn = 0;
  const niv = fond(120).concat([test(), hausse(5000), test()]), fin = [test(), forme(5000)];
  assert.deepEqual(zone(niv.concat([hausse(5000)], fin)).map(e => e.tags), ['niv'], 'trois tests d\'affilée');
  assert.deepEqual(zone(niv.concat(comble(8), fin)).filter(e => e.tags === 'niv'), [], 'tests de part et d\'autre d\'un trou');
  // Resumption: the window of the effort absorption of section 5 closes at the gap.
  mn = 0;
  const abso = barre(5000, 1, 3, [[40, 20], [60, 20], [40, 20], [40, 20], [40, 20]]);
  const fort = barre(5000.5, 0, 4, [[10, 25], [10, 25], [10, 25], [10, 25], [10, 25]]);
  const reprise = suite => { ({ abs, rep } = charger()); return rep.calcul(g(fond(120).concat([abso], suite, [forme(5001)])), RA(), RR()).ev.find(e => e.i === 120).rep; };
  assert.equal(reprise([hausse(5000), fort]), 122, 'reprise sans trou');
  assert.equal(reprise(comble(8).concat([fort])), -1, 'pas de reprise par-dessus un trou');
}

console.log('OK synthétiques : signatures, zones, reprises, notifications, données manquantes');
