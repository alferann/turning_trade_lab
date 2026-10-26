// Self-check for extensions/profil_periode.js: session, US/Asia/Europe session, ISO week and month
// volume profiles with buyers and sellers apart, previous periods and the drawing, on real ES bars
// baked by Turning Trade and on synthetic sessions.
// Run: node tests/profil_periode_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/profil_periode.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const last = db.sessions[db.sessions.length - 1], iLast = bars.length - last.bars.length;

// Each context gets its own study instances; `extra` adds globals such as HFQSessionsMonde.
const charger = (extra = {}) => { const defs = []; vm.runInContext(SRC, vm.createContext(Object.assign({ HFQExt: { etude(d) { defs.push(d); return true; } }, console, performance }, extra))); return defs; };
const defs = charger();
assert.deepEqual(defs.map(d => d.id), ['profil-periode', 'profil-periode-b', 'profil-periode-c', 'profil-periode-d'], 'ids stables');
assert.deepEqual(defs.map(d => d.reglages[0].defaut), ['jour', 'sem', 'mois', 'us'], 'période par défaut de chaque instance');
const E = defs[0];
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

// Same level reader as hfq-ext.js: [price, bid, ask].
const niveaux = b => { const lv = b && b.lv || []; return { n: lv.length, prix: k => lv[k][0], bid: k => lv[k][1] || 0, ask: k => lv[k][2] || 0,
  volume: () => lv.reduce((s, l) => s + (l[1] || 0) + (l[2] || 0), 0) }; };
const rec = [];
const ctx = { set fillStyle(c) { this._c = c; }, set strokeStyle(c) { this._s = c; }, set lineWidth(l) { this._l = l; }, set globalAlpha(a) { this._a = a; }, beginPath() { this._p = []; },
  rect(x, y, w, h) { this._p.push({ x, y, w, h }); }, fill() { for (const r of this._p) rec.push(Object.assign({ k: 'rect', c: this._c, a: this._a }, r)); },
  stroke() { for (const r of this._p) rec.push(Object.assign({ k: 'cadre', c: this._s, a: this._a, l: this._l }, r)); } };
let syms = 0;
// Each call gets its own symbol unless one is given, so caches never leak between checks. One bar per pixel.
const g = (B = bars, o = {}) => Object.assign({ n: B.length, premiere: B.length - 300, derniere: B.length - 1, tick: 0.25, seance: 'eth', sym: 'T' + syms++, tf: 1, echelle: 1,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: 1e5, largeur: 1000, hauteur: 1e5 }, barre: i => B[i] || null, niveaux: i => niveaux(B[i]),
  x: i => i, y: v => v, ctx, trait(p, o) { rec.push({ k: 'trait', p: structuredClone(p), o: structuredClone(o) }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } }, o);

// Reference profile by brute force: {tick index: [bid, ask]} of the bars whose minute passes f.
const reference = (bs, f = () => true) => { const h = {}; for (const b of bs) { if (b._trou || !f(b.m)) continue; for (const [p, bi, a] of b.lv || []) { if (bi + a <= 0) continue; const e = h[Math.round(p / 0.25)] ||= [0, 0]; e[0] += bi; e[1] += a; } } return h; };
const plat = R => Object.fromEntries(R.ticks.map((t, k) => [t, [R.bid[k], R.ask[k]]]));
const egal = (R, h, msg) => { assert.deepEqual(plat(R), h, msg); assert.equal(R.total, Object.values(h).reduce((s, e) => s + e[0] + e[1], 0), msg + ' : total'); };
const resume = R => R && { ticks: [...R.ticks], bid: [...R.bid], ask: [...R.ask], total: R.total, poc: R.poc, vah: R.vah, val: R.val, deb: R.deb, fin: R.fin, sans: R.sans, nb: R.nb, cle: R.cle, partiel: R.partiel };
// The first compute may span several frames (null until done): call until it lands.
// Arrays from the study's vm context are copied so deepEqual sees plain arrays.
const complet = (G, r, D = E) => { for (let k = 0; k < 1000; k++) { const X = D.calcul(G, r); if (X) return Object.assign({}, X, { prec: [...X.prec] }); } throw new Error('calcul jamais fini'); };
const cour = (G, r, D) => complet(G, r, D).cour;
const parDate = (B, f) => B.filter(b => f(b._date));
const entre = (a, b) => m => m >= a && m < b;
const sem = d => E.outils.semaine(d);

// 1. Value area on hand-made volumes (indices of rising ticks): POC 2, then the richer neighbour first.
{
  const va = part => { const Z = E.outils.zoneValeur([5, 20, 40, 25, 10], part); return [Z.poc, Z.val, Z.vah, Z.total]; };
  assert.deepEqual(va(0.6), [2, 2, 3, 100], '40 + 25 = 65 covers 60');
  assert.deepEqual(va(0.7), [2, 1, 3, 100], '65 < 70, then 20 beats 10: 85');
  assert.deepEqual(va(0.9), [2, 1, 4, 100], '85 < 90, then 10 beats 5: 95');
  // Ties as in TT's hfq-va.js: the lowest maximum is the POC, then the upper side grows first.
  assert.equal(E.outils.zoneValeur([5, 5], 0.7).poc, 0, 'POC ex aequo : le plus bas');
  const Z = E.outils.zoneValeur([10, 40, 10, 1], 0.75);
  assert.deepEqual([Z.val, Z.vah], [1, 2], 'voisins ex aequo : le haut d\'abord');
}

// 2. Session profile on real ES: the last session, bid and ask per tick; VA holds 70 % and the POC.
{
  const R = cour(g(), defaut), h = reference(last.bars);
  egal(R, h, 'séance ' + last.date);
  assert.deepEqual([R.deb, R.fin], [iLast, bars.length - 1], 'barres de la séance');
  const V = R.ticks.map((t, k) => R.bid[k] + R.ask[k]);
  assert.equal(V[R.ticks.indexOf(R.poc)], Math.max(...V), 'POC au maximum');
  const dansVA = R.ticks.reduce((s, t, k) => s + (t >= R.val && t <= R.vah ? V[k] : 0), 0);
  assert.ok(dansVA >= 0.7 * R.total && R.val <= R.poc && R.poc <= R.vah, 'VA à 70 % autour du POC');
  assert.deepEqual([R.cle, R.partiel, R.sans, R.nom], [last.date, null, 0, 'Séance']);
  const R80 = cour(g(), avec({ vaPct: 80 }));
  assert.ok(R80.vah - R80.val > R.vah - R.val, 'VA 80 % plus large');
}

// 3. Week and month on real ES: the sessions of the last one's ISO week and month; partial when the chart
// starts inside them. A partial previous period is left out.
{
  const partiel = (T, S) => S[0] === db.sessions[0] && !E.outils.premierOuvre(T, S[0].date) ? S[0].date : null;
  for (const [T, cle] of [['sem', sem], ['mois', d => d.slice(0, 7)]]) {
    const S = db.sessions.filter(s => cle(s.date) === cle(last.date)), R = cour(g(), avec({ periode: T }));
    egal(R, reference(S.flatMap(s => s.bars)), T + ' : ' + S.length + ' séances');
    assert.equal(R.partiel, partiel(T, S), T + ' : partiel');
    assert.equal(R.cle, T === 'sem' ? sem(last.date).slice(5) : last.date.slice(0, 7));
    // The last three previous periods, whatever the archive spans, but the partial first one.
    const avant = db.sessions.filter(s => cle(s.date) < cle(last.date)), prec = complet(g(bars, { premiere: 0 }), avec({ periode: T, hist: 3 })).prec;
    const attendu = [...new Set(avant.map(s => cle(s.date)))].slice(-3).filter(c => !(c === cle(avant[0]?.date) && partiel(T, avant)));
    assert.deepEqual(prec.map(R => R.cle), attendu.map(c => T === 'sem' ? c.slice(5) : c), T + ' : précédents, partiel omis');
  }
}

// 4. RTH only on an ETH chart: 09:30-16:00 bars only; ignored on an RTH chart.
{
  egal(cour(g(), avec({ rth: true })), reference(last.bars, entre(930, 1320)), 'RTH seul');
  egal(cour(g(bars, { seance: 'rth' }), avec({ rth: true })), reference(last.bars), 'graphe RTH : pas de filtre');
}

// 5. US, Europe and Asia sessions with the built-in hours: RTH is m ∈ [930, 1320) on an ETH chart opened
// at 18:00 ET, Asia runs from the open to Europe, which starts at 08:00 London and so moves against ET
// between the two DST switches; the three cover the session but its last hour.
{
  assert.deepEqual([...E.outils.bornesET('us', '2026-10-14')], [570, 960], 'RTH 09:30 → 16:00 ET');
  assert.deepEqual([...E.outils.bornesET('eu', '2026-10-14')], [180, 570], 'Europe 03:00 → 09:30 ET');
  assert.deepEqual([...E.outils.bornesET('asie', '2026-10-14')], [1080, 180], 'Asie 18:00 → 03:00 ET');
  assert.deepEqual([...E.outils.bornesET('eu', '2026-10-26')], [240, 570], 'Europe 04:00 ET, Londres à l\'heure d\'hiver avant New York');
  // Windows of the last session's date, in chart minutes.
  const fenDe = T => { const [a, b] = E.outils.bornesET(T, last.date).map(v => (v - 1080 + 1440) % 1440); return entre(a, b <= a ? b + 1440 : b); };
  const fen = { us: fenDe('us'), eu: fenDe('eu'), asie: fenDe('asie') }, total = {};
  for (const T of Object.keys(fen)) {
    const R = cour(g(), avec({ periode: T }));
    egal(R, reference(last.bars, fen[T]), T);
    assert.deepEqual([R.deb, R.fin], [iLast + last.bars.findIndex(b => fen[T](b.m)), iLast + last.bars.findLastIndex(b => fen[T](b.m))], T + ' : barres de la fenêtre');
    assert.equal(R.cle, last.date);
    for (const [t, e] of Object.entries(plat(R))) { const s = total[t] ||= [0, 0]; s[0] += e[0]; s[1] += e[1]; }
  }
  assert.deepEqual(total, reference(last.bars, m => m < 1320), 'Asie + Europe + US = séance sans sa dernière heure');
  // Previous sessions keep their own window; a recording cut before 09:30 has no RTH.
  const prec = complet(g(bars, { premiere: 0 }), avec({ periode: 'us', hist: 9 })).prec;
  const avecRTH = db.sessions.slice(0, -1).filter(s => s.bars.some(b => fen.us(b.m)));
  assert.equal(prec.length, avecRTH.length, 'une RTH par séance précédente qui en a');
  prec.forEach((R, k) => egal(R, reference(avecRTH[k].bars, fen.us), 'RTH du ' + avecRTH[k].date));
  // Before 09:30 the last US session is the previous one; Europe is already today's.
  const tot = bars.slice(0, iLast + last.bars.findIndex(b => b.m >= 900));
  assert.equal(cour(g(tot), avec({ periode: 'us' })).cle, avecRTH.at(-1).date, 'avant 09:30 : RTH de la veille');
  assert.equal(cour(g(tot), avec({ periode: 'eu' })).cle, last.date, 'Europe du jour');
  // TT's world sessions win over the defaults: US moved to 10:00-11:00 ET.
  const D = charger({ HFQSessionsMonde: { bornes: () => [{ id: 'us', debut: 36000, fin: 39600 }] } })[0];
  egal(cour(g(), avec({ periode: 'us' }), D), reference(last.bars, entre(960, 1020)), 'sessions de TT');
}

// Synthetic weekday sessions of three one-minute bars with three levels each.
const jours = (de, a) => { const out = []; for (let d = new Date(de + 'T00:00:00Z'); d <= new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); return out; };
const synth = (dates, m0 = 0) => dates.flatMap((date, s) => [0, 1, 2].map(k => { const b = 100 + 0.25 * ((s * 7 + k) % 40); return { _date: date, m: m0 + k, o: b, h: b + 0.5, l: b, c: b + 0.25, v: 6, lv: [[b, 1, 1], [b + 0.25, s % 3, 2], [b + 0.5, 1, k]] }; }));

// 6. Calendar periods: only the sessions of the current ISO week or month; complete when loaded from the start.
// An RTH chart has no Asian session.
{
  const B = synth(jours('2026-08-31', '2026-10-14'));
  const S = cour(g(B), avec({ periode: 'sem' }));
  egal(S, reference(parDate(B, d => d >= '2026-10-12')), 'semaine 42 : lundi 12 à mercredi 14');
  assert.equal(S.deb, B.findIndex(b => b._date === '2026-10-12'));
  assert.equal(S.partiel, null, 'semaine entière');
  const M = cour(g(B), avec({ periode: 'mois' }));
  egal(M, reference(parDate(B, d => d >= '2026-10')), 'octobre');
  assert.equal(M.partiel, null, 'mois chargé depuis le 1er');
  assert.equal(cour(g(B.filter(b => b._date >= '2026-10-02')), avec({ periode: 'mois' })).partiel, '2026-10-02', 'octobre chargé depuis le 2 : partiel');
  assert.equal(cour(g(B.filter(b => b._date >= '2026-10-12')), avec({ periode: 'sem' })).partiel, null, 'semaine chargée depuis son lundi');
  egal(cour(g(B), defaut), reference(parDate(B, d => d === '2026-10-14')), 'séance du 14');
  assert.match(complet(g(B, { seance: 'rth' }), avec({ periode: 'asie' })).raison, /fenêtre de séance/, 'pas d\'Asie sur un graphe RTH');
}

// 7. Bars without levels are counted, not invented; none at all gives a reason. No dates: session only.
{
  const B = synth(jours('2026-10-12', '2026-10-14'));
  B[B.length - 1] = Object.assign({}, B[B.length - 1], { lv: [] });
  const R = cour(g(B), defaut);
  assert.deepEqual([R.sans, R.nb], [1, 3], 'une barre sur trois sans niveaux');
  egal(R, reference(B.slice(-3)), 'barre sans niveaux ignorée');
  const X = complet(g(B.map(b => Object.assign({}, b, { lv: [] }))), defaut);
  assert.equal(X.cour, null);
  assert.match(X.raison, /aucune barre/);
  const sans = B.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  egal(cour(g(sans), defaut), reference(B.slice(-3)), 'séance retrouvée sans date');
  assert.match(complet(g(sans), avec({ periode: 'sem' })).raison, /sans date/);
  const trou = B.slice(); trou[trou.length - 2] = Object.assign({}, trou[trou.length - 2], { _trou: true });
  assert.equal(cour(g(trou), defaut).nb, 2, 'barre de comblement ignorée');
}

// 8. Incremental: the last bar grows, then a new session opens; same profile as from scratch.
{
  const B = synth(jours('2026-09-28', '2026-10-14')), e = B.length - 4;
  const plein = B.slice(0, e + 2); plein[e] = Object.assign({}, B[e], { lv: B[e].lv.concat([[90, 50, 30]]) });
  const r = avec({ periode: 'mois' });
  complet(g(B.slice(0, e + 1), { sym: 'INC' }), r);
  const t0 = performance.now(), R = E.calcul(g(plein, { sym: 'INC' }), r).cour, pas = performance.now() - t0;
  assert.deepEqual(plat(R)[360], [50, 30], 'barre grossie reprise');
  assert.deepEqual(resume(R), resume(cour(g(plein), r)), 'incrémental = calcul complet');
  assert.ok(pas < 1, 'nouvelle barre en moins d\'une ms : ' + pas.toFixed(3));
  // Switching period on the same chart reuses the sessions and stays exact.
  egal(cour(g(plein, { sym: 'INC' }), avec({ periode: 'sem' })), reference(parDate(plein, d => d >= '2026-10-12')), 'semaine après le mois');
}

// 9. Previous periods: the `hist` periods before the current one that touch the visible bars, oldest first,
// each exact; a partial previous week or month is left out.
{
  const B = synth(jours('2026-09-28', '2026-10-14')), debDe = d => B.findIndex(b => b._date === d);
  const X = complet(g(B, { premiere: 0 }), avec({ hist: 3 }));
  assert.deepEqual(X.prec.map(R => R.cle), ['2026-10-09', '2026-10-12', '2026-10-13'], 'trois séances précédentes');
  X.prec.forEach(R => { egal(R, reference(parDate(B, d => d === R.cle)), R.cle); assert.deepEqual([R.deb, R.fin], [debDe(R.cle), debDe(R.cle) + 2]); });
  assert.deepEqual(complet(g(B, { premiere: 0 }), defaut).prec, [], 'hist 0 : période en cours seule');
  assert.deepEqual(complet(g(B, { premiere: debDe('2026-10-12') + 1 }), avec({ hist: 3 })).prec.map(R => R.cle), ['2026-10-12', '2026-10-13'], 'hors écran sauté');
  const W = complet(g(B, { premiere: 0 }), avec({ periode: 'sem', hist: 2 })).prec;
  assert.deepEqual(W.map(R => R.cle), ['40', '41'], 'semaines 40 et 41');
  egal(W[0], reference(parDate(B, d => d < '2026-10-05')), 'semaine 40');
  assert.deepEqual(complet(g(B.slice(6), { premiere: 0 }), avec({ periode: 'sem', hist: 2 })).prec.map(R => R.cle), ['41'], 'semaine 40 partielle omise');
}

// 10. Drawing.
const POINTS = { plein: null, tirets: [6, 4], points: [2, 3] };
{
  const B = synth(jours('2026-10-12', '2026-10-14')), G = g(B, { premiere: 0 });
  const dessin = (r, G2 = G, D = E) => { rec.length = 0; D.dessine(G2, r); return { rects: rec.filter(x => x.k === 'rect'), cadres: rec.filter(x => x.k === 'cadre'), traits: rec.filter(x => x.k === 'trait'), textes: rec.filter(x => x.k === 'texte') }; };
  const proche = (a, b) => Math.abs(a - b) < 1e-9;

  // Stacked at the right edge: buyers against the edge, sellers beyond; the fullest row takes 25 %.
  // Outside the value area both fade to `horsVA` of their opacity; the POC row is outlined.
  let r = avec({ rangee: 1, periode: 'sem' }), R = cour(G, r), D = dessin(r);
  const achat = D.rects.filter(x => x.c === r.achatC), vente = D.rects.filter(x => x.c === r.venteC);
  const tickDe = x => Math.round(x.y / 0.25 + 0.5), dansVA = x => tickDe(x) >= R.val && tickDe(x) <= R.vah;
  assert.equal(achat.length, R.ticks.length, 'une rangée par tick');
  assert.ok(achat.every(x => proche(x.x + x.w, 1000)), 'acheteurs contre le bord droit');
  assert.ok(vente.every(x => proche(x.x + x.w, achat.find(y => y.y === x.y).x)), 'vendeurs au bout');
  assert.ok(achat.some(x => !dansVA(x)), 'des rangées hors VA');
  assert.ok(achat.every(x => proche(x.a, dansVA(x) ? r.achatO : r.achatO * r.horsVA)), 'acheteurs atténués hors VA');
  assert.ok(vente.every(x => proche(x.a, dansVA(x) ? r.venteO : r.venteO * r.horsVA)), 'vendeurs atténués hors VA');
  const k0 = R.ticks.indexOf(R.poc), rangeeDe = t => achat.find(x => proche(x.y, (t - 0.5) * 0.25));
  assert.equal(D.cadres.length, 1, 'un seul cadre');
  assert.deepEqual([D.cadres[0].c, D.cadres[0].a, D.cadres[0].l, tickDe(D.cadres[0])], [r.pocC, r.pocO, 1, R.poc], 'rangée du POC cerclée');
  assert.ok(proche(D.cadres[0].x, rangeeDe(R.poc).x - vente.find(y => y.y === rangeeDe(R.poc).y).w) && proche(D.cadres[0].x + D.cadres[0].w, 1000), 'cadre sur toute la rangée');
  assert.ok(dessin(avec({ rangee: 1, periode: 'sem', horsVA: 1 })).rects.every(x => x.a === (x.c === r.achatC ? r.achatO : r.venteO)), 'horsVA 1 : pas d\'atténuation');
  assert.ok(proche(rangeeDe(R.poc).w, 250 * R.ask[k0] / Math.max(...R.ticks.map((t, k) => R.bid[k] + R.ask[k]))), 'largeur des acheteurs');
  assert.ok(proche(Math.max(...achat.map(x => x.w + vente.find(y => y.y === x.y).w)), 250), '25 % de la largeur du cadre');

  // Total mode: POC row, value area and outside each with their colour and opacity.
  r = avec({ rangee: 1, periode: 'sem', mode: 'total' }); D = dessin(r);
  const deTick = t => D.rects.find(x => proche(x.y, (t - 0.5) * 0.25));
  assert.deepEqual([deTick(R.poc).c, deTick(R.poc).a], [r.pocC, r.pocO], 'rangée du POC');
  assert.deepEqual([deTick(R.vah).c, deTick(R.vah).a], [r.couleurVA, r.opacVA], 'rangée dans la VA');
  const hors = R.ticks.find(t => t > R.vah || t < R.val);
  assert.deepEqual([deTick(hors).c, deTick(hors).a], [r.couleur, r.opac], 'rangée hors VA');
  assert.ok(D.rects.every(x => proche(x.x + x.w, 1000)), 'collées au bord droit');
  assert.deepEqual(D.cadres, [], 'pas de cadre en mode total');

  // Lines from the start of the week to the right edge, styles from the settings; prices above them on the left.
  r = avec({ periode: 'sem', vaLT: 'points', vaLO: 0.4, pocLE: 3 }); D = dessin(r);
  assert.equal(D.traits.length, 2);
  assert.deepEqual(D.traits[0].p, [[0, R.poc * 0.25], [1000, R.poc * 0.25], [NaN, NaN]], 'POC');
  assert.deepEqual(D.traits[0].o, { couleur: r.pocLC, epaisseur: 3, pointille: null, opacite: r.pocLO });
  assert.deepEqual(D.traits[1].p.filter(p => !isNaN(p[0])).map(p => p[1] / 0.25), [R.vah, R.vah, R.val, R.val], 'VAH et VAL');
  assert.deepEqual(D.traits[1].o, { couleur: r.vaLC, epaisseur: 1, pointille: POINTS.points, opacite: 0.4 });
  const prix = t => (t * 0.25).toFixed(2);
  assert.deepEqual(D.textes.map(x => [x.s, x.x, x.y, x.o.base]), [['wPOC ' + prix(R.poc), 4, R.poc * 0.25 - 2, 'bottom'], ['wVAH ' + prix(R.vah), 4, R.vah * 0.25 - 2, 'bottom'],
    ['wVAL ' + prix(R.val), 4, R.val * 0.25 - 2, 'bottom'], ['Semaine 42', 996, 12, undefined]], 'prix au-dessus des lignes, à gauche, et légende');
  // Each instance writes its caption on its own line; session names carry the session.
  assert.equal(dessin(r, G, defs[1]).textes.at(-1).y, 25, 'légende de l\'instance B');
  assert.deepEqual(dessin(avec({ periode: 'us' }), g(synth(jours('2026-10-12', '2026-10-14'), 1000))).textes.map(x => x.s.split(' ').slice(0, 2).join(' ')),
    ['POC RTH', 'VAH RTH', 'VAL RTH', 'Séance US'], 'niveaux de la RTH');
  assert.deepEqual(dessin(avec({ periode: 'sem', pocL: false, vaL: false, etiq: false })).traits, [], 'sans lignes');
  assert.deepEqual(dessin(avec({ periode: 'sem', pocL: false, vaL: false, etiq: false })).textes, [], 'ni étiquettes');
  assert.deepEqual(dessin(avec({ periode: 'sem', profil: false })).rects, [], 'sans histogramme');

  // Previous sessions on their own bars: from their first bar facing right, or from their close facing left,
  // the fullest row at 60 % of the span; lines over the span only. The current one on its period too.
  const H = synth(jours('2026-10-12', '2026-10-14')), GH = g(H, { premiere: 0 });
  r = avec({ hist: 2, rangee: 1, place: 'periode' });
  const X = complet(GH, r), spans = X.prec.concat([X.cour]).map(R => [R.deb - 0.5, R.fin + 0.5]);
  D = dessin(r, GH);
  const de = ([a, b], L) => L.filter(x => x.x >= a - 1e-9 && x.x + x.w <= b + 1e-9);
  for (const s of spans) {
    const A = de(s, D.rects.filter(x => x.c === r.achatC)), V = de(s, D.rects.filter(x => x.c === r.venteC));
    assert.ok(A.length && A.every(x => proche(x.x, s[0])), 'adossé à la première barre');
    assert.ok(proche(Math.max(...A.map(x => x.w + V.find(y => y.y === x.y).w)), 0.6 * (s[1] - s[0])), '60 % de la durée');
  }
  assert.deepEqual(D.traits[0].p.filter(p => !isNaN(p[0])).map(p => p[0]), [spans[0][0], spans[0][1], spans[1][0], spans[1][1], spans[2][0], 1000], 'lignes sur leur période, la dernière jusqu\'au bord');
  D = dessin(avec({ hist: 2, rangee: 1, place: 'periode', sens: 'passe' }), GH);
  for (const s of spans) assert.ok(de(s, D.rects.filter(x => x.c === r.achatC)).every(x => proche(x.x + x.w, s[1])), 'adossé à la clôture');
  // Week started before the visible bars: lines and labels start at the left edge.
  D = dessin(avec({ periode: 'sem' }), g(B, { premiere: 5, x: i => i - 5 }));
  assert.ok(D.traits.every(x => x.p[0][0] === 0) && D.textes[0].x === 4, 'bord gauche');

  // Warnings stay without labels: a partial month with one bar lacking levels.
  const P = B.slice(3); P[P.length - 1] = Object.assign({}, P[P.length - 1], { lv: [] });
  assert.deepEqual(dessin(avec({ periode: 'mois', etiq: false }), g(P)).textes.map(x => x.s), ['Mois 2026-10 · partiel, depuis le 2026-10-13 · 17 % des barres sans niveaux'], 'mises en garde');
  // Rows outside the frame are not painted.
  assert.ok(dessin(avec({ periode: 'sem' }), g(B, { cadre: { gauche: 0, droite: 1000, haut: 0, bas: 25.1, largeur: 1000, hauteur: 25.1 } })).rects.every(x => x.y <= 25.1), 'hors cadre sauté');
  // The reason is written instead of a profile.
  D = dessin(defaut, g(B.map(b => Object.assign({}, b, { lv: [] }))));
  assert.equal(rec.length, 1);
  assert.match(D.textes[0].s, /aucune barre/);
}

// 11. Replay going back: sessions past the new end are cut, then the chart grows again; always as from scratch.
{
  const B = synth(jours('2026-09-28', '2026-10-14')), r = avec({ periode: 'sem', hist: 2 }), e = B.findIndex(b => b._date === '2026-10-13') + 1;
  complet(g(B, { sym: 'REP', premiere: 0 }), r);
  for (const n of [e, e - 2, B.length - 2, B.length]) {
    const C = B.slice(0, n), a = complet(g(C, { sym: 'REP', premiere: 0 }), r), b = complet(g(C, { premiere: 0 }), r);
    assert.deepEqual([resume(a.cour), a.prec.map(resume)], [resume(b.cour), b.prec.map(resume)], 'replay jusqu\'à ' + n);
  }
  egal(cour(g(B.slice(0, e), { sym: 'REP' }), r), reference(B.slice(B.findIndex(b => b._date === '2026-10-12'), e)), 'lundi et une barre de mardi');
}

// 12. Same POC, VAH and VAL as TT's own session volume profile (hfq-composite-vp.js and hfq-va.js).
if (fs.existsSync(path.join(PAYLOAD, 'hfq-composite-vp.js'))) {
  const ctx = { console, setTimeout, clearTimeout, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), head: { appendChild() {} }, addEventListener() {}, querySelector: () => null } };
  ctx.window = ctx;
  const C = vm.createContext(ctx);
  for (const f of ['hfq-va.js', 'hfq-composite-vp.js']) vm.runInContext(fs.readFileSync(path.join(PAYLOAD, f), 'utf8'), C);
  const prec = complet(g(bars, { premiere: 0 }), avec({ hist: 9 })).prec.concat([cour(g(), defaut)]);
  db.sessions.forEach((s, k) => {
    const tt = ctx.HFQCompositeVP.buildFromBars(s.bars, { tick: 0.25, vaPct: 0.7 }).profile, R = prec[k];
    assert.deepEqual([R.poc, R.vah, R.val].map(t => t * 0.25), [tt.poc, tt.vah, tt.val], 'comme le SVP de TT, ' + s.date);
  });
} else console.warn('payload de TT introuvable, comparaison avec son profil sautée :', PAYLOAD);

// 13. Budget: a month of one-minute ETH sessions with five levels per bar, the month and every previous
// session drawn by two instances. The first compute spans several frames, each under TT's 8 ms, and
// lands on the brute-force profiles; then cached frames.
{
  const B = jours('2026-09-22', '2026-10-16').flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => {
    const b = Math.round((7000 + 20 * Math.sin(s + m / 200)) * 4) / 4;
    return { _date: date, m, o: b, h: b + 1, l: b, c: b + 0.25, lv: [0, 1, 2, 3, 4].map(k => [b + k * 0.25, 1 + (m % 7), 2 + (k % 3)]) };
  }));
  const G = g(B, { sym: 'MES', premiere: 0, cadre: { gauche: 0, droite: 1000, haut: 0, bas: 600, largeur: 1000, hauteur: 600 }, x: i => i * 1000 / B.length, y: v => 600 - (v - 6970) * 10 });
  const rM = avec({ periode: 'mois', achatC: '#000001', venteC: '#000002' }), rJ = avec({ hist: 30 });
  let images = 0, pire = 0, prets;
  do {
    rec.length = 0;
    for (const [D, r] of [[defs[2], rM], [E, rJ]]) { const t = performance.now(); D.dessine(G, r); pire = Math.max(pire, performance.now() - t); }
    images++;
    prets = new Set(rec.filter(x => x.k === 'rect').map(x => x.c)).size;
  } while (prets < 4 && images < 100);
  assert.ok(images > 1 && pire < 8, 'calcul étalé : ' + images + ' images, pire ' + pire.toFixed(2) + ' ms');
  egal(cour(G, rM, defs[2]), reference(parDate(B, d => d >= '2026-10')), 'octobre, calcul étalé');
  const X = complet(G, rJ);
  assert.equal(X.prec.length, 18, 'dix-huit séances précédentes');
  egal(X.prec[0], reference(parDate(B, d => d === '2026-09-22')), 'première séance');
  const t1 = performance.now(); for (let k = 0; k < 50; k++) { defs[2].dessine(G, rM); E.dessine(G, rJ); } const chaud = (performance.now() - t1) / 100;
  assert.ok(chaud < 2, 'image en cache : ' + chaud.toFixed(3) + ' ms');
  const R = cour(g(), defaut), S = cour(g(), avec({ periode: 'sem' })), U = cour(g(), avec({ periode: 'us' }));
  console.log('OK', bars.length, 'barres ES,', db.sessions.length, 'séances | séance POC', (R.poc * 0.25).toFixed(2), 'VA', (R.val * 0.25).toFixed(2), '-', (R.vah * 0.25).toFixed(2),
    '| RTH POC', (U.poc * 0.25).toFixed(2), '| semaine POC', (S.poc * 0.25).toFixed(2), '|', B.length, 'barres synthétiques,', images, 'images, pire', pire.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
