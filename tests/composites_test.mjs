// Self-check for extensions/composites.js: rolling volume composites summed per tick by the study
// itself, from real ES sessions, on a fake Market Profile page (its days `D` and `mpVolTick`), a
// candle chart and a footprint (bar levels); rows grouped by a step, masking when the history is
// shorter than asked, side-by-side placement, drawing, caching and frame budget.
// Run: node tests/composites_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/composites.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

// Full sessions of the archive (18:00 to 17:00 ET), whatever days it holds, as Market Profile days:
// one row per price, [price, total, bid, ask], as TT's page holds them.
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const pleines = db.sessions.filter(s => s.bars[0].m === 0 && s.bars[s.bars.length - 1].m >= 1370);
assert.ok(pleines.length >= 5, 'au moins cinq séances pleines dans l\'archive');
const jour = s => {
  const h = new Map();
  for (const b of s.bars) for (const [p, bid, ask] of b.lv) { const e = h.get(p) || [0, 0]; e[0] += bid; e[1] += ask; h.set(p, e); }
  return { date: s.date, volTick: 0.25, volRows: [...h].sort((a, b) => a[0] - b[0]).map(([p, [bid, ask]]) => [p, bid + ask, bid, ask]) };
};
const D = pleines.map(jour);
const N = D.length;

// A fresh context per check: the study on a fake page.
const charger = (extra = {}) => {
  const ctx = Object.assign({ console, performance, Date }, extra);
  ctx.window = ctx;
  const defs = [];
  ctx.HFQExt = { etude(d) { defs.push(d); return true; } };
  vm.runInContext(SRC, vm.createContext(ctx));
  return { ctx, defs };
};
const { defs } = charger({ D, mpVolTick: () => 0.25 });
assert.deepEqual(defs.map(d => d.id), ['composites-a', 'composites-b', 'composites-c', 'composites-d'], 'ids stables');
const defaut = d => Object.fromEntries(d.reglages.map(x => [x.k, x.defaut]));
assert.deepEqual(defs.map(d => defaut(d).seances), [30, 14, 60, 90], 'séances par défaut');
assert.deepEqual(defs.map(d => defaut(d).decal), [0, 12, 24, 36], 'chaque instance collée à gauche de la précédente');
assert.ok(defs.every(d => d.graphes.join() === 'profil,bougies,footprint'), 'Market Profile, bougies, footprint');
const A = defs[0], E = A.outils;

const rec = [];
const ctx2d = { set fillStyle(c) { this._c = c; }, set strokeStyle(c) { this._s = c; }, set lineWidth(l) { this._l = l; }, set globalAlpha(a) { this._a = a; }, beginPath() { this._p = []; },
  rect(x, y, w, h) { this._p.push({ x, y, w, h }); }, fill() { for (const r of this._p) rec.push(Object.assign({ k: 'rect', c: this._c, a: this._a }, r)); },
  stroke() { for (const r of this._p) rec.push(Object.assign({ k: 'cadre', c: this._s, a: this._a }, r)); } };
// The frame covers the whole composite, 20 px per point: a row outside it is culled by the study, and the
// archive's price range moves every day.
const prixMax = Math.max(...D.flatMap(d => d.volRows.map(r => r[0]))) + 10, prixMin = Math.min(...D.flatMap(d => d.volRows.map(r => r[0]))) - 10;
const g = (o = {}) => Object.assign({ graphe: 'profil', n: 0, premiere: 0, derniere: 0, tick: 0.25, seance: 'rth', sym: 'ES', echelle: 1, ctx: ctx2d,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: (prixMax - prixMin) * 20, largeur: 1000, hauteur: (prixMax - prixMin) * 20 }, barre: () => null, y: v => (prixMax - v) * 20,
  trait(p, o) { rec.push({ k: 'trait', p: structuredClone(p), o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } }, o);
const dessin = (E, G, r) => { rec.length = 0; E.dessine(G, r); return { rects: rec.filter(x => x.k === 'rect'), cadres: rec.filter(x => x.k === 'cadre'), traits: rec.filter(x => x.k === 'trait'), textes: rec.filter(x => x.k === 'texte') }; };
const proche = (a, b) => Math.abs(a - b) < 1e-6;
const tri = a => [...a].sort((x, y) => x - y);
// Brute-force reference: {tick index: [bid, ask]} of the last n days.
const reference = n => { const h = {}; for (const d of D.slice(-n)) for (const [p, , bid, ask] of d.volRows) { const e = h[Math.round(p / 0.25)] ||= [0, 0]; e[0] += bid; e[1] += ask; } return h; };
const parTick = P => { const h = {}; P.prices.forEach((p, k) => { h[Math.round(p / 0.25)] = [P.bids[k], P.asks[k]]; }); return h; };

// 1. Value area on hand-made volumes (indices of rising ticks): POC 2, then the richer neighbour first;
//    the auto row step follows Turning Trade: one point on the Nasdaq family, one tick elsewhere.
{
  const va = part => { const Z = E.zoneValeur([5, 10, 40, 25, 20], part); return [Z.poc, Z.val, Z.vah, Z.total]; };
  assert.deepEqual(va(0.6), [2, 2, 3, 100], '40 + 25 = 65 covers 60');
  assert.deepEqual(va(0.7), [2, 2, 4, 100], '65 < 70, then 20 beats 10: 85');
  assert.equal(E.zoneValeur([5, 5], 0.7).poc, 0, 'POC ex aequo : le plus bas');
  assert.deepEqual(['NQZ6', 'MNQH7', 'ESZ6', 'CLF7', ''].map(s => E.pasAuto(s, 0.25)), [4, 4, 1, 1, 1], 'pas auto par symbole');
}

// 2. Market Profile: the page's days summed per tick; one-tick rows equal the brute-force sums, POC and
//    value area come from the per-tick volumes; grouped rows sum their ticks and keep the same levels.
{
  const r = Object.assign(defaut(A), { seances: N, rangee: 1 }), X = A.calcul(g(), r), P = X.P;
  assert.ok(P && P.hasSides, 'profil avec les deux côtés');
  assert.deepEqual(parTick(P), reference(N), 'rangées d\'un tick = volume par tick des ' + N + ' séances');
  const H = reference(N), T = Object.keys(H).map(Number).sort((a, b) => a - b), V = T.map(q => H[q][0] + H[q][1]), Z = E.zoneValeur(V, 0.7);
  assert.deepEqual([P.poc, P.vah, P.val], [T[Z.poc] * 0.25, T[Z.vah] * 0.25, T[Z.val] * 0.25], 'POC, VAH, VAL au tick');
  assert.equal(P.tick, 0.25, 'hauteur de rangée : un tick');
  assert.equal(X.titre, 'Composite ' + N + ' séances · du ' + D[0].date + ' au ' + D[N - 1].date, 'légende');
  const r4 = Object.assign({}, r, { rangee: 4 }), P4 = A.calcul(g(), r4).P;
  assert.equal(P4.tick, 1, 'rangées de quatre ticks');
  assert.ok(P4.prices.every(p => proche((p - 0.375) % 1, 0)), 'rangées alignées sur les multiples de quatre ticks');
  const somme = Q => Q.reduce((s, v) => s + v, 0);
  assert.ok(proche(somme(P4.vols), somme(P.vols)) && proche(somme(P4.bids), somme(P.bids)), 'même volume total une fois regroupé');
  assert.ok(P4.prices.length < P.prices.length / 2, 'moins de rangées');
  assert.deepEqual([P4.poc, P4.vah, P4.val], [P.poc, P.vah, P.val], 'le regroupement ne change ni le POC ni la Value Area');
  for (let k = 0; k < P4.prices.length; k++) {
    const q0 = Math.round((P4.prices[k] - 0.375) / 0.25), attendu = [0, 1, 2, 3].reduce((s, j) => s + ((H[q0 + j] || [0, 0])[0] + (H[q0 + j] || [0, 0])[1]), 0);
    assert.ok(proche(P4.vols[k], attendu), 'rangée ' + k + ' = somme de ses quatre ticks');
  }
  assert.equal(A.calcul(g({ sym: 'NQZ6' }), Object.assign({}, r, { rangee: 0 })).P.tick, 1, 'auto sur NQ : un point');
  assert.equal(A.calcul(g(), Object.assign({}, r, { rangee: 0 })).P.tick, 0.25, 'auto sur ES : un tick');
  assert.ok(A.calcul(g(), Object.assign(defaut(A), { seances: N - 1 })).P, 'moins de séances que chargées : dessiné');
  const X2 = A.calcul(g(), Object.assign(defaut(A), { seances: N + 1 }));
  assert.equal(X2.raison, 'Composite ' + (N + 1) + ' séances · masqué : ' + N + ' séances disponibles', 'historique trop court : masqué');
  const DM = dessin(A, g(), Object.assign(defaut(A), { seances: N + 1 }));
  assert.ok(!DM.rects.length && !DM.traits.length && DM.textes.length === 1, 'rien que la légende quand masqué');
  assert.match(charger({ D: [], mpVolTick: () => 0.25 }).defs[0].calcul(g(), r).raison, /masqué : 0 séances|indisponible/, 'Market Profile sans jours');
  assert.equal(charger().defs[0].calcul(g({ graphe: 'bougies' }), r).raison, 'Composite : profil de volume indisponible sur ce graphe', 'aucune barre');
}

// 3. Drawing: pinned to the right edge at its width, buyers against the edge, sellers at the end;
//    B to the left of A; POC and VA lines; labels; everything switches off.
{
  const rA = Object.assign(defaut(A), { seances: N, rangee: 1 }), P = A.calcul(g(), rA).P;
  const DA = dessin(A, g(), rA), achat = DA.rects.filter(x => x.c === rA.achatC);
  assert.ok(achat.length && achat.every(x => proche(x.x + x.w, 1000)), 'acheteurs contre le bord droit');
  // Stacked: buyers and sellers of a row share its y; the fullest row is their sum.
  const large = Math.max(...Object.values(DA.rects.reduce((h, x) => (h[x.y] = (h[x.y] || 0) + x.w, h), {})));
  assert.ok(proche(large, 120), 'rangée la plus fournie à 12 % du graphe : ' + large);
  assert.ok(tri(achat.map(x => x.w)).every((w, k, L) => proche(w, tri([...P.asks].map(v => 120 * v / P.max))[k])), 'acheteurs proportionnels à leur volume');
  assert.equal(DA.cadres.length, 1, 'rangée du POC cerclée');
  const B = defs[1], DB2 = dessin(B, g(), Object.assign(defaut(B), { seances: N, rangee: 1 }));
  assert.ok(DB2.rects.length && DB2.rects.every(x => x.x + x.w <= 880 + 1e-6 && x.x >= 760 - 1e-6), 'B collé à gauche de A');
  const ligne = Dx => { const t = Dx.traits.find(x => x.o.couleur === rA.pocLC); return [t.p[0][0], t.p[1][0]]; };
  assert.deepEqual(ligne(DA), [880, 1000], 'POC sous le profil');
  assert.deepEqual(ligne(dessin(A, g(), Object.assign({}, rA, { lignes: 'gauche' }))), [0, 1000], 'POC depuis le bord gauche');
  assert.ok(DA.textes.some(x => x.s.startsWith('POC ' + N + ' ') && x.x === 876), 'étiquette du POC à gauche du profil');
  const DT = dessin(A, g(), Object.assign({}, rA, { mode: 'total' }));
  assert.equal(DT.rects.filter(x => x.c === rA.pocC).length, 1, 'une rangée POC');
  assert.ok(DT.rects.some(x => x.c === rA.couleurVA) && DT.rects.some(x => x.c === rA.couleur), 'Value Area et hors Value Area');
  assert.ok(!dessin(A, g(), Object.assign({}, rA, { profil: false, pocL: false, vaL: false, etiq: false, legende: false })).rects.length, 'tout se décoche');
  const D4 = dessin(A, g(), Object.assign({}, rA, { rangee: 4 }));
  assert.ok(D4.rects.length < DA.rects.length && D4.rects.every(x => x.h >= 19), 'rangées de quatre ticks : moins de rectangles, plus hauts');
}

// 4. Candles and footprint: the bars' levels by session date (`_date`, or `_sd` on the footprint) give
//    the same composite as the Market Profile days; read once per session, served from the cache after.
{
  const bars = [], sd = [];
  for (const s of pleines) for (const b of s.bars) { bars.push(Object.assign({ _date: s.date }, b)); sd.push(Object.assign({ _sd: s.date }, b)); }
  let lectures = 0;
  const gb = (B, o = {}) => g(Object.assign({ graphe: 'bougies', n: B.length, premiere: B.length - 300, derniere: B.length - 1, tf: 1, barre: i => { lectures++; return B[i] || null; } }, o));
  const M = charger({ D, mpVolTick: () => 0.25 }), C = charger();
  const r = Object.assign(defaut(A), { seances: N, rangee: 1 });
  const ref = M.defs[0].calcul(g(), r).P, X = C.defs[0].calcul(gb(bars), r).P;
  assert.deepEqual([parTick(X), X.poc, X.vah, X.val], [parTick(ref), ref.poc, ref.vah, ref.val], 'bougies = Market Profile');
  const F = charger().defs[0].calcul(gb(sd, { graphe: 'footprint', tf: '1000t' }), r).P;
  assert.deepEqual([parTick(F), F.poc], [parTick(ref), ref.poc], 'footprint `_sd` = bougies');
  lectures = 0; C.defs[0].calcul(gb(bars), r); assert.equal(lectures, 2, 'même séance : rien relu');
  C.defs[1].calcul(gb(bars), Object.assign(defaut(defs[1]), { seances: 5 })); assert.equal(lectures, 4, 'autre instance : la lecture est partagée');
  const plus = bars.concat([Object.assign({}, bars[bars.length - 1], { m: bars[bars.length - 1].m + 1 })]);
  lectures = 0; C.defs[0].calcul(gb(plus), r); assert.equal(lectures, 2, 'une barre de plus dans la séance en cours : figée, rien relu');
  const neuve = bars.concat(bars.slice(0, 3).map(b => Object.assign({}, b, { _date: '2099-01-01' })));
  lectures = 0; assert.equal(C.defs[0].calcul(gb(neuve), r).titre.slice(-10), '2099-01-01', 'nouvelle séance : relue'); assert.ok(lectures > neuve.length, 'toutes les barres relues');
}

// 5. Budget: the sessions are read once; frames after it serve the cache.
{
  const r = Object.assign(defaut(A), { seances: N });
  const M = charger({ D, mpVolTick: () => 0.25 }), G = g();
  const t0 = performance.now(); M.defs[0].dessine(G, r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 20; k++) M.defs[0].dessine(G, r); const chaud = (performance.now() - t1) / 20;
  assert.ok(froid < 200, 'première image : ' + froid.toFixed(1) + ' ms');
  assert.ok(chaud < 2, 'image servie par le cache : ' + chaud.toFixed(3) + ' ms');
  console.log('  Market Profile ' + N + ' séances : première image ' + froid.toFixed(1) + ' ms, cache ' + chaud.toFixed(3) + ' ms');
}

console.log('OK composites : ' + N + ' séances pleines, ' + A.calcul(g(), Object.assign(defaut(A), { seances: N })).P.prices.length + ' rangées d\'un tick');
