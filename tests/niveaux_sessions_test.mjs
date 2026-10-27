// Self-check for extensions/niveaux_sessions.js on real ES bars baked by Turning Trade:
// last closed session highs and lows against a brute-force reading, TT's own session
// module (hfq-clock.js, hfq-sessions-monde.js), a session straddling the chart opening,
// bar-by-bar growth with a live bar, replay rewind, notifications, drawing, and sessions
// not loaded whole (joined late, cut, holed, missing day) left out.
// Run: node tests/niveaux_sessions_test.mjs   (from the repo root; TT_DATA overrides the data
// folder, TT_PAYLOAD the payload folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/niveaux_sessions.js'), 'utf8');
// TT's market calendar (hfq-sessions.js): full CME closures (New Year, Good Friday, Christmas) are no missing day.
const HFQSessions = (() => { const c = {}; vm.runInContext(fs.readFileSync(path.join(process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload', 'hfq-sessions.js'), 'utf8'), vm.createContext(c)); return c.HFQSessions; })();
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
// The archive grows live and holds cut recordings (ES on 2026-10-22 stops at 07:37 ET) and missing days:
// only whole sessions (18:00 to 17:00 ET, no hole over 10 minutes, TT's rule) are kept, in order, redated
// on business days from Thursday 2026-11-05 so the chart crosses a weekend. The last one, cut at 12:30 ET,
// is the live session, New York in progress.
const pleine = s => s.bars[0].m === 0 && s.bars[s.bars.length - 1].m >= 1369 && s.bars.every((b, k) => !k || b.m - s.bars[k - 1].m <= 11);
const R8 = db.sessions.filter(pleine).slice(-8);
assert.ok(R8.length >= 3, 'au moins trois séances pleines dans l\'archive');
const ouvres = (d, n) => { const out = []; for (let t = Date.parse(d); out.length < n; t += 864e5) if (new Date(t).getUTCDay() % 6) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
const JOURS = ouvres('2026-11-05', R8.length);
const SESS = R8.map((s, k) => ({ date: JOURS[k], bars: k < R8.length - 1 ? s.bars : s.bars.filter(b => b.m < 1110) }));
const aplat = S => S.flatMap(s => s.bars.map(b => Object.assign({ _date: s.date }, b)));
const bars = aplat(SESS);
const N = bars.length;

// Loads the study in a fresh context, with TT's session modules if asked.
function charge(avecTT = false) {
  const defs = [], notes = [];
  class Notification { constructor(t, o) { notes.push(t + ' | ' + o.body); } }
  Notification.permission = 'granted';
  const vc = vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; }, redessiner() {} }, Notification, performance, console, HFQSessions });
  if (avecTT) for (const f of ['hfq-clock.js', 'hfq-sessions-monde.js']) vm.runInContext(fs.readFileSync(path.join(PAYLOAD, f), 'utf8'), vc);
  vm.runInContext(SRC, vc);
  assert.equal(defs.length, 1);
  return { E: defs[0], notes, vc };
}
const { E } = charge();
assert.equal(E.id, 'niveaux-sessions', 'id stable');
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);
// The first pass is spread over frames past its budget: read until the history is caught up.
const plein = (T, G, r) => { let R; do R = T.calcul(G, r); while (!R.pret); return R; };

const rec = [];
const g = (B = bars, seance = 'eth', n = B.length) => ({ n, premiere: 0, derniere: n - 1, tick: 0.25, seance, sym: 'ES', tf: 1, echelle: 1,
  cadre: { gauche: 0, droite: 1e6, haut: 0, bas: 500 }, barre: i => (i < n ? B[i] : null), x: i => i, y: v => v,
  trait(p, o) { rec.push({ k: 'trait', p, o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } });

// Brute force: a session's bars, then its high and low with the first wick touch and
// the first close beyond after its last bar (the live last bar never counts as closed).
function attendu(B, idx) {
  const fin = idx[idx.length - 1], live = B.length - 1;
  const niv = (s, p) => {
    const i = idx.find(k => (s > 0 ? B[k].h : B[k].l) === p);
    let m = -1, c = -1;
    for (let k = fin + 1; k < B.length; k++) {
      if (m < 0 && s * ((s > 0 ? B[k].h : B[k].l) - p) >= 0) m = k;
      if (c < 0 && k < live && s * (B[k].c - p) > 0) c = k;
    }
    return { p, i, m, c };
  };
  return { H: niv(1, Math.max(...idx.map(k => B[k].h))), L: niv(-1, Math.min(...idx.map(k => B[k].l))) };
}
const indices = pred => B => B.map((b, k) => (pred(b) ? k : -1)).filter(k => k >= 0);
const resume = o => o && { H: { p: o.H.p, i: o.H.i, m: o.H.m, c: o.H.c }, L: { p: o.L.p, i: o.L.i, m: o.L.m, c: o.L.c } };
// A bar belongs to a window [a, z) of chart minutes (ETH chart opened at 18:00 ET) by its middle.
const dans = (b, a, z) => b.m + 0.5 >= a && b.m + 0.5 < z;
const plage = o => Array.from({ length: o.fin - o.deb + 1 }, (_, k) => o.deb + k);
// Occurrences of the default sessions: runs of bars with one id and session date, each bar classified
// with the windows of its date, which section 1 checks against TT's module. Whatever the archive holds.
function occurrences(B) {
  const out = [];
  B.forEach((b, k) => {
    const id = E.outils.fenetres(b._date, 1080).find(f => dans(b, f.a, f.b)).id, c = id + ':' + b._date, o = out[out.length - 1];
    if (o && o.c === c) o.fin = k; else out.push({ c, id, deb: k, fin: k });
  });
  return out;
}
const OCC = occurrences(bars);

// 1. Windows: the defaults agree with TT's module, including the week when London has
// left summer time and New York has not (08:00 London = 04:00 ET on 2026-10-26).
{
  const { E: T } = charge(true);
  for (const d of ['2026-10-13', '2026-10-26', '2026-11-02', '2027-03-10', '2027-03-20', '2027-03-30'])
    for (const ouv of [1080, 570]) {
      const tri = L => [...L].sort((a, b) => a.a - b.a).map(f => [f.id, f.a, f.b]);
      assert.deepEqual(tri(E.outils.fenetres(d, ouv)), tri(T.outils.fenetres(d, ouv)), 'fenêtres ' + d + ' ' + ouv);
    }
  const eu = E.outils.fenetres('2026-10-26', 1080).find(f => f.id === 'eu');
  assert.deepEqual([eu.a, eu.b], [600, 930], 'Londres à 04:00 ET le 2026-10-26');
}

// 2. Last closed session of each kind on real ES bars: the last occurrence of its id before the one
// holding the live bar, which is in progress.
const P = plein(E, g(), defaut);
{
  const A = {};
  for (const o of OCC.slice(0, -1)) A[o.id] = attendu(bars, plage(o));
  assert.deepEqual(Object.keys(P.D).sort(), Object.keys(A).sort(), 'une session close par id');
  for (const id in A) assert.deepEqual(resume(P.D[id]), A[id], 'session ' + id);
  assert.equal(P.cour.id, OCC[OCC.length - 1].id, 'session en cours');
  // Not a degenerate fixture: something gets touched, something does not.
  const t = Object.values(A).flatMap(o => [o.H, o.L]);
  assert.ok(t.some(v => v.m >= 0) && t.some(v => v.m < 0), 'des niveaux touchés et d\'autres vierges');
  assert.ok(t.some(v => v.c >= 0 && v.c > v.m), 'une clôture au-delà après la mèche');
  // Same result through TT's module.
  assert.deepEqual(resume(plein(charge(true).E, g(), defaut).D.us), resume(P.D.us), 'avec le module de TT');
  // Sessions unchecked in TT's panel still count: only the study's own boxes hide them.
  const { E: O, vc } = charge(true);
  vm.runInContext('HFQSessionsMonde.ecrire(HFQSessionsMonde.table().map(s => Object.assign(s, {on:false})))', vc);
  const R = plein(O, g(), defaut);
  for (const id of ['asie', 'eu', 'us', 'fin']) assert.deepEqual(resume(R.D[id]), resume(P.D[id]), 'session décochée dans TT : ' + id);
}

// 3. Tokyo moved to 19:00 ET in TT: the close session runs 16:00-19:00 and straddles the
// chart opening, its tail being the first hour of the next chart session. History cut in the
// London session of the last day Y whose previous archived day X reaches its close.
{
  const { E: T, vc } = charge(true);
  vm.runInContext('HFQSessionsMonde.ecrire([{id:"asie", h:19, m:0}])', vc);
  const jours = SESS.map(s => s.date), a = d => T.outils.fenetres(d, 1080).find(f => f.id === 'eu').a;
  const y = jours.findLast((d, k) => k && bars.some(b => b._date === jours[k - 1] && b.m >= 1320) && bars.some(b => b._date === d && dans(b, a(d), a(d) + 30)));
  assert.ok(y, 'une veille qui va jusqu\'à la clôture, suivie d\'un jour qui atteint Londres');
  const x = jours[jours.indexOf(y) - 1], B = bars.slice(0, bars.findIndex(b => b._date === y && dans(b, a(y) + 30, 1440)));
  const R = plein(T, g(B), defaut);
  const fin = indices(b => (b._date === x && b.m + 0.5 >= 1320) || (b._date === y && b.m + 0.5 < 60))(B);
  assert.deepEqual(resume(R.D.fin), attendu(B, fin), 'clôture à cheval sur l\'ouverture');
  assert.ok(T.outils.montre(R, R.D.fin), 'clôture à cheval sur l\'ouverture : complète, tracée');
  assert.deepEqual(resume(R.D.asie), attendu(B, indices(b => b._date === y && dans(b, 60, a(y)))(B)), 'Tokyo depuis 19:00');
}

// 4. RTH chart: New York only, the previous one is the day before the last RTH session.
{
  const rth = bars.filter(b => b.m >= 930 && b.m < 1320).map(b => Object.assign({}, b, { m: b.m - 930 }));
  const j = [...new Set(rth.map(b => b._date))];
  const R = plein(charge().E, g(rth, 'rth'), defaut);
  assert.deepEqual(Object.keys(R.D), ['us'], 'RTH : New York seul');
  assert.deepEqual(resume(R.D.us), attendu(rth, indices(b => b._date === j[j.length - 2])(rth)), 'RTH : New York de la veille');
}

// 5. Footprint bars carry no date: sessions split on the minute going back, New York and the
// close (bounds in New York time, whatever the date) come out the same.
{
  const R = plein(charge().E, g(bars.map(b => { const c = Object.assign({}, b); delete c._date; return c; })), defaut);
  for (const id of ['us', 'fin']) assert.deepEqual(resume(R.D[id]), resume(P.D[id]), 'footprint ' + id);
}

// 6. Bar by bar from K, the live bar first flat at its open then whole: same state as one
// pass, one notification per level and touch type, only for what happens after K.
const K = N - 2500;
function croissance(alerte) {
  const { E: T, notes } = charge(), B = bars.slice(0, K), r = avec({ alerte });
  plein(T, g(B), r);
  for (let k = K; k < N; k++) {
    B.push(Object.assign({}, bars[k], { h: bars[k].o, l: bars[k].o, c: bars[k].o }));
    T.dessine(g(B), r);
    B[k] = bars[k];
    T.dessine(g(B), r);
  }
  return { R: T.calcul(g(B), r), notes };
}
// Expected notifications: a closed session is watched from its last bar until the next one
// of the same kind closes; its first touch of each type rings if it falls after K.
function sonneries(type) {
  const occ = OCC, out = [];
  occ.forEach((o, n) => {
    if (n === occ.length - 1) return;
    const suiv = occ.slice(n + 1).find(x => x.id === o.id), jusqua = suiv && suiv !== occ[occ.length - 1] ? suiv.fin : N - 1;
    const A = attendu(bars, Array.from({ length: o.fin - o.deb + 1 }, (_, k) => o.deb + k));
    for (const [cote, v] of [['H', A.H], ['L', A.L]]) {
      const t = v[type === 'meche' ? 'm' : 'c'];
      if (t >= 0 && t <= jusqua && t >= (type === 'meche' ? K : K - 1)) out.push(o.id + ' ' + cote + ' ' + v.p.toFixed(2));
    }
  });
  return out.sort();
}
const NOM = { asie: 'Tokyo', eu: 'Londres', us: 'New York', fin: 'Clôture' };
const lu = notes => notes.map(t => { const m = /^ES · (.+) ([HL]) \| .+ : ([\d.]+)$/.exec(t); return Object.keys(NOM).find(k => NOM[k] === m[1]) + ' ' + m[2] + ' ' + m[3]; }).sort();
{
  const M = croissance('meche'), C = croissance('cloture');
  for (const id in P.D) assert.deepEqual(resume(M.R.D[id]), resume(P.D[id]), 'croissance ' + id);
  assert.ok(M.notes.every(t => t.includes('Niveau touché')) && C.notes.every(t => t.includes('Clôture au-delà du niveau')), 'texte des notifications');
  const sm = sonneries('meche'), sc = sonneries('cloture');
  assert.ok(sm.length > 0 && sc.length > 0, 'des notifications attendues');
  assert.deepEqual(lu(M.notes), sm, 'notifications au toucher');
  assert.deepEqual(lu(C.notes), sc, 'notifications à la clôture au-delà');
  assert.equal(croissance('non').notes.length, 0, 'sans notification');
}

// 7. The first pass never rings, even when its live bar touches a level; a replay jump
// rings only for its last bars; a rewind starts over silently and matches a fresh pass.
{
  const { E: T, notes } = charge(), r = avec({ alerte: 'meche' }), t = Object.values(P.D).flatMap(o => [o.H, o.L]).find(v => v.m >= 0).m;
  plein(T, g(bars, 'eth', t + 1), r);
  T.dessine(g(bars, 'eth', t + 1), r);
  T.dessine(g(), r);
  T.dessine(g(bars, 'eth', N - 700), r);
  assert.equal(notes.length, 0, 'historique muet');
  const frais = plein(charge().E, g(bars, 'eth', N - 700), r), R = plein(T, g(bars, 'eth', N - 700), r);
  for (const id in frais.D) assert.deepEqual(resume(R.D[id]), resume(frais.D[id]), 'retour arrière ' + id);
}

// 7b. Bars inserted before the last one read (tick history filling a missing day): the state starts over,
// silently, and ends as a fresh pass.
{
  const { E: T, notes } = charge(), r = avec({ alerte: 'meche' });
  plein(T, g(bars.filter(b => b._date !== SESS[1].date)), r);
  const R = plein(T, g(), r);
  assert.deepEqual(Object.keys(R.D).sort(), Object.keys(P.D).sort(), 'insertion : mêmes sessions');
  for (const id in P.D) assert.deepEqual(resume(R.D[id]), resume(P.D[id]), 'insertion ' + id);
  assert.equal(notes.length, 0, 'insertion muette');
}

// 8. Drawing: from the extreme bar to the touch chosen, or to the right edge; a session
// unchecked is not drawn; labels name the session.
{
  const trace = r => { rec.length = 0; E.dessine(g(), r); return rec.filter(x => x.k === 'trait').map(x => [x.p[0][0], x.p[1][0], x.p[0][1]]); };
  for (const [jusqua, champ] of [['meche', 'm'], ['cloture', 'c'], ['bord', null]]) {
    const A = Object.values(P.D).flatMap(o => [o.H, o.L]).map(v => [v.i, champ && v[champ] >= 0 ? v[champ] : 1e6, v.p]);
    assert.deepEqual(trace(avec({ jusqua })), A, 'traits ' + jusqua);
  }
  assert.equal(trace(avec({ us: false })).length, 2 * Object.keys(P.D).length - 2, 'New York décoché');
  assert.ok(rec.some(x => x.k === 'texte' && x.s === 'Londres H') && !rec.some(x => x.k === 'texte' && x.s.startsWith('New York')), 'étiquettes');
  // Labels on the left by default: at the start of the line, or at the frame's left edge when it starts off-frame.
  const lon = P.D.eu.H, cote = (r, G = g()) => { rec.length = 0; E.dessine(G, r); return rec.find(x => x.k === 'texte' && x.s === 'Londres H'); };
  const a = cote(defaut);
  assert.deepEqual([a.x, a.o.align], [lon.i + 3, 'left'], 'étiquette au début du trait');
  const b = cote(avec({ etiqPos: 'droite' }));
  assert.deepEqual([b.x, b.o.align], [(lon.m >= 0 ? lon.m : 1e6) - 3, 'right'], 'étiquette au bout du trait');
  const c = cote(defaut, Object.assign(g(), { cadre: { gauche: lon.i + 50, droite: 1e6, haut: 0, bas: 500 } }));
  assert.equal(c.x, lon.i + 53, 'étiquette collée au bord gauche du cadre');
}

// 9. Slow bars: the first pass takes several frames, draws nothing meanwhile, and ends as one pass.
{
  const { E: T } = charge(), G = g(), vite = G.barre;
  G.barre = i => { const t = performance.now(); while (performance.now() - t < 0.002); return vite(i); };
  rec.length = 0;
  T.dessine(G, defaut);
  assert.equal(rec.length, 0, 'rien tant que l\'historique se lit');
  let images = 1, R;
  while (!(R = T.calcul(G, defaut)).pret) images++;
  assert.ok(images > 1, 'premier passage étalé');
  for (const id in P.D) assert.deepEqual(resume(R.D[id]), resume(P.D[id]), 'étalé ' + id);
}

// 10. Missing data: a session not loaded whole (joined late, cut, holed, filler bars) is not drawn, nor the
// last one of an id once a later one is missing (cut day, missing business day); the others stay. The windows
// are those of each date (Nov. 2026: London opens at 03:00 ET, chart minute 540).
{
  const W = d => Object.fromEntries(E.outils.fenetres(d, 1080).map(f => [f.id, f]));
  const L = SESS.length - 1, dL = SESS[L].date, dP = SESS[L - 1].date;
  const avecJour = (k, f, S = SESS) => S.map((s, j) => j === k ? { date: s.date, bars: f(s.bars) } : s);
  // Sessions drawn, read from the labels; outils.montre agrees for every closed session.
  const vus = (B, G = g(B)) => {
    const { E: T } = charge(), R = plein(T, G, defaut);
    rec.length = 0; T.dessine(G, defaut);
    const ids = [...new Set(rec.filter(x => x.k === 'texte').map(x => Object.keys(NOM).find(k => x.s.startsWith(NOM[k] + ' '))))].sort();
    assert.deepEqual(Object.keys(R.D).filter(id => T.outils.montre(R, R.D[id])).sort(), ids, 'montre() = sessions tracées');
    return ids;
  };
  assert.deepEqual(vus(bars), ['asie', 'eu', 'fin', 'us'], 'graphe complet : les quatre sessions');
  // A weekend is no missing day: Monday's New York in progress, Friday's New York and close drawn.
  assert.deepEqual(vus(aplat(avecJour(2, b => b.filter(x => x.m < 1110), SESS.slice(0, 3)))), ['asie', 'eu', 'fin', 'us'], 'week-end');
  // Good Friday 2026-04-03 is a full CME closure in TT's calendar, no missing day: Monday shows Thursday's levels.
  assert.deepEqual(vus(aplat([{ date: '2026-04-02', bars: SESS[1].bars }, { date: '2026-04-06', bars: SESS[2].bars.filter(x => x.m < 1110) }])), ['asie', 'eu', 'fin', 'us'], 'Vendredi saint');
  // Joined late: the chart opens inside Tokyo; within TT's 10 minutes, Tokyo stays.
  assert.deepEqual(vus(aplat([{ date: dL, bars: SESS[L].bars.filter(x => x.m >= 100) }])), ['eu'], 'graphe ouvert en pleine session de Tokyo');
  assert.deepEqual(vus(aplat([{ date: dL, bars: SESS[L].bars.filter(x => x.m >= 5) }])), ['asie', 'eu'], 'Tokyo pris 5 minutes après l\'ouverture');
  // The live session loaded from inside London only (NQ minute history from 03:21 ET on 2026-10-27): no
  // Tokyo of that day, so the day before's is outdated; London taken late; New York and close of the day before.
  assert.deepEqual(vus(aplat(avecJour(L, b => b.filter(x => x.m >= W(dL).eu.a + 21)))), ['fin', 'us'], 'séance prise à Londres');
  // Previous session cut in London (ES on 2026-10-22, 07:37 ET), the live one in Tokyo: London cut, the
  // New York and close of the day before missing, so those of two days before are outdated. Tokyo stays.
  const coupeEu = b => b.filter(x => x.m < W(dP).eu.a + 60);
  assert.deepEqual(vus(aplat(avecJour(L, b => b.filter(x => x.m < 300), avecJour(L - 1, coupeEu)))), ['asie'], 'veille coupée à Londres');
  assert.deepEqual(vus(aplat(avecJour(L - 1, coupeEu))), ['asie', 'eu'], 'veille coupée, New York en cours');
  // Previous business day missing, plainly or as TT's filler block (bars _trou at minute 0 dated the missing day).
  assert.deepEqual(vus(aplat(SESS.filter((s, k) => k !== L - 1))), ['asie', 'eu'], 'veille absente');
  const c0 = SESS[L - 2].bars.at(-1).c, bouche = Array.from({ length: 8 }, () => ({ _trou: true, m: 0, o: c0, h: c0, l: c0, c: c0, lv: [] }));
  assert.deepEqual(vus(aplat(avecJour(L - 1, () => bouche))), ['asie', 'eu'], 'veille comblée par TT');
  // A hole in London: 30 minutes go, 5 minutes pass (TT's rule: over 10 minutes beyond a bar).
  const a = W(dL).eu.a, trou = n => b => b.filter(x => x.m < a + 60 || x.m >= a + 60 + n);
  assert.deepEqual(vus(aplat(avecJour(L, trou(30)))), ['asie', 'fin', 'us'], 'trou de 30 minutes à Londres');
  assert.deepEqual(vus(aplat(avecJour(L, trou(5)))), ['asie', 'eu', 'fin', 'us'], 'trou de 5 minutes à Londres');
  // Three filler bars inside the previous New York: too short for the hole rule, the flag alone masks it.
  assert.deepEqual(vus(aplat(avecJour(L - 1, b => b.map(x => x.m >= 1000 && x.m < 1003 ? { m: x.m, o: x.o, h: x.o, l: x.o, c: x.o, lv: [], _trou: true } : x)))),
    ['asie', 'eu', 'fin'], 'barres de comblement à New York');
  // Footprint, no dates: windows of today, sessions split on the minute going back. A late or cut session is
  // still seen; a missing business day is not (documented limit).
  const Wt = W(new Date().toISOString().slice(0, 10)), sans = B => B.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  assert.deepEqual(vus(sans(aplat(avecJour(L, b => b.filter(x => x.m >= Wt.eu.a + 21))))), ['fin', 'us'], 'footprint : séance prise à Londres');
  assert.deepEqual(vus(sans(aplat(avecJour(L - 1, b => b.filter(x => x.m < Wt.eu.a + 60))))), ['asie', 'eu'], 'footprint : veille coupée');
  // Notifications: a masked level never rings. After the cut day, the live session opens with one bar inside the
  // cut London's range (no touch on it), then a bar that touches every level: only the drawn ones ring.
  {
    const { E: T, notes } = charge(), r = avec({ alerte: 'meche' }), B = aplat(avecJour(L, () => [], avecJour(L - 1, coupeEu)));
    const eu = attendu(B, indices(b => b._date === dP && dans(b, W(dP).eu.a, W(dP).eu.b))(B)), mi = (eu.H.p + eu.L.p) / 2;
    B.push({ _date: dL, m: 0, o: mi, h: mi, l: mi, c: mi });
    plein(T, g(B), r); T.dessine(g(B), r);
    const R0 = T.calcul(g(B), r), vierges = o => [['H', o.H], ['L', o.L]].filter(x => x[1].m < 0).map(x => o.id + ' ' + x[0]);
    const attendus = Object.values(R0.D).filter(o => T.outils.montre(R0, o)).flatMap(vierges).sort();
    assert.ok(vierges(R0.D.eu).length === 2 && !T.outils.montre(R0, R0.D.eu), 'Londres coupé, masqué et vierge');
    B.push({ _date: dL, m: 1, o: mi, h: mi + 1e4, l: mi - 1e4, c: mi });
    T.dessine(g(B), r);
    assert.deepEqual(notes.map(t => lu([t])[0].split(' ').slice(0, 2).join(' ')).sort(), attendus, 'seuls les niveaux tracés sonnent');
    assert.ok(attendus.length > 0, 'des niveaux tracés sonnent');
  }
}

console.log('OK niveaux_sessions |', N, 'barres |', Object.entries(P.D).map(([id, o]) => id + ' H ' + o.H.p + (o.H.m >= 0 ? ' touché' : ' vierge') + ', L ' + o.L.p + (o.L.m >= 0 ? ' touché' : ' vierge')).join(' | '));
