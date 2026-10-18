// Self-check for extensions/profil_periode.js: session, ISO week and month volume profiles
// on real ES bars baked by Turning Trade and on synthetic sessions, drawing at the right edge.
// Run: node tests/profil_periode_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/profil_periode.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));

const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console, performance }));
assert.equal(defs.length, 1);
const E = defs[0];
assert.equal(E.id, 'profil-periode', 'id stable');
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';

// Same level reader as hfq-ext.js: [price, bid, ask].
const niveaux = b => { const lv = b && b.lv || []; return { n: lv.length, prix: k => lv[k][0], bid: k => lv[k][1] || 0, ask: k => lv[k][2] || 0,
  volume: () => lv.reduce((s, l) => s + (l[1] || 0) + (l[2] || 0), 0) }; };
const rec = [];
const ctx = { set fillStyle(c) { this._c = c; }, set globalAlpha(a) { this._a = a; }, fillRect(x, y, w, h) { rec.push({ k: 'rect', x, y, w, h, c: this._c, a: this._a }); } };
let syms = 0;
// Each call gets its own symbol unless one is given, so caches never leak between checks.
const g = (B = bars, o = {}) => Object.assign({ n: B.length, premiere: B.length - 300, derniere: B.length - 1, tick: 0.25, seance: 'eth', sym: 'T' + syms++, tf: 1, echelle: 1,
  cadre: { gauche: 0, droite: 1000, haut: 0, bas: 1e5, largeur: 1000, hauteur: 1e5 }, barre: i => B[i] || null, niveaux: i => niveaux(B[i]),
  x: i => i, y: v => v, ctx, trait(p, o) { rec.push({ k: 'trait', p, o }); }, texte(x, y, s, o) { rec.push({ k: 'texte', x, y, s, o }); } }, o);

// Reference profile by brute force: {tick index: bid + ask}.
const reference = (bs, rth) => { const h = {}; for (const b of bs) { if (rth && (b.m < 930 || b.m >= 1320)) continue; for (const [p, bi, a] of b.lv || []) h[Math.round(p / 0.25)] = (h[Math.round(p / 0.25)] || 0) + bi + a; } return h; };
const somme = h => Object.values(h).reduce((s, v) => s + v, 0);
const egal = (R, h, msg) => { assert.deepEqual(Object.fromEntries(R.ticks.map(t => [t, R.vol.get(t)])), h, msg); assert.equal(R.total, somme(h), msg + ' : total'); };
// The first compute may span several frames (null until done): call until it lands.
const complet = (G, r) => { for (let k = 0; k < 1000; k++) { const R = E.calcul(G, r); if (R) return R; } throw new Error('calcul jamais fini'); };
const plat = R => Object.assign({}, R, { vol: Object.fromEntries(R.vol) });
const parDate = (B, f) => B.filter(b => f(b._date));

// 1. Value area on a hand-made histogram: POC 10, then the richer neighbour first.
{
  const H = new Map([[8, 5], [9, 20], [10, 40], [11, 25], [12, 10]]), va = part => { const Z = E.outils.zoneValeur(H, part); return [Z.poc, Z.val, Z.vah, Z.total]; };
  assert.deepEqual(va(0.6), [10, 10, 11, 100], '40 + 25 = 65 covers 60');
  assert.deepEqual(va(0.7), [10, 9, 11, 100], '65 < 70, then 9 (20) beats 12 (10): 85');
  assert.deepEqual(va(0.9), [10, 9, 12, 100], '85 < 90, then 12 (10) beats 8 (5): 95');
  // Ties as in TT's hfq-va.js: the lowest maximum is the POC, then the upper side grows first.
  assert.equal(E.outils.zoneValeur(new Map([[1, 5], [3, 5]]), 0.7).poc, 1, 'POC ex aequo : le plus bas');
  const Z = E.outils.zoneValeur(new Map([[9, 10], [10, 40], [11, 10], [12, 1]]), 0.75);
  assert.deepEqual([Z.val, Z.vah], [10, 11], 'voisins ex aequo : le haut d\'abord');
}

// 2. Session profile on real ES bars: the last session, bid + ask per tick; VA holds 70 % and the POC.
{
  const R = complet(g(), defaut), last = db.sessions[db.sessions.length - 1];
  const h = reference(last.bars);
  egal(R, h, 'séance ' + last.date);
  assert.equal(R.deb, bars.length - last.bars.length, 'début de la séance');
  assert.equal(R.vol.get(R.poc), Math.max(...Object.values(h)), 'POC au maximum');
  const dansVA = R.ticks.filter(t => t >= R.val && t <= R.vah).reduce((s, t) => s + R.vol.get(t), 0);
  assert.ok(dansVA >= 0.7 * R.total && R.val <= R.poc && R.poc <= R.vah, 'VA à 70 % autour du POC');
  assert.equal(R.cle, last.date);
  assert.equal(R.partiel, null, 'la séance n\'est jamais dite partielle');
  assert.equal(R.sans, 0, 'toutes les barres ont des niveaux');
  const R80 = complet(g(), avec({ vaPct: 80 }));
  assert.ok(R80.vah - R80.val > R.vah - R.val, 'VA 80 % plus large');
}

// 3. Week and month on real ES: four sessions from Tuesday Oct 13, same ISO week 42 and month, both partial.
{
  const h = reference(bars);
  for (const periode of ['sem', 'mois']) {
    const R = complet(g(), avec({ periode }));
    egal(R, h, periode + ' : les quatre séances');
    assert.equal(R.deb, 0);
    assert.equal(R.partiel, '2026-10-13', periode + ' : chargé depuis un mardi');
  }
  assert.equal(complet(g(), avec({ periode: 'sem' })).cle, '42');
  assert.equal(complet(g(), avec({ periode: 'mois' })).cle, '2026-10');
}

// 4. RTH only on an ETH chart: 09:30-16:00 bars only; ignored on an RTH chart.
{
  const last = db.sessions[db.sessions.length - 1];
  egal(complet(g(), avec({ rth: true })), reference(last.bars, true), 'RTH seul');
  egal(complet(g(bars, { seance: 'rth' }), avec({ rth: true })), reference(last.bars), 'graphe RTH : pas de filtre');
}

// Synthetic weekday sessions of three one-minute bars with three levels each.
const jours = (de, a) => { const out = []; for (let d = new Date(de + 'T00:00:00Z'); d <= new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); return out; };
const synth = dates => dates.flatMap((date, s) => [0, 1, 2].map(k => { const b = 100 + 0.25 * ((s * 7 + k) % 40); return { _date: date, m: k, o: b, h: b + 0.5, l: b, c: b + 0.25, v: 6, lv: [[b, 1, 1], [b + 0.25, s % 3, 2], [b + 0.5, 1, k]] }; }));

// 5. Calendar periods: only the sessions of the current ISO week or month; complete when loaded from the start.
{
  const B = synth(jours('2026-08-31', '2026-10-14'));
  const S = complet(g(B), avec({ periode: 'sem' }));
  egal(S, reference(parDate(B, d => d >= '2026-10-12')), 'semaine 42 : lundi 12 à mercredi 14');
  assert.equal(S.deb, B.findIndex(b => b._date === '2026-10-12'));
  assert.equal(S.partiel, null, 'semaine entière');
  const M = complet(g(B), avec({ periode: 'mois' }));
  egal(M, reference(parDate(B, d => d >= '2026-10')), 'octobre');
  assert.equal(M.partiel, null, 'mois chargé depuis le 1er');
  assert.equal(complet(g(B.filter(b => b._date >= '2026-10-02')), avec({ periode: 'mois' })).partiel, '2026-10-02', 'octobre chargé depuis le 2 : partiel');
  assert.equal(complet(g(B.filter(b => b._date >= '2026-10-12')), avec({ periode: 'sem' })).partiel, null, 'semaine chargée depuis son lundi');
  egal(complet(g(B), defaut), reference(parDate(B, d => d === '2026-10-14')), 'séance du 14');
}

// 6. Bars without levels are counted, not invented; none at all gives a reason. No dates: session only.
{
  const B = synth(jours('2026-10-12', '2026-10-14'));
  B[B.length - 1] = Object.assign({}, B[B.length - 1], { lv: [] });
  const R = complet(g(B), defaut);
  assert.deepEqual([R.sans, R.nb], [1, 3], 'une barre sur trois sans niveaux');
  egal(R, reference(B.slice(-3)), 'barre sans niveaux ignorée');
  assert.match(complet(g(B.map(b => Object.assign({}, b, { lv: [] }))), defaut).raison, /aucune barre/);
  const sans = B.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  egal(complet(g(sans), defaut), reference(B.slice(-3)), 'séance retrouvée sans date');
  assert.match(complet(g(sans), avec({ periode: 'sem' })).raison, /sans date/);
  const trou = B.slice(); trou[trou.length - 2] = Object.assign({}, trou[trou.length - 2], { _trou: true });
  assert.equal(complet(g(trou), defaut).nb, 2, 'barre de comblement ignorée');
}

// 7. Incremental: the last bar grows, then a new session opens; same profile as from scratch.
{
  const B = synth(jours('2026-09-28', '2026-10-14')), e = B.length - 4;
  const plein = B.slice(0, e + 2); plein[e] = Object.assign({}, B[e], { lv: B[e].lv.concat([[90, 50, 50]]) });
  const r = avec({ periode: 'mois' });
  complet(g(B.slice(0, e + 1), { sym: 'INC' }), r);
  const t0 = performance.now(), R = E.calcul(g(plein, { sym: 'INC' }), r), pas = performance.now() - t0;
  assert.equal(R.vol.get(360), 100, 'barre grossie reprise');
  assert.deepEqual(plat(R), plat(complet(g(plein), r)), 'incrémental = calcul complet');
  assert.ok(pas < 1, 'nouvelle barre en moins d\'une ms : ' + pas.toFixed(3));
  // Switching period on the same chart reuses the sessions and stays exact.
  egal(complet(g(plein, { sym: 'INC' }), avec({ periode: 'sem' })), reference(parDate(plein, d => d >= '2026-10-12')), 'semaine après le mois');
}

// 8. Drawing: rows end at the right edge, the fullest takes the chosen width, POC and VA colours, levels and caption.
{
  const B = synth(jours('2026-10-12', '2026-10-14')), r = avec({ rangee: 1, periode: 'sem' }), G = g(B, { premiere: 0 });
  rec.length = 0; E.dessine(G, r);
  const R = complet(G, r), rects = rec.filter(x => x.k === 'rect');
  assert.equal(rects.length, R.ticks.length, 'une rangée par tick');
  assert.ok(rects.every(x => Math.abs(x.x + x.w - 1000) < 1e-9 && x.a === r.opac), 'collées au bord droit, opacité du réglage');
  assert.equal(Math.max(...rects.map(x => x.w)), 250, '25 % de la largeur du cadre');
  const deTick = t => rects.find(x => Math.abs(x.y - (t - 0.5) * 0.25) < 1e-9);
  assert.equal(deTick(R.poc).c, r.pocC, 'rangée du POC');
  assert.equal(deTick(R.vah).c, r.couleurVA, 'rangée dans la VA');
  const hors = R.ticks.find(t => t > R.vah || t < R.val);
  assert.equal(deTick(hors).c, r.couleur, 'rangée hors VA');
  const T = rec.filter(x => x.k === 'trait');
  assert.deepEqual(T.map(x => x.p[0][1] / 0.25), [R.poc, R.vah, R.val], 'POC, VAH, VAL');
  assert.ok(T.every(x => x.p[0][0] === 0 && x.p[1][0] === 1000), 'du début de la semaine au bord droit');
  const textes = rec.filter(x => x.k === 'texte').map(x => x.s);
  assert.deepEqual(textes, ['POC', 'VAH', 'VAL', 'Semaine 42'], 'étiquettes et légende');

  rec.length = 0; E.dessine(G, avec({ rangee: 2, periode: 'sem' }));
  const deux = rec.filter(x => x.k === 'rect');
  assert.equal(deux.length, new Set(R.ticks.map(t => Math.floor(t / 2))).size, 'rangées de deux ticks');
  assert.equal(deux.reduce((s, x) => s + x.w, 0) > 0, true);
  // Auto rows: 0.25 px per tick here, so 12 ticks per row for 3 px.
  rec.length = 0; E.dessine(G, avec({ periode: 'sem' }));
  assert.equal(rec.filter(x => x.k === 'rect').length, new Set(R.ticks.map(t => Math.floor(t / 12))).size, 'auto : 3 px mini');
  rec.length = 0; E.dessine(G, avec({ periode: 'sem', niveaux: false, etiq: false }));
  assert.deepEqual(rec.filter(x => x.k !== 'rect'), [], 'sans niveaux ni étiquettes');
  // Warnings stay without labels: a partial month with one bar lacking levels.
  const P = B.slice(3); P[P.length - 1] = Object.assign({}, P[P.length - 1], { lv: [] });
  rec.length = 0; E.dessine(g(P), avec({ periode: 'mois', etiq: false }));
  assert.deepEqual(rec.filter(x => x.k === 'texte').map(x => x.s), ['Mois 2026-10 · partiel, depuis le 2026-10-13 · 17 % des barres sans niveaux'], 'mises en garde');
  // Week started before the visible bars: levels start at the left edge.
  rec.length = 0; E.dessine(g(B, { premiere: 5 }), r);
  assert.ok(rec.filter(x => x.k === 'trait').every(x => x.p[0][0] === 0), 'bord gauche');
  rec.length = 0; E.dessine(g(B, { premiere: 3 }), avec({ rangee: 1 }));
  assert.ok(rec.filter(x => x.k === 'trait').every(x => x.p[0][0] === 6), 'séance : depuis sa première barre');
  // Rows outside the frame are not painted.
  rec.length = 0; E.dessine(g(B, { cadre: { gauche: 0, droite: 1000, haut: 0, bas: 25.1, largeur: 1000, hauteur: 25.1 } }), r);
  assert.ok(rec.filter(x => x.k === 'rect').every(x => x.y <= 25.1), 'hors cadre sauté');
  // The reason is written instead of a profile.
  rec.length = 0; E.dessine(g(B.map(b => Object.assign({}, b, { lv: [] }))), defaut);
  assert.equal(rec.length, 1);
  assert.match(rec[0].s, /aucune barre/);
}

// 9. Replay going back: sessions past the new end are cut, then the chart grows again; always as from scratch.
{
  const B = synth(jours('2026-09-28', '2026-10-14')), r = avec({ periode: 'sem' }), e = B.findIndex(b => b._date === '2026-10-13') + 1;
  complet(g(B, { sym: 'REP' }), r);
  for (const n of [e, e - 2, B.length - 2, B.length]) {
    const C = B.slice(0, n);
    assert.deepEqual(plat(complet(g(C, { sym: 'REP' }), r)), plat(complet(g(C), r)), 'replay jusqu\'à ' + n);
  }
  egal(complet(g(B.slice(0, e), { sym: 'REP' }), r), reference(B.slice(B.findIndex(b => b._date === '2026-10-12'), e)), 'lundi et une barre de mardi');
}

// 10. Same POC, VAH and VAL as TT's own session volume profile (hfq-composite-vp.js and hfq-va.js).
if (fs.existsSync(path.join(PAYLOAD, 'hfq-composite-vp.js'))) {
  const ctx = { console, setTimeout, clearTimeout, addEventListener() {}, localStorage: { getItem: () => null, setItem() {} },
    document: { createElement: () => ({ style: {}, appendChild() {}, setAttribute() {} }), head: { appendChild() {} }, addEventListener() {}, querySelector: () => null } };
  ctx.window = ctx;
  const C = vm.createContext(ctx);
  for (const f of ['hfq-va.js', 'hfq-composite-vp.js']) vm.runInContext(fs.readFileSync(path.join(PAYLOAD, f), 'utf8'), C);
  for (const s of db.sessions) {
    const tt = ctx.HFQCompositeVP.buildFromBars(s.bars, { tick: 0.25, vaPct: 0.7 }).profile;
    const R = complet(g(bars.filter(b => b._date <= s.date)), defaut);
    assert.deepEqual([R.poc, R.vah, R.val].map(t => t * 0.25), [tt.poc, tt.vah, tt.val], 'comme le SVP de TT, ' + s.date);
  }
} else console.warn('payload de TT introuvable, comparaison avec son profil sautée :', PAYLOAD);

// 11. Budget: a month of one-minute ETH sessions with five levels per bar. The first compute spans
// several frames, each under TT's 8 ms, and lands on the brute-force profile; then cached frames.
{
  const B = jours('2026-09-22', '2026-10-16').flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => {
    const b = Math.round((7000 + 20 * Math.sin(s + m / 200)) * 4) / 4;
    return { _date: date, m, o: b, h: b + 1, l: b, c: b + 0.25, lv: [0, 1, 2, 3, 4].map(k => [b + k * 0.25, 1 + (m % 7), 2 + (k % 3)]) };
  }));
  const G = g(B, { sym: 'MES', cadre: { gauche: 0, droite: 1000, haut: 0, bas: 600, largeur: 1000, hauteur: 600 }, y: v => 600 - (v - 6970) * 10 });
  const r = avec({ periode: 'mois' });
  let images = 0, pire = 0;
  do { rec.length = 0; const t = performance.now(); E.dessine(G, r); pire = Math.max(pire, performance.now() - t); images++; } while (!rec.length && images < 50);
  assert.ok(images > 1 && pire < 8, 'calcul étalé : ' + images + ' images, pire ' + pire.toFixed(2) + ' ms');
  egal(complet(G, r), reference(parDate(B, d => d >= '2026-10')), 'octobre, calcul étalé');
  const t1 = performance.now(); for (let k = 0; k < 50; k++) E.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(chaud < 1, 'image en cache : ' + chaud.toFixed(3) + ' ms');
  const R = complet(g(), defaut), S = complet(g(), avec({ periode: 'sem' }));
  console.log('OK', bars.length, 'barres ES,', db.sessions.length, 'séances | séance POC', (R.poc * 0.25).toFixed(2), 'VA', (R.val * 0.25).toFixed(2), '-', (R.vah * 0.25).toFixed(2),
    '| semaine POC', (S.poc * 0.25).toFixed(2), '|', B.length, 'barres synthétiques,', images, 'images, pire', pire.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
