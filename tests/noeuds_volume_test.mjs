// Self-check for extensions/noeuds_volume.js: node detection on synthetic profiles with known
// answers, then on real ES session profiles built by Turning Trade's own profile builder
// (hfq-composite-vp.js, the one behind the chart's volume profile panels), panel reading,
// caching, drawing and frame budget.
// Run: node tests/noeuds_volume_test.mjs   (from the repo root; TT_DATA overrides the data
// folder, TT_PAYLOAD the payload folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/noeuds_volume.js'), 'utf8');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const last = db.sessions[db.sessions.length - 1];

// One context holds TT's contract and profile builder, the study, and a fake chart window.
let horloge = 0;
const ctx = { console, Date: { now: () => horloge } };
ctx.window = ctx;
const defs = [];
ctx.HFQExt = { etude(d) { defs.push(d); return true; } };
const vc = vm.createContext(ctx);
for (const f of ['hfq-contract.js', 'hfq-composite-vp.js']) vm.runInContext(fs.readFileSync(path.join(PAYLOAD, f), 'utf8'), vc);
vm.runInContext(SRC, vc);
const VP = ctx.HFQCompositeVP;
assert.equal(defs.length, 1);
const E = defs[0];
assert.equal(E.id, 'noeuds-volume', 'id stable');
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);
// Results cross the vm boundary as plain data, so deepEqual compares values only.
const det = (P, o) => JSON.parse(JSON.stringify(E.outils.detecter(P, avec(o))));
const noms = R => Array.from(R.profils, p => p.nom);

// Profile in TT's shape from a volume per row; null rows are left out, as TT does.
const profil = (vols, tick = 0.25, base = 5000) => {
  const prices = [], v = [];
  vols.forEach((x, i) => { if (x != null) { prices.push(base + i * tick); v.push(x); } });
  return { prices, vols: v, tick };
};
const gauss = (n, pics) => Array.from({ length: n }, (_, i) => 2 + pics.reduce((a, [c, h, w]) => a + h * Math.exp(-((i - c) ** 2) / (2 * w * w)), 0));
const ligne = (p, tick = 0.25, base = 5000) => Math.round((p - base) / tick);
const dans = (z, p) => p > z.bas && p < z.haut;

// 1. Two distributions: an HVN on each peak, one LVN between, nothing in the tails.
{
  const N = det(profil(gauss(100, [[30, 100, 5], [70, 60, 5]])));
  assert.deepEqual(N.hvn.map(z => ligne(z.prix)), [30, 70], 'HVN sur les deux sommets');
  assert.equal(N.lvn.length, 1, 'un seul LVN');
  assert.ok(Math.abs(ligne(N.lvn[0].prix) - 50) <= 3, 'LVN entre les deux : ' + ligne(N.lvn[0].prix));
  assert.ok(N.hvn.every(h => !dans(h, N.lvn[0].prix)) && N.hvn.every(h => !dans(N.lvn[0], h.prix)), 'zones HVN et LVN disjointes');
  assert.ok(N.hvn.every(z => z.bas < z.prix && z.haut > z.prix), 'zone autour du sommet');
  // Secondary peak prominence is about 60 % of the POC: a 70 % threshold drops it.
  assert.deepEqual(det(profil(gauss(100, [[30, 100, 5], [70, 60, 5]])), { hvnProm: 70 }).hvn.map(z => ligne(z.prix)), [30], 'proéminence 70 %');
  // The trough sits around 4 against walls of 60: walls at 20× still pass, 40× no longer.
  assert.equal(det(profil(gauss(100, [[30, 100, 5], [70, 60, 5]])), { lvnMur: 20 }).lvn.length, 1, 'murs 20×');
  assert.equal(det(profil(gauss(100, [[30, 100, 5], [70, 60, 5]])), { lvnMur: 40 }).lvn.length, 0, 'murs 40×');
  // A smooth single bell: one HVN, no LVN, no ledge, no shelf.
  const B = det(profil(gauss(100, [[50, 100, 12]])));
  assert.deepEqual([B.hvn.length, B.lvn.length, B.ledge.length, B.shelf.length], [1, 0, 0, 0], 'cloche lisse');
}

// 2. A flat block between thin tails: a ledge at each edge, one shelf over the block.
{
  const v = Array.from({ length: 70 }, (_, i) => i >= 20 && i < 50 ? 100 + (i % 3) * 3 : 10);
  const N = det(profil(v));
  assert.deepEqual(N.ledge.map(z => [z.prix, z.dessous]), [[5000 + 19.5 * 0.25, false], [5000 + 49.5 * 0.25, true]], 'ledges aux deux bords, côté épais');
  assert.equal(N.shelf.length, 1, 'un palier, trouvé depuis les deux ledges et fondu');
  assert.deepEqual([N.shelf[0].bas, N.shelf[0].haut], [5000 + 19.5 * 0.25, 5000 + 49.5 * 0.25], 'shelf de bord à bord');
  assert.equal(N.lvn.length, 0, 'pas de creux entre deux murs');
  // Thick side at 1.8× the thin side: below the default ratio of 2.
  assert.equal(det(profil(v.map(x => x === 10 ? 57 : x))).ledge.length, 0, 'rapport 1,8 : pas de ledge');
  // A plateau shorter than the minimum height is no shelf; the ledges stay.
  const C = det(profil(v), { shelfMin: 40 });
  assert.deepEqual([C.ledge.length, C.shelf.length], [2, 0], 'palier trop court');
  // A linear ramp has no ledge.
  assert.equal(det(profil(Array.from({ length: 80 }, (_, i) => 5 + 2 * i))).ledge.length, 0, 'rampe sans ledge');
}

// 3. Rows without volume are missing from TT's profile: they count as zero, so a gap is an LVN.
{
  const v = gauss(80, [[20, 100, 6], [60, 90, 6]]).map((x, i) => i >= 37 && i <= 43 ? null : x);
  const N = det(profil(v));
  assert.equal(N.lvn.length, 1, 'un LVN');
  assert.ok(ligne(N.lvn[0].prix) >= 37 && ligne(N.lvn[0].prix) <= 43, 'LVN dans le trou');
  assert.ok(N.hvn.every(z => ligne(z.prix) === 20 || ligne(z.prix) === 60), 'HVN inchangés');
}

// 4. Real ES profiles built by TT, whole ETH session and RTH only.
const reels = [];
for (const s of db.sessions) for (const [nom, B] of [['ETH', s.bars], ['RTH', s.bars.filter(b => b.m >= 930 && b.m < 1320)]]) {
  const P = VP.buildFromBars(B, { tick: 0.25, mode: 'session' }).profile, N = det(P), cle = s.date + ' ' + nom;
  const lo = P.prices[0] - P.tick, hi = P.prices[P.prices.length - 1] + P.tick;
  for (const t of ['hvn', 'lvn', 'shelf', 'ledge']) for (const z of N[t]) assert.ok(z.prix >= lo && z.prix <= hi, cle + ' : ' + t + ' dans le profil');
  assert.ok(N.hvn.length >= 1, cle + ' : au moins un HVN');
  assert.ok(N.hvn.some(z => z.bas <= P.poc && z.haut >= P.poc), cle + ' : le POC tombe dans un HVN');
  for (const l of N.lvn) for (const h of N.hvn) assert.ok(!dans(h, l.prix) && !dans(l, h.prix), cle + ' : LVN ' + l.prix + ' et HVN ' + h.prix + ' disjoints');
  // Nodes are local: each LVN zone is thinner, per row, than the nearest HVN zone on each side.
  const densite = z => { let a = 0; P.prices.forEach((p, i) => { if (p > z.bas && p < z.haut) a += P.vols[i]; }); return a / Math.round((z.haut - z.bas) / P.tick); };
  for (const l of N.lvn) {
    const voisins = [N.hvn.filter(h => h.prix < l.prix).pop(), N.hvn.find(h => h.prix > l.prix)].filter(Boolean);
    for (const h of voisins) assert.ok(densite(l) < densite(h), cle + ' : LVN ' + l.prix + ' moins dense que le HVN voisin ' + h.prix);
  }
  // Each shelf starts at a ledge and lies on its thick side.
  for (const z of N.shelf) assert.ok(N.ledge.some(d => (d.dessous && Math.abs(d.prix - z.haut) < 1e-9) || (!d.dessous && Math.abs(d.prix - z.bas) < 1e-9)), cle + ' : shelf adossé à un ledge');
  reels.push({ cle, rangees: P.prices.length, pas: P.tick, n: ['hvn', 'lvn', 'ledge', 'shelf'].map(t => N[t].length) });
}
assert.ok(reels.some(x => x.pas > 0.25), 'TT regroupe les rangées sur les grandes séances');
assert.ok(reels.every(x => x.n[0] <= 10 && x.n[1] <= 8), 'pas de pluie de nœuds : ' + reels.map(x => x.n.join('/')).join(' '));

// Fake chart: TT's panel API and the chart's bundle function, fed from the archive.
const rec = [], appels = [];
const g = (o = {}) => {
  const B = o.B || bars, n = B.length;
  return { n, premiere: o.premiere ?? n - 300, derniere: n - 1, tick: 0.25, seance: 'eth', sym: 'ES', tf: 1, echelle: 1,
    cadre: { gauche: 0, droite: 1000, haut: 0, bas: 3000 }, barre: i => B[i] || null, niveaux: i => ({ n: (B[i] && B[i].lv || []).length }),
    x: i => i, y: p => (7900 - p) * 10,
    zone(bas, haut, st) { rec.push({ k: 'zone', bas, haut, st }); }, ligne(p, st) { rec.push({ k: 'ligne', p, st }); },
    texte(x, y, s, st) { rec.push({ k: 'texte', x, y, s, st }); }, trait() {}, etiquette() {} };
};
// Bars on screen for the visible scope, [from, to): the last 300 unless a check moves them.
let vue = [bars.length - 300, bars.length];
const bundle = (scope, opt) => {
  appels.push([scope, opt && opt.days]);
  if (scope === 'rolling') return VP.buildRollingFromSessions(db.sessions, { tick: 0.25, days: opt.days });
  const B = scope === 'visible' ? bars.slice(vue[0], vue[1]) : last.bars;
  return VP.buildFromBars(B, { tick: 0.25, mode: scope });
};
const panes = L => { ctx.HFQVPPanels = { _dev: { panes: () => L } }; };
const pane = (scope, o = {}) => Object.assign({ id: 'vp' + scope, scope, on: true, days: 90, st: { vaPct: 0.7 } }, o);
const sierra = [pane('session', { title: 'Delta' }), pane('session', { title: 'Volume' }), pane('rolling', { on: false, days: 40 })];

// 5. Where the profile comes from.
{
  // No bundle function on the chart: a message, nothing else.
  panes(sierra);
  rec.length = 0; E.dessine(g(), defaut);
  assert.deepEqual(rec.map(x => x.k), ['texte'], 'message seul');
  assert.equal(rec[0].s, 'Nœuds VP : profil de volume indisponible sur ce graphe');

  ctx.caVppBundle = bundle;
  // TT's default layout opens two session panes: a single profile, a single bundle call.
  appels.length = 0;
  let R = E.calcul(g(), defaut);
  assert.deepEqual(appels, [['session', 90]], 'deux panneaux séance, un appel');
  assert.deepEqual(noms(R), ['SVP']);
  // A chosen scope works even when its pane is closed, with that pane's session count.
  appels.length = 0; E.calcul(g(), avec({ source: 'rolling' }));
  assert.deepEqual(appels, [['rolling', 40]], 'composite du panneau fermé, 40 séances');
  appels.length = 0; R = E.calcul(g(), avec({ source: 'visible' }));
  assert.deepEqual(appels, [['visible', 90]], 'fenêtre visible sans panneau');
  assert.ok(R.profils[0].noeuds.hvn.length, 'nœuds sur la fenêtre visible');
  // Panels closed and the source left on open panels: a message.
  panes(sierra.map(p => Object.assign({}, p, { on: false })));
  assert.equal(E.calcul(g(), defaut).raison, 'Nœuds VP : aucun panneau de profil ouvert');
  // Older TT without the full pane list: the public layout is enough.
  ctx.HFQVPPanels = { layout: () => ({ panes: [pane('visible')] }) };
  assert.deepEqual(noms(E.calcul(g(), defaut)), ['CVP'], 'disposition publique');
  // Footprint charts name their bundle function differently.
  delete ctx.caVppBundle; ctx.fpVppBundle = bundle; panes(sierra);
  appels.length = 0; E.calcul(g({ B: bars.slice(0, -1) }), defaut);
  assert.deepEqual(appels, [['session', 90]], 'fpVppBundle sur le footprint');
  delete ctx.fpVppBundle; ctx.caVppBundle = bundle;
}

// 6. Cache: the profile is rebuilt on a new bar, on a live tick at most every 300 ms, and the
// composite once per chart session; a detection setting reruns the detection alone. A frame
// that rebuilt a profile is always followed by a cached one, since TT suspends a study that
// stays over 8 ms three frames in a row.
{
  panes([pane('session'), pane('rolling', { days: 40 })]);
  const B = bars.slice(), image = (o = defaut) => E.calcul(g({ B }), o);
  horloge = 10000; image(); image(); image();
  appels.length = 0; image();
  assert.equal(appels.length, 0, 'image suivante sans appel');
  B[B.length - 1] = Object.assign({}, B[B.length - 1], { c: B[B.length - 1].c + 0.25, v: B[B.length - 1].v + 1 });
  horloge += 100; image();
  assert.equal(appels.length, 0, 'tick à 100 ms : profil gardé');
  horloge += 250; image();
  assert.deepEqual(appels, [['session', 90]], 'tick à 350 ms : séance recalculée, composite gardé');
  appels.length = 0; B.push(Object.assign({}, B[B.length - 1])); image();
  assert.equal(appels.length, 0, 'nouvelle barre juste après une image froide : cache');
  image();
  assert.deepEqual(appels, [['session', 90]], 'image suivante : séance recalculée, composite gardé');
  // The next weekday after the archive's last session opens a new one.
  const apres = new Date(B[B.length - 1]._date + 'T00:00:00Z');
  do apres.setUTCDate(apres.getUTCDate() + 1); while (!(apres.getUTCDay() % 6));
  appels.length = 0; B.push(Object.assign({}, B[B.length - 1], { _date: apres.toISOString().slice(0, 10), m: 0 })); image(); image();
  assert.deepEqual(appels.map(a => a[0]).sort(), ['rolling', 'session'], 'nouvelle séance : tout recalculé');
  appels.length = 0;
  const a = image().profils[0].noeuds.hvn.length, b = image(avec({ hvnProm: 60 })).profils[0].noeuds.hvn.length;
  assert.equal(appels.length, 0, 'réglage de détection sans appel');
  assert.ok(b < a, 'proéminence 60 % : moins de HVN (' + a + ' → ' + b + ')');
  // Another instrument is rebuilt at once, even right after a cold frame.
  image(); appels.length = 0; E.calcul(Object.assign(g({ B }), { sym: 'NQ' }), defaut);
  assert.equal(appels.length, 2, 'changement d\'instrument : recalcul immédiat');
}

// 7. Drawing.
{
  panes([pane('session')]);
  const N = E.calcul(g(), defaut).profils[0].noeuds;
  rec.length = 0; E.dessine(g(), defaut);
  const Z = rec.filter(x => x.k === 'zone'), L = rec.filter(x => x.k === 'ligne'), T = rec.filter(x => x.k === 'texte');
  assert.equal(Z.length, N.hvn.length + N.lvn.length + N.shelf.length, 'une zone par HVN, LVN et shelf');
  assert.equal(L.length, N.hvn.length + N.lvn.length + N.ledge.length, 'un trait par HVN, LVN et ledge');
  for (const t of ['hvn', 'lvn', 'shelf', 'ledge']) assert.equal(rec.filter(x => x.st && x.st.couleur === defaut[t + 'C']).length > 0, N[t].length > 0, 'couleur ' + t);
  assert.ok(L.filter(x => x.st.epaisseur === 1.5).length === N.ledge.length, 'ledges en trait épais');
  assert.ok(L.filter(x => x.st.pointille).length === N.lvn.length, 'LVN en tirets');
  assert.ok(T.some(x => x.s === 'HVN') && T.some(x => x.s === 'LVN') && T.some(x => /^Ledge (haut|bas)$/.test(x.s)), 'étiquettes : ' + T.map(x => x.s).join(', '));
  const ys = T.map(x => x.y).sort((a, b) => a - b);
  assert.ok(ys.every((y, i) => !i || y - ys[i - 1] >= 11), 'étiquettes espacées');
  assert.ok(T.every(x => x.x === 996 && x.st.align === 'right'), 'au bord droit');

  rec.length = 0; E.dessine(g(), avec({ hvn: false, lvn: false, shelf: false }));
  assert.ok(rec.filter(x => x.k === 'zone').length === 0 && rec.filter(x => x.k === 'ligne').length === N.ledge.length, 'ledges seuls');
  rec.length = 0; E.dessine(g(), avec({ opac: 0, etiq: false }));
  assert.equal(rec.filter(x => x.k === 'zone' || x.k === 'texte').length, 0, 'sans remplissage ni étiquettes');
  // Two scopes: each label names its profile. The visible window shows Oct 14, whose nodes
  // sit at other prices than the last session's; on the same prices one label is kept.
  panes([pane('session'), pane('visible')]);
  const d14 = db.sessions[0].bars.length;
  vue = [d14, d14 + db.sessions[1].bars.length];
  rec.length = 0; E.dessine(g({ premiere: d14 }), defaut);
  vue = [bars.length - 300, bars.length];
  const S = rec.filter(x => x.k === 'texte').map(x => x.s);
  assert.ok(S.some(s => s.endsWith(' · SVP')) && S.some(s => s.endsWith(' · CVP')), 'suffixes SVP et CVP');
  // Nothing drawn outside the visible price range.
  panes([pane('session')]);
  rec.length = 0; E.dessine(Object.assign(g(), { y: p => (p - 9000) * 10 }), defaut);
  assert.equal(rec.length, 0, 'hors écran : rien');

  // Settings panel: one sub-section per node type, opened by a checkbox, colour last.
  assert.deepEqual(Array.from(E.reglages.filter(x => x.type === 'check'), x => x.k), ['etiq', 'hvn', 'lvn', 'ledge', 'shelf']);
  for (const t of ['hvn', 'lvn', 'ledge', 'shelf']) {
    const i = E.reglages.findIndex(x => x.k === t), j = E.reglages.findIndex(x => x.k === t + 'C');
    assert.ok(j > i && E.reglages.slice(i + 1, j).every(x => x.type === 'number'), 'sous-section ' + t);
  }
}

// 8. Budget: cold frame (TT builds the session profile, then detection) and cached frames.
{
  panes([pane('session')]);
  // Cold: best of three new bars, each after a cached frame; the cost is mostly TT's builder.
  const B = bars.slice(), G = () => g({ B });
  let froid = Infinity;
  for (let k = 0; k < 3; k++) {
    E.dessine(G(), defaut); B.push(Object.assign({}, B[B.length - 1]));
    const t0 = performance.now(); E.dessine(G(), defaut); froid = Math.min(froid, performance.now() - t0);
  }
  assert.equal(E.calcul(G(), defaut).profils.length, 1);
  const t1 = performance.now(); for (let k = 0; k < 50; k++) E.dessine(G(), defaut); const chaud = (performance.now() - t1) / 50;
  const P = VP.buildFromBars(last.bars, { tick: 0.25, mode: 'session' }).profile;
  const t2 = performance.now(); for (let k = 0; k < 20; k++) E.outils.detecter(P, avec({ lissage: k % 4 })); const detection = (performance.now() - t2) / 20;
  assert.ok(froid < 8 && chaud < 1 && detection < 2, 'budget 8 ms, mesuré froid ' + froid.toFixed(2) + ' chaud ' + chaud.toFixed(3) + ' détection ' + detection.toFixed(3));
  console.log('OK', bars.length, 'barres ES,', reels.length, 'profils réels |',
    reels.map(x => x.cle.slice(5) + ' ' + x.rangees + 'r×' + x.pas + ' ' + x.n.join('/')).join(', '),
    '(HVN/LVN/ledge/shelf) | froid', froid.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms, détection', detection.toFixed(3), 'ms');
}
