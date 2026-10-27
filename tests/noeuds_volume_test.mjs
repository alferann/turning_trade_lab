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
// The fake chart holds the archive sessions loaded from their first hour to 16:00 ET: the study hides
// the profile of a session the chart does not load entirely, and the archive grows live (a session
// joined late, cut, or still in Asia), so only the missing-data checks of section 9 build such sessions.
const pleines = db.sessions.filter(s => s.bars[0].m <= 60 && s.bars.some(b => b.m >= 1320));
const bars = [];
for (const s of pleines) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
// Session profile of the fake bundle: the chart's last session.
const last = pleines[pleines.length - 1];

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

// 4. Real ES profiles built by TT, whole ETH session and RTH only; a recording cut before 09:30 or a session
// still in Asia has no RTH profile.
const reels = [];
for (const s of db.sessions) for (const [nom, B] of [['ETH', s.bars], ['RTH', s.bars.filter(b => b.m >= 930 && b.m < 1320)]]) {
  if (!B.length) continue;
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
  // Bars inserted before the last one read (tick history filling in): the composite is rebuilt, at most
  // once a minute since each rebuild freezes the chart for 0.6 s; a mere new bar does not count.
  const insere = () => { B.splice(B.length - 100, 0, Object.assign({}, B[B.length - 101])); image(); image(); return appels.filter(a => a[0] === 'rolling').length; };
  horloge += 1000; appels.length = 0;
  assert.equal(insere(), 0, 'insertion moins d\'une minute après le composite : gardé');
  horloge += 60000; appels.length = 0;
  assert.equal(insere(), 1, 'insertion une minute après : composite relu');
  horloge += 30000; appels.length = 0;
  assert.equal(insere(), 0, 'nouvelle insertion trente secondes après : gardé');
  horloge += 30000; appels.length = 0; image(); image();
  assert.equal(appels.filter(a => a[0] === 'rolling').length, 1, 'la minute écoulée, l\'insertion en attente est relue');
  horloge += 60000; appels.length = 0; B.push(Object.assign({}, B[B.length - 1])); image(); image();
  assert.equal(appels.filter(a => a[0] === 'rolling').length, 0, 'nouvelle barre en fin : composite gardé');
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
  // A label for each node type the profile holds, none for the others (the session drawn has no ledge on some days).
  for (const [t, re] of [['hvn', /^HVN$/], ['lvn', /^LVN$/], ['ledge', /^Ledge (haut|bas)$/]])
    assert.equal(T.some(x => re.test(x.s)), N[t].length > 0, 'étiquettes ' + t + ' : ' + T.map(x => x.s).join(', '));
  const ys = T.map(x => x.y).sort((a, b) => a - b);
  assert.ok(ys.every((y, i) => !i || y - ys[i - 1] >= 11), 'étiquettes espacées');
  assert.ok(T.every(x => x.x === 996 && x.st.align === 'right'), 'au bord droit');

  rec.length = 0; E.dessine(g(), avec({ hvn: false, lvn: false, shelf: false }));
  assert.ok(rec.filter(x => x.k === 'zone').length === 0 && rec.filter(x => x.k === 'ligne').length === N.ledge.length, 'ledges seuls');
  rec.length = 0; E.dessine(g(), avec({ opac: 0, etiq: false }));
  assert.equal(rec.filter(x => x.k === 'zone' || x.k === 'texte').length, 0, 'sans remplissage ni étiquettes');
  // Two scopes: each label names its profile. The visible window shows the chart's second
  // session, whose nodes sit at other prices than the last session's; on the same prices one label is kept.
  panes([pane('session'), pane('visible')]);
  const d14 = pleines[0].bars.length;
  vue = [d14, d14 + pleines[1].bars.length];
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

// 9. Missing data: a profile the chart does not load entirely is hidden, with its reason, and its
// bundle is not analysed: session joined late, cut, or a TT filler block; composite holding fewer
// sessions than asked, or one of the chart's sessions partly loaded. Synthetic one-minute sessions.
{
  const seance = (date, m0 = 0, m1 = 1379) => Array.from({ length: m1 - m0 + 1 }, (_, k) => ({ _date: date, m: m0 + k, o: 5000, h: 5001, l: 4999, c: 5000, v: 1, lv: [[5000, 1, 1]] }));
  const comble = date => Array.from({ length: 8 }, () => ({ _trou: true, _date: date, m: 0, o: 5000, h: 5000, l: 5000, c: 5000, lv: [] }));
  const sansDate = B => B.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  // Bundle with known nodes (two HVN, one LVN); a composite says how many sessions it found.
  const P = profil(gauss(100, [[30, 100, 5], [70, 60, 5]]));
  let jours = { days: 90, daysAsked: 90, dateFrom: '2026-10-13' };
  ctx.caVppBundle = (scope, opt) => { appels.push([scope, opt && opt.days]); return Object.assign({ profile: P }, scope === 'rolling' ? jours : {}); };
  // A symbol per chart, so that each one is computed afresh.
  let nc = 0;
  const graphe = (B, o = {}) => Object.assign(g({ B }), { sym: 'MQ' + nc++ }, o);
  const etat = (B, r, o) => JSON.parse(JSON.stringify(E.calcul(graphe(B, o), r).profils.map(p => [p.nom, p.noeuds ? p.noeuds.hvn.length : p.raison + (p.detail ? ' (' + p.detail + ')' : '')])));
  const SVP = avec({ source: 'session' }), CMP = avec({ source: 'rolling' });
  const PARTIELLE = 'Nœuds VP : séance chargée en partie', COMPOSITE = 'Nœuds VP : composite chargé en partie';
  const trois = (a, b, c) => seance('2026-10-13', ...a).concat(seance('2026-10-14', ...b), seance('2026-10-15', ...c));

  // Session: the last one joined at 03:21 ET (m 561) is hidden, and TT's builder is not even called.
  appels.length = 0;
  assert.deepEqual(etat(trois([], [], [561, 900]), SVP), [['SVP', PARTIELLE]], 'séance prise en cours');
  assert.deepEqual(appels, [], 'profil non demandé à TT');
  assert.deepEqual(etat(trois([], [], [0, 900]), SVP), [['SVP', 2]], 'séance en cours prise à l\'ouverture : nœuds');
  // Scrolled back onto a closed session: it must reach 4 h before its end (13:00 ET); Oct 22 stopped at 07:37 ET.
  const coupee = trois([], [0, 817], []), sur14 = { premiere: 1380, derniere: 1380 + 400 };
  assert.deepEqual(etat(coupee, SVP, sur14), [['SVP', PARTIELLE]], 'séance close tronquée');
  assert.deepEqual(etat(trois([], [0, 1200], []), SVP, sur14), [['SVP', 2]], 'clôture anticipée à 14:00 : nœuds');
  // The last bar on screen on TT's filler block for a missing day.
  const trou = seance('2026-10-13').concat(comble('2026-10-14'), seance('2026-10-15'));
  assert.deepEqual(etat(trou, SVP, { premiere: 1380, derniere: 1385 }), [['SVP', PARTIELLE]], 'bloc de comblement');
  // Replay: TT marks the bar in progress _trou while it has nothing for it yet; the session stays whole.
  const rejeu = trois([], [], [0, 900]).concat([{ _trou: true, _enCours: true, _date: '2026-10-15', m: 901, o: 5000, h: 5000, l: 5000, c: 5000, lv: [] }]);
  assert.deepEqual([etat(rejeu, SVP), etat(rejeu, CMP)], [[['SVP', 2]], [['CMP 90', 2]]], 'rejeu : barre en cours marquée _trou');
  // Footprint: whole history passed (premiere 0, derniere n - 1), bars without _date; the session is the one
  // of the last bar inside the 1000 px frame, found on g.x.
  const fp = sansDate(coupee), cadre = i0 => ({ premiere: 0, derniere: fp.length - 1, x: i => i - i0 });
  assert.deepEqual(etat(fp, SVP, cadre(400)), [['SVP', PARTIELLE]], 'footprint : séance tronquée à l\'écran');
  assert.deepEqual(etat(fp, SVP, cadre(fp.length - 1000)), [['SVP', 2]], 'footprint : dernière séance à l\'écran');

  // Composite: TT found 20 sessions for 90 asked.
  const ouverte = trois([], [], [0, 900]);
  jours = { days: 20, daysAsked: 90, dateFrom: '2026-10-13' };
  assert.deepEqual(etat(ouverte, CMP), [['CMP 90', COMPOSITE + ' (20/90)']], 'composite court');
  jours = { days: 90, daysAsked: 90, dateFrom: '2026-10-13' };
  assert.deepEqual(etat(ouverte, CMP), [['CMP 90', 2]], 'composite complet');
  // One of the chart's sessions inside the composite is cut; the same session before its first date does not count.
  assert.deepEqual(etat(coupee, CMP), [['CMP 90', COMPOSITE + ' (2026-10-14)']], 'séance tronquée dans le composite');
  jours = { days: 90, daysAsked: 90, dateFrom: '2026-10-15' };
  assert.deepEqual(etat(coupee, CMP), [['CMP 90', 2]], 'séance tronquée avant le composite');
  jours = { days: 90, daysAsked: 90, dateFrom: '2026-10-13' };
  assert.deepEqual(etat(trois([], [], [561, 900]), CMP), [['CMP 90', COMPOSITE + ' (2026-10-15)']], 'séance en cours prise en cours');
  // A day TT fills with a blank is not one of the chart's sessions: the composite takes its days elsewhere.
  assert.deepEqual(etat(trou, CMP), [['CMP 90', 2]], 'bloc de comblement hors du composite');
  // Footprint: past days come from TT's daily archive, only the session in progress is checked.
  assert.deepEqual(etat(fp, CMP), [['CMP 90', 2]], 'footprint : séance passée tronquée ignorée');
  assert.deepEqual(etat(sansDate(trois([], [], [561, 900])), CMP), [['CMP 90', COMPOSITE]], 'footprint : séance en cours prise en cours');

  // Both panels, scrolled back onto the cut session, before the composite's first date: the composite's
  // nodes are drawn, the session's reason is written instead of its nodes.
  panes([pane('session'), pane('rolling')]);
  jours = { days: 90, daysAsked: 90, dateFrom: '2026-10-15' };
  const vu = Object.assign({ y: p => (5030 - p) * 10 }, sur14), N = E.outils.detecter(P, defaut);
  rec.length = 0; E.dessine(graphe(coupee, vu), defaut);
  const T = rec.filter(x => x.k === 'texte');
  assert.deepEqual(T.filter(x => x.x === 8).map(x => x.s), [PARTIELLE + ' · SVP'], 'raison du SVP en haut à gauche');
  assert.ok(T.some(x => x.s === 'HVN · CMP 90') && T.every(x => x.x === 8 || / · CMP 90$/.test(x.s)), 'nœuds du composite seuls');
  assert.equal(rec.filter(x => x.k === 'zone').length, N.hvn.length + N.lvn.length + N.shelf.length, 'zones du composite seules');
  // Cost of the check on a tick-sized chart (20 sessions of 10 000 bars), only paid when a profile is rebuilt.
  const gros = [];
  for (let s = 0; s < 20; s++) for (let k = 0; k < 10000; k++) gros.push({ _date: '2026-10-' + String(1 + s).padStart(2, '0'), m: k * 0.1379 });
  const G = { n: gros.length, premiere: gros.length - 2000, derniere: gros.length - 1, seance: 'eth', cadre: { droite: 1e9 }, barre: i => gros[i], x: i => i };
  const cout = scope => { let t = Infinity; for (let k = 0; k < 5; k++) { const t0 = performance.now(); E.outils.manque(G, scope, jours); t = Math.min(t, performance.now() - t0); } return t; };
  jours = { days: 90, daysAsked: 90, dateFrom: '2026-01-01' };
  const cS = cout('session'), cR = cout('rolling');
  assert.ok(cS < 2 && cR < 8, 'vérification : séance ' + cS.toFixed(2) + ' ms, composite ' + cR.toFixed(2) + ' ms');
  console.log('OK données manquantes : séance prise en cours, tronquée, comblée, composite court ou troué, footprint | vérification sur',
    gros.length, 'barres : séance', cS.toFixed(2), 'ms, composite', cR.toFixed(2), 'ms');
}
