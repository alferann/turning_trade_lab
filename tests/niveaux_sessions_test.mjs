// Self-check for extensions/niveaux_sessions.js on real ES bars baked by Turning Trade:
// last closed session highs and lows against a brute-force reading, TT's own session
// module (hfq-clock.js, hfq-sessions-monde.js), a session straddling the chart opening,
// bar-by-bar growth with a live bar, replay rewind, notifications and drawing.
// Run: node tests/niveaux_sessions_test.mjs   (from the repo root; TT_DATA overrides the data
// folder, TT_PAYLOAD the payload folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/niveaux_sessions.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const N = bars.length;

// Loads the study in a fresh context, with TT's session modules if asked.
function charge(avecTT = false) {
  const defs = [], notes = [];
  class Notification { constructor(t, o) { notes.push(t + ' | ' + o.body); } }
  Notification.permission = 'granted';
  const vc = vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; }, redessiner() {} }, Notification, performance, console });
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
const dates = db.sessions.map(s => s.date), der = dates[dates.length - 1], avant = dates[dates.length - 2];
// Default windows in October (London and New York both on summer time), in chart minutes
// of an ETH chart opened at 18:00 ET, for the middle of a one-minute bar.
const dans = (b, a, z) => b.m + 0.5 >= a && b.m + 0.5 < z;

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

// 2. Last closed session of each kind on real ES bars. The last session of the archive stops
// before 09:30, so London is in progress: Tokyo is that day's, the others the day before's.
const P = plein(E, g(), defaut);
{
  const S = (d, a, z) => attendu(bars, indices(b => b._date === d && dans(b, a, z))(bars));
  const A = { asie: S(der, 0, 540), eu: S(avant, 540, 930), us: S(avant, 930, 1320), fin: S(avant, 1320, 1440) };
  assert.deepEqual(Object.keys(P.D).sort(), Object.keys(A).sort(), 'une session close par id');
  for (const id in A) assert.deepEqual(resume(P.D[id]), A[id], 'session ' + id);
  assert.equal(P.cour.id, 'eu', 'Londres en cours');
  // Not a degenerate fixture: something gets touched, something does not.
  const t = Object.values(A).flatMap(o => [o.H, o.L]);
  assert.ok(t.some(v => v.m >= 0) && t.some(v => v.m < 0), 'des niveaux touchés et d\'autres vierges');
  assert.ok(t.some(v => v.c >= 0 && v.c > v.m), 'une clôture au-delà après la mèche');
  // Same result through TT's module.
  assert.deepEqual(resume(plein(charge(true).E, g(), defaut).D.us), resume(P.D.us), 'avec le module de TT');
}

// 3. Tokyo moved to 19:00 ET in TT: the close session runs 16:00-19:00 and straddles the
// chart opening, its tail being the first hour of the next chart session.
{
  const { E: T, vc } = charge(true);
  plein(T, g(), defaut);
  vm.runInContext('HFQSessionsMonde.ecrire([{id:"asie", h:19, m:0}])', vc);
  const R = plein(T, g(), defaut);
  const fin = indices(b => (b._date === avant && b.m + 0.5 >= 1320) || (b._date === der && b.m + 0.5 < 60))(bars);
  assert.deepEqual(resume(R.D.fin), attendu(bars, fin), 'clôture à cheval sur l\'ouverture');
  assert.deepEqual(resume(R.D.asie), attendu(bars, indices(b => b._date === der && dans(b, 60, 540))(bars)), 'Tokyo depuis 19:00');
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
  const ids = bars.map(b => (dans(b, 0, 540) ? 'asie' : dans(b, 540, 930) ? 'eu' : dans(b, 930, 1320) ? 'us' : 'fin') + ':' + b._date);
  const occ = [];
  ids.forEach((c, k) => { if (!k || c !== ids[k - 1]) occ.push({ id: c.split(':')[0], deb: k, fin: k }); else occ[occ.length - 1].fin = k; });
  const out = [];
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
  const { E: T, notes } = charge(), r = avec({ alerte: 'meche' }), t = P.D.eu.H.m;
  assert.ok(t >= 0, 'le haut de Londres est touché');
  plein(T, g(bars, 'eth', t + 1), r);
  T.dessine(g(bars, 'eth', t + 1), r);
  T.dessine(g(), r);
  T.dessine(g(bars, 'eth', N - 700), r);
  assert.equal(notes.length, 0, 'historique muet');
  const frais = plein(charge().E, g(bars, 'eth', N - 700), r), R = plein(T, g(bars, 'eth', N - 700), r);
  for (const id in frais.D) assert.deepEqual(resume(R.D[id]), resume(frais.D[id]), 'retour arrière ' + id);
}

// 8. Drawing: from the extreme bar to the touch chosen, or to the right edge; a session
// unchecked is not drawn; labels name the session.
{
  const trace = r => { rec.length = 0; E.dessine(g(), r); return rec.filter(x => x.k === 'trait').map(x => [x.p[0][0], x.p[1][0], x.p[0][1]]); };
  for (const [jusqua, champ] of [['meche', 'm'], ['cloture', 'c'], ['bord', null]]) {
    const A = Object.values(P.D).flatMap(o => [o.H, o.L]).map(v => [v.i, champ && v[champ] >= 0 ? v[champ] : 1e6, v.p]);
    assert.deepEqual(trace(avec({ jusqua })), A, 'traits ' + jusqua);
  }
  assert.equal(trace(avec({ us: false })).length, 6, 'New York décoché');
  assert.ok(rec.some(x => x.k === 'texte' && x.s === 'Londres H') && !rec.some(x => x.k === 'texte' && x.s.startsWith('New York')), 'étiquettes');
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

console.log('OK niveaux_sessions |', N, 'barres |', Object.entries(P.D).map(([id, o]) => id + ' H ' + o.H.p + (o.H.m >= 0 ? ' touché' : ' vierge') + ', L ' + o.L.p + (o.L.m >= 0 ? ' touché' : ' vierge')).join(' | '));
