// Self-check for extensions/bougies_vwap.js: same VWAP and σ as VWAP Pro, candles touching the band hidden,
// one notification per close beyond a level, re-armed after a pullback, history and replay jumps silent.
// Run: node tests/bougies_vwap_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';
const HFQSessions = (() => { const c = {}; vm.runInContext(fs.readFileSync(path.join(PAYLOAD, 'hfq-sessions.js'), 'utf8'), vm.createContext(c)); return c.HFQSessions; })();
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date, v: b.lv.reduce((a, l) => a + l[1] + l[2], 0) }, b));
const tick = db.tick;
// The last session loaded from its open and long enough to reach RTH: the archive grows live and may end anywhere.
const plein = db.sessions.findLast(s => s.bars.length > 600 && s.bars[0].m < 60), i0 = bars.findIndex(b => b._date === plein.date), i1 = i0 + plein.bars.length;
const BP = bars.slice(0, i1);

// A fresh copy of the study for each case: its cache is module state.
const notes = [];
const charger = () => {
  const defs = [];
  class Notification { constructor(t, o) { notes.push({ titre: t, texte: o.body }); } }
  Notification.permission = 'granted';
  vm.runInContext(fs.readFileSync(path.join(RACINE, 'extensions/bougies_vwap.js'), 'utf8'), vm.createContext({
    HFQExt: { etude(d) { defs.push(d); return true; } }, console, performance, Notification,
    bgStyle: () => 'FOND', size: () => ({ w: 1000, h: 500 }) }));
  assert.equal(defs.length, 1);
  return defs[0];
};
const E = charger();
assert.equal(E.id, 'bougies-vwap', 'id stable');
assert.deepEqual([...E.graphes], ['bougies']);
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

// VWAP Pro as the reference VWAP (one-minute chart: nothing to complete from the minute file).
const PRO = (() => { const d = []; vm.runInContext(fs.readFileSync(path.join(RACINE, 'extensions/vwap_pro.js'), 'utf8'), vm.createContext({ HFQExt: { etude(x) { d.push(x); return true; } }, console, HFQSessions })); return d[0]; })();
const proDefaut = Object.fromEntries(PRO.reglages.map(x => [x.k, x.defaut]));

const J = e => !e || !e.length ? { n: 0, prix: () => 0, bid: () => 0, ask: () => 0 }
  : { n: e.length, prix: k => e[k][0], bid: k => e[k][1] || 0, ask: k => e[k][2] || 0 };
let rects = [], traits = [], fills = [];
const ctx = { save() {}, restore() {}, beginPath() {}, rect(x, y, w, h) { rects.push({ x, y, w, h }); }, fill() { fills.push(this.fillStyle); } };
const g = (B, o = {}) => Object.assign({ n: B.length, premiere: Math.max(0, B.length - 300), derniere: B.length - 1, tick, seance: 'eth', sym: 'ES', tf: 1, echelle: 1, ctx,
  cadre: { gauche: 0, droite: 1e9, haut: 0, bas: 500 }, barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv), x: i => 10 * i, y: v => -v,
  trait(p, opt) { traits.push({ p, opt }); } }, o);
// Draws until the cold compute has caught up (4 ms per frame), then once more with the drawing recorded.
const dessine = (S, G, r) => { for (let k = 0; k < 1000 && S.calcul(G, r).n < G.n; k++); rects = []; traits = []; fills = []; S.dessine(G, r); };
const memes = (a, b, n, msg) => { for (let i = 0; i < n; i++) assert.ok(Object.is(a[i], b[i]) || Math.abs(a[i] - b[i]) < 1e-9, msg + ' barre ' + i + ' : ' + a[i] + ' vs ' + b[i]); };

// 1. Same VWAP and σ as VWAP Pro, daily and RTH anchors, every source.
for (const [anc, src] of [['jour', 'auto'], ['us', 'auto'], ['jour', 'close'], ['us', 'hlc3']]) {
  const C = charger().calcul(g(bars), avec({ anc, src })), P = PRO.calcul(g(bars), Object.assign({}, proDefaut, { anc, src }));
  memes(C.vwap, P.vwap, bars.length, anc + '/' + src + ' VWAP');
  memes(C.sd, P.sd, bars.length, anc + '/' + src + ' σ');
  assert.ok(C.vwap.slice(0, bars.length).some(Number.isFinite), anc + ' : des valeurs');
}
console.log('OK VWAP et σ identiques à VWAP Pro |', bars.length, 'barres,', db.sessions.length, 'séances');

// 2. Mask: exactly the candles whose range touches [VWAP + bas·σ, VWAP + haut·σ], wick included; both
// bounds at 0 hide the candles touching the VWAP. Background style from the page, one fill.
for (const [haut, bas] of [[1, -1], [0, 0], [2, 0.5], [-1, 1]]) {
  const S = charger(), G = g(BP), r = avec({ haut, bas });
  dessine(S, G, r);
  const C = S.calcul(G, r), lo = Math.min(haut, bas), hi = Math.max(haut, bas), attendu = [];
  for (let i = G.premiere; i <= G.derniere; i++) {
    const b = BP[i], v = C.vwap[i];
    if (Number.isFinite(v) && b.l <= v + hi * C.sd[i] && b.h >= v + lo * C.sd[i]) attendu.push(i);
  }
  assert.deepEqual(rects.map(q => Math.round(q.x + q.w / 2) / 10), attendu, 'bougies masquées ' + haut + '/' + bas);
  assert.ok(attendu.length > 0 && attendu.length < 300, 'ni rien ni tout masqué ' + haut + '/' + bas);
  rects.forEach((q, k) => { const b = BP[attendu[k]]; assert.ok(q.y <= -b.h - 2 + 1e-9 && q.y + q.h >= -b.l + 2 - 1e-9, 'mèches couvertes'); assert.ok(q.w >= 6.2 + 2 - 1e-9, 'corps couvert'); });
  assert.deepEqual(fills, ['FOND'], 'un seul remplissage, au fond de la page');
  if (haut === 1) console.log('OK masque ±1σ |', attendu.length, 'bougies masquées sur 300');
}
{
  const S = charger();
  dessine(S, g(BP), avec({ masque: false }));
  assert.equal(rects.length, 0, 'masque éteint');
  assert.equal(traits.length, 3, 'VWAP et deux bornes tracées');
}

// 3. Missing data: a session joined 70 minutes late, or cut by a filler bar, is neither masked nor drawn.
{
  const tard = bars.filter((b, i) => i < i0 || i >= i0 + 70 || b._date !== plein.date), S = charger();
  const C = S.calcul(g(tard), defaut), P = PRO.calcul(g(tard), proDefaut);
  memes(C.vwap, P.vwap, tard.length, 'séance en retard');
  for (let i = i0; i < i0 + plein.bars.length - 70; i++) assert.ok(Number.isNaN(C.vwap[i]), 'séance prise en retard masquée');
  const trou = bars.map((b, i) => i === i0 + 200 ? Object.assign({}, b, { _trou: true, lv: [] }) : b), C2 = charger().calcul(g(trou), defaut);
  assert.ok(Number.isFinite(C2.vwap[i0 + 199]), 'avant le trou');
  for (let i = i0 + 200; i < i0 + plein.bars.length; i++) assert.ok(Number.isNaN(C2.vwap[i]), 'masqué à partir du trou');
  // Incremental cache: history without a middle session, then whole, equals a fresh compute.
  const S3 = charger();
  S3.calcul(g(tard), defaut);
  const C3 = S3.calcul(g(bars), defaut), F = charger().calcul(g(bars), defaut);
  memes(C3.vwap, F.vwap, bars.length, 'séance insérée au milieu');
  console.log('OK données manquantes et cache incrémental');
}

// 4. Alert rule on a hand-made session: VWAP pinned at 100 by a huge first bar, VWAP level only, re-arm 2 ticks.
{
  const S = charger(), r = avec({ src: 'close', a1On: false, a2On: false, a3On: false, a4On: true, rearme: 2 });
  const clotures = [100, 99, 101, 100.25, 99.75, 99.25, 100.25, 100.75];
  const B = clotures.map((c, m) => ({ _date: '2026-11-05', m, o: c, h: c + 0.25, l: c - 0.25, c, v: m ? 1 : 1e9, lv: [] }));
  notes.length = 0;
  for (let n = 2; n <= B.length; n++) S.dessine(g(B.slice(0, n), { premiere: 0 }), r);
  // 99 arms "above", 101 rings it and arms "below"; 100.25 is above, no re-arm; 99.75 rings "below" (101 armed it);
  // 99.25 is 3 ticks under and re-arms "above"; 100.25 rings it. 100.75 is still the forming bar.
  assert.deepEqual(notes.map(x => x.texte), ['Clôture au-dessus de la VWAP : 101.00', 'Clôture sous la VWAP : 99.75', 'Clôture au-dessus de la VWAP : 100.25'], 'règle de la VWAP');
  assert.ok(notes.every(x => x.titre === 'ES · DVWAP'), 'titre');
  // Re-arm 0: every close back on the inner side re-arms.
  const S2 = charger();
  notes.length = 0;
  for (let n = 2; n <= B.length; n++) S2.dessine(g(B.slice(0, n), { premiere: 0 }), Object.assign({}, r, { rearme: 0 }));
  // 100 at the open arms both sides, so 99 rings at once.
  assert.deepEqual(notes.map(x => x.texte), ['Clôture sous la VWAP : 99.00', 'Clôture au-dessus de la VWAP : 101.00', 'Clôture sous la VWAP : 99.75', 'Clôture au-dessus de la VWAP : 100.25'], 'réarmement 0');
  console.log('OK règle des alertes');
}

// 5. Live on real ES: the last full session fed bar by bar rings exactly what an independent replay of
// the rule on VWAP Pro's values gives; the history loaded at once rings nothing; a replay jump rings at most its last bar.
{
  const r = avec({ a4On: true }), P = PRO.calcul(g(bars.slice(0, i1)), proDefaut);
  const mults = [1, 2, 3, 0], recul = 2 * tick, attendu = [];
  for (const m of mults) for (const s of [1, -1]) {
    let arme = false;
    for (let i = i0; i < i1 - 1; i++) {
      if (!Number.isFinite(P.vwap[i])) { arme = false; continue; }
      const e = s * (bars[i].c - (P.vwap[i] + s * m * P.sd[i]));
      if (arme && e > 0) { arme = false; attendu.push(i + ':' + (s > 0 ? 'Clôture au-dessus de ' : 'Clôture sous ') + (m ? (s > 0 ? '+' : '−') + m + 'σ' : 'la VWAP')); }
      else if (!arme && e <= -recul) arme = true;
    }
  }
  const S = charger();
  notes.length = 0;
  dessine(S, g(bars.slice(0, i0 + 2)), r);
  assert.equal(notes.length, 0, 'historique muet');
  const vus = [];
  for (let n = i0 + 3; n <= i1; n++) { const k = notes.length; S.dessine(g(bars.slice(0, n)), r); for (const x of notes.slice(k)) vus.push((n - 2) + ':' + x.texte.split(' : ')[0]); }
  assert.deepEqual(vus.sort(), attendu.sort(), 'une notification par franchissement');
  assert.ok(attendu.length > 5, 'des franchissements dans la séance');
  // The whole session loaded at once: silent.
  notes.length = 0;
  dessine(charger(), g(bars.slice(0, i1)), r);
  assert.equal(notes.length, 0, 'séance chargée d\'un coup : muette');
  // Replay jump of 200 bars: only the bars closed at the edge may ring.
  const S2 = charger();
  dessine(S2, g(bars.slice(0, i0 + 100)), r);
  notes.length = 0;
  S2.dessine(g(bars.slice(0, i0 + 300)), r);
  const bord = attendu.filter(x => { const i = +x.split(':')[0]; return i >= i0 + 297 && i <= i0 + 298; }).length;
  assert.equal(notes.length, bord, 'saut de replay : seules les dernières barres sonnent');
  console.log('OK alertes en direct |', attendu.length, 'franchissements sur la séance du', plein.date);
}

// 6. Budget: from cold on the whole archive, never three frames in a row above 8 ms.
{
  const S = charger(), G = g(bars), ms = [];
  for (let k = 0; k < 60; k++) { const t = performance.now(); S.dessine(G, defaut); ms.push(performance.now() - t); }
  for (let k = 2; k < ms.length; k++) assert.ok(!(ms[k] > 8 && ms[k - 1] > 8 && ms[k - 2] > 8), 'trois images de suite au-delà de 8 ms : ' + ms.slice(k - 2, k + 1).map(x => x.toFixed(1)));
  assert.equal(S.calcul(G, defaut).n, bars.length, 'calcul rattrapé');
  console.log('OK budget | pire image', Math.max(...ms).toFixed(1), 'ms, médiane', ms.slice().sort((a, b) => a - b)[30].toFixed(2), 'ms');
}

console.log('OK bougies_vwap');
