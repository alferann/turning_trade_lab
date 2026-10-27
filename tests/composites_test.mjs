// Self-check for extensions/composites.js: rolling volume composites built by Turning Trade's own
// composite builder (hfq-composite-vp.js) from real ES sessions, on a fake Market Profile page (its
// days `D` and `mpVolTick`), a candle chart (caVppBundle) and a footprint (fpVppBundle); masking when
// the history is shorter than asked, side-by-side placement, drawing, caching and frame budget.
// Run: node tests/composites_test.mjs   (from the repo root; TT_DATA overrides the data folder,
// TT_PAYLOAD the payload folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/composites.js'), 'utf8');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

// Full sessions of the archive (18:00 to 17:00 ET), whatever days it holds, as Market Profile days:
// one row per price, [price, total, bid, ask], as TT's builder reads them.
const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const pleines = db.sessions.filter(s => s.bars[0].m === 0 && s.bars[s.bars.length - 1].m >= 1370);
assert.ok(pleines.length >= 5, 'au moins cinq séances pleines dans l\'archive');
const jour = s => {
  const h = new Map();
  for (const b of s.bars) for (const [p, bid, ask] of b.lv) { const e = h.get(p) || [0, 0]; e[0] += bid; e[1] += ask; h.set(p, e); }
  return { date: s.date, volTick: 0.25, volRows: [...h].sort((a, b) => a[0] - b[0]).map(([p, [bid, ask]]) => [p, bid + ask, bid, ask]) };
};
const D = pleines.map(jour);

// A fresh context per check: TT's contract, value area and composite builder, the study, a fake page.
const charger = (extra = {}) => {
  const ctx = Object.assign({ console, performance, Date }, extra);
  ctx.window = ctx;
  const defs = [];
  ctx.HFQExt = { etude(d) { defs.push(d); return true; } };
  const vc = vm.createContext(ctx);
  for (const f of ['hfq-contract.js', 'hfq-va.js', 'hfq-composite-vp.js']) vm.runInContext(fs.readFileSync(path.join(PAYLOAD, f), 'utf8'), vc);
  vm.runInContext(SRC, vc);
  return { ctx, defs, VP: ctx.HFQCompositeVP };
};
const { defs, VP } = charger();
assert.deepEqual(defs.map(d => d.id), ['composites-a', 'composites-b', 'composites-c', 'composites-d'], 'ids stables');
const defaut = d => Object.fromEntries(d.reglages.map(x => [x.k, x.defaut]));
assert.deepEqual(defs.map(d => defaut(d).seances), [30, 14, 60, 90], 'séances par défaut');
assert.deepEqual(defs.map(d => defaut(d).decal), [0, 12, 24, 36], 'chaque instance collée à gauche de la précédente');
assert.ok(defs.every(d => d.graphes.join() === 'profil,bougies,footprint'), 'Market Profile, bougies, footprint');

const rec = [];
const ctx2d = { set fillStyle(c) { this._c = c; }, set strokeStyle(c) { this._s = c; }, set lineWidth(l) { this._l = l; }, set globalAlpha(a) { this._a = a; }, beginPath() { this._p = []; },
  rect(x, y, w, h) { this._p.push({ x, y, w, h }); }, fill() { for (const r of this._p) rec.push(Object.assign({ k: 'rect', c: this._c, a: this._a }, r)); },
  stroke() { for (const r of this._p) rec.push(Object.assign({ k: 'cadre', c: this._s, a: this._a }, r)); } };
const prixMax = Math.max(...D.flatMap(d => d.volRows.map(r => r[0]))) + 10;
const g = (o = {}) => Object.assign({ graphe: 'profil', n: 0, premiere: 0, derniere: 0, tick: 0.25, seance: 'rth', sym: 'ES', echelle: 1, ctx: ctx2d,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: 5000, largeur: 1000, hauteur: 5000 }, barre: () => null, y: v => (prixMax - v) * 20,
  trait(p, o) { rec.push({ k: 'trait', p: structuredClone(p), o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } }, o);
const dessin = (E, G, r) => { rec.length = 0; E.dessine(G, r); return { rects: rec.filter(x => x.k === 'rect'), cadres: rec.filter(x => x.k === 'cadre'), traits: rec.filter(x => x.k === 'trait'), textes: rec.filter(x => x.k === 'texte') }; };
const proche = (a, b) => Math.abs(a - b) < 1e-6;
const N = D.length;

// 1. Market Profile: the page's days through TT's builder, the same profile as the native composite.
{
  const M = charger({ D, mpVolTick: () => 0.25 }), A = M.defs[0], r = Object.assign(defaut(A), { seances: N });
  const X = A.calcul(g(), r), T = M.VP.buildRollingFromMpDays(D, { tick: 0.25, days: N, vaPct: 70 });
  assert.deepEqual([X.P.poc, X.P.vah, X.P.val, [...X.P.prices]], [T.profile.poc, T.profile.vah, T.profile.val, [...T.profile.prices]], 'profil du composite natif');
  assert.equal(X.titre, 'Composite ' + N + ' séances · du ' + D[0].date + ' au ' + D[N - 1].date, 'légende');
  assert.ok(M.defs[0].calcul(g(), Object.assign(defaut(A), { seances: N - 1 })).P, 'moins de séances que chargées : dessiné');
  // More sessions asked than loaded: hidden, the caption says how many there are.
  const C = M.defs[1], X2 = C.calcul(g(), Object.assign(defaut(C), { seances: N + 1 }));
  assert.equal(X2.raison, 'Composite ' + (N + 1) + ' séances · masqué : ' + N + ' séances disponibles', 'historique trop court : masqué');
  const DM = dessin(C, g(), Object.assign(defaut(C), { seances: N + 1 }));
  assert.ok(!DM.rects.length && !DM.traits.length && DM.textes.length === 1, 'rien que la légende quand masqué');
  // A page without days, and a chart without any composite source: a reason, nothing drawn.
  assert.match(charger({ D: [], mpVolTick: () => 0.25 }).defs[0].calcul(g(), r).raison, /masqué : 0 séances|indisponible/, 'Market Profile sans jours');
  assert.equal(charger().defs[0].calcul(g({ graphe: 'bougies' }), r).raison, 'Composite : profil de volume indisponible sur ce graphe', 'aucune source');
}

// 2. Drawing: pinned to the right edge at its width, buyers against the edge, sellers at the end;
//    B, offset by A's width, sits right next to A without overlapping it.
{
  const M = charger({ D, mpVolTick: () => 0.25 }), [A, B] = M.defs, rA = Object.assign(defaut(A), { seances: N }), rB = Object.assign(defaut(B), { seances: N - 1 });
  const DA = dessin(A, g(), rA), P = A.calcul(g(), rA).P;
  const achat = DA.rects.filter(x => x.c === rA.achatC), vente = DA.rects.filter(x => x.c === rA.venteC);
  assert.ok(achat.length && achat.every(x => proche(x.x + x.w, 1000)), 'acheteurs contre le bord droit');
  const large = Math.max(...achat.map(x => x.w + vente.find(y => y.y === x.y).w));
  assert.ok(proche(large, 120), 'rangée la plus fournie à 12 % du graphe : ' + large);
  const tri = L => [...L].sort((x, y) => x - y);
  assert.ok(tri(achat.map(x => x.w)).every((w, k, L) => proche(w, tri([...P.asks].map(v => 120 * v / P.max))[k])), 'acheteurs proportionnels à leur volume');
  assert.equal(DA.cadres.length, 1, 'rangée du POC cerclée');
  const DB2 = dessin(B, g(), rB);
  assert.ok(DB2.rects.length && DB2.rects.every(x => x.x + x.w <= 880 + 1e-6 && x.x >= 760 - 1e-6), 'B collé à gauche de A');
  // Lines from the profile's left edge, or from the chart's left edge; labels at the profile's left.
  const ligne = D2 => D2.traits[0].p.filter(p => !isNaN(p[0])).map(p => p[0]);
  assert.deepEqual(ligne(DA), [880, 1000], 'POC sous le profil');
  assert.deepEqual(ligne(dessin(A, g(), Object.assign({}, rA, { lignes: 'gauche' }))), [0, 1000], 'POC depuis le bord gauche');
  assert.ok(DA.textes.some(x => x.s.startsWith('POC ' + N + ' ') && x.x === 876), 'étiquette du POC à gauche du profil');
  // Total mode: one color for the value area, one outside, the POC row apart.
  const DT = dessin(A, g(), Object.assign({}, rA, { mode: 'total' }));
  assert.equal(DT.rects.filter(x => x.c === rA.pocC).length, 1, 'une rangée POC');
  assert.ok(DT.rects.some(x => x.c === rA.couleurVA) && DT.rects.some(x => x.c === rA.couleur), 'Value Area et hors Value Area');
  assert.ok(!dessin(A, g(), Object.assign({}, rA, { profil: false, pocL: false, vaL: false, etiq: false })).rects.length, 'tout se décoche');
}

// 3. Candles: TT's panel bundle, built once per session and setting, not on every bar.
{
  const appels = [], M = charger();
  M.ctx.caVppBundle = (scope, o) => { appels.push([scope, o.days, o.vaPct]); return M.VP.buildRollingFromMpDays(D, { tick: 0.25, days: o.days, vaPct: o.vaPct }); };
  const A = M.defs[0], r = Object.assign(defaut(A), { seances: N });
  const B = [{ _date: '2026-11-02', m: 0 }, { _date: '2026-11-02', m: 1 }];
  const Gc = (bs) => g({ graphe: 'bougies', n: bs.length, barre: i => bs[i] || null, tf: 1, seance: 'eth' });
  A.calcul(Gc(B), r); A.calcul(Gc(B.concat([{ _date: '2026-11-02', m: 2 }])), r);
  assert.deepEqual(appels, [['rolling', N, 70]], 'un appel par séance');
  A.calcul(Gc(B.concat([{ _date: '2026-11-03', m: 0 }])), r);
  A.calcul(Gc(B), Object.assign({}, r, { vaPct: 68 }));
  assert.equal(appels.length, 3, 'nouvelle séance ou nouveau réglage : recalcul');
  // Footprint: no dates, a new session is where the minutes go back.
  const appF = [], F = charger();
  F.ctx.fpVppBundle = (scope, o) => { appF.push(scope); return F.VP.buildRollingFromMpDays(D, { tick: 0.25, days: o.days }); };
  const S1 = [{ m: 0 }, { m: 1 }, { m: 2 }], Gf = bs => g({ graphe: 'footprint', n: bs.length, barre: i => bs[i] || null, tf: 1, seance: 'eth' });
  F.defs[0].calcul(Gf(S1), r); F.defs[0].calcul(Gf(S1.concat([{ m: 3 }])), r);
  assert.equal(appF.length, 1, 'footprint : même séance, pas de recalcul');
  F.defs[0].calcul(Gf(S1.concat([{ m: 3 }, { m: 0 }])), r);
  assert.equal(appF.length, 2, 'footprint : les minutes repartent, nouvelle séance');
}

// 4. Budget: TT's builder runs once per session; frames after it serve the cache.
{
  const M = charger({ D, mpVolTick: () => 0.25 }), A = M.defs[0], r = Object.assign(defaut(A), { seances: N });
  const t0 = performance.now(); A.dessine(g(), r); const froid = performance.now() - t0;
  const t1 = performance.now(); for (let k = 0; k < 50; k++) A.dessine(g(), r); const chaud = (performance.now() - t1) / 50;
  assert.ok(chaud < 2, 'image servie par le cache : ' + chaud.toFixed(3) + ' ms');
  console.log('OK composites |', N, 'séances ES réelles | froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
