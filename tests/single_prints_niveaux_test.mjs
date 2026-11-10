// Self-check for extensions/single_prints_niveaux.js: single print zones read from the TPO profiles
// baked by Turning Trade, their 0/25/50/75/100% levels and the bar that takes each one.
// Zones are cross-checked against TT's own mpSinglesRuns (marketprofile_pro.html), levels
// against a brute-force search on the real ES bars baked by TT.
// Run: node tests/single_prints_niveaux_test.mjs   (from the repo root; TT_DATA and TT_PAYLOAD override the folders)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/single_prints_niveaux.js'), 'utf8');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const FUTUR = 'Fri, 01 Jan 2100 00:00:00 GMT';

// A fresh copy of the study: fake hub files (`env.fichiers`, `env.lm` their Last-Modified),
// a clock the test moves by hand (`env.t`, ms), notifications kept in `env.notifs`.
function charge(o = {}) {
  const env = { fichiers: {}, lm: {}, t: 0, notifs: [], lus: 0 }, defs = [];
  const ctx = { console, Intl, Date, JSON, Math,
    HFQExt: { etude(d) { defs.push(d); return true; } },
    HFQSymGuard: { histFile: (p, s) => p + '_' + String(s).replace(/[FGHJKMNQUVXZ]\d$/, '') + '.json' },
    performance: o.horloge ? performance : { now: () => env.t },
    fetch: url => { env.lus++; return url in env.fichiers
      ? Promise.resolve({ headers: { get: () => env.lm[url] || FUTUR }, json: () => Promise.resolve(JSON.parse(JSON.stringify(env.fichiers[url]))) })
      : Promise.reject(new Error('404')); },
    Notification: Object.assign(function (titre, opt) { env.notifs.push(titre + ' | ' + opt.body); }, { permission: 'granted' }) };
  if (o.feries) ctx.HFQSessions = { feriesUS: () => o.feries };
  // TT's memo of tick-chart holes per past day: {date: [[m0, m1], ...]}, answered asynchronously.
  if (o.trous) ctx.HFQLiveSeed = { ticksJour: ({ day }) => Promise.resolve({ ok: true, complet: !o.trous[day], trous: o.trous[day] || [] }) };
  vm.runInContext(SRC, vm.createContext(ctx));
  assert.equal(defs.length, 1);
  env.E = defs[0];
  env.ctx = ctx;
  return env;
}
const pause = () => new Promise(r => setImmediate(r));
const copie = x => JSON.parse(JSON.stringify(x));

// Fake chart: `col` px per bar from bar `gauche`, 40 px per point, frame of 1000 px.
function graphe(B, o = {}) {
  const col = o.col || 1, g0 = o.gauche || 0, traits = [], textes = [];
  return Object.assign({ n: B.length, sym: 'ESZ6', tf: 1, seance: 'eth', tick: 0.25, echelle: 1, premiere: 0, derniere: B.length - 1,
    cadre: { gauche: 0, droite: 1000, haut: -1e9, bas: 1e9 },
    barre: i => B[i], x: i => (i - g0) * col, y: v => -v * 40,
    trait(p, opt) { traits.push({ p: Array.from(p, q => [...q]), opt: copie(opt) }); },
    texte(x, y, t, opt) { textes.push({ x, y, t, opt: copie(opt) }); }, traits, textes }, o);
}
// One calculation once the hub file has arrived.
async function calcul(env, g, r) { env.E.calcul(g, r); await pause(); return env.E.calcul(g, r); }
// Segments of the single stroke: point pairs separated by a non-finite point.
const segments = g => { const t = g.traits.at(-1), s = []; for (let k = 0; k < t.p.length; k += 3) s.push([t.p[k][0], t.p[k + 1][0], -t.p[k][1] / 40]); return s; };

const E0 = charge().E;
assert.equal(E0.id, 'single-prints-niveaux', 'id stable');
assert.deepEqual([...E0.graphes], ['profil', 'bougies', 'footprint']);
const defaut = Object.fromEntries(E0.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

// 1. Same zones as TT's Market Profile on every baked day, RTH and full session, ES and NQ.
{
  const html = fs.existsSync(path.join(PAYLOAD, 'marketprofile_pro.html')) ? fs.readFileSync(path.join(PAYLOAD, 'marketprofile_pro.html'), 'utf8') : '';
  const a = html.indexOf('function mpSinglesRuns('), b = html.indexOf('function drawSinglesExt(');
  if (a < 0 || b < a) console.warn('mpSinglesRuns introuvable dans le payload, recoupement avec TT sauté');
  else {
    const tt = vm.runInNewContext('const _mpSinglesCache = new WeakMap, TICK = 0.25;' + html.slice(a, b) + ';mpSinglesRuns');
    let jours = 0, zones = 0;
    for (const f of ['_mp_daily_ES.json', '_mp_daily_eth_ES.json', '_mp_daily_NQ.json', '_mp_daily_eth_NQ.json']) {
      if (!fs.existsSync(path.join(PAYLOAD, f))) continue;
      for (const J of JSON.parse(fs.readFileSync(path.join(PAYLOAD, f), 'utf8')).days) {
        const ref = copie(tt(J)), vu = copie(E0.outils.suites(J, 0.25));
        assert.deepEqual(vu, ref, f + ' ' + J.date);
        jours++; zones += ref.length;
      }
    }
    console.log('OK zones de TT |', zones, 'zones sur', jours, 'jours cuits');
  }
}

// Synthetic sessions: minute bars of an ETH chart, flat at 104 unless `f(m)` says otherwise.
const seance = (date, f = () => null, fin = 1380, debut = 0) => Array.from({ length: fin - debut }, (_, k) => {
  const m = debut + k, x = f(m) || [103.75, 104.25];
  return Object.assign({ m, o: 104, l: x[0], h: x[1], c: 104, lv: [], _date: date }, x[2]);
});
// A baked day: rows 5 ticks apart. Single letters from 106.25 to 108.75, between fuller rows.
const jour = (date, close = 104) => ({ date, close, hi: 110, lo: 103.75,
  rows: [[110, 'AB', 2], [108.75, 'C', 1], [107.5, 'C', 1], [106.25, 'C', 1], [105, 'ABD', 3], [103.75, 'AD', 2]] });
const idx = (B, date, m) => B.findIndex(b => b._date === date && b.m === m);
const L1 = '2026-11-02', M2 = '2026-11-03', M3 = '2026-11-04', J4 = '2026-11-05';
const mp = (...J) => ({ symbol: 'ES', tpo_tick: 1.25, days: J });
const print = m => m === 1000 ? [104, 110] : null;

// 2. Levels from the entry edge, each line from the bar that left the print to the first wick.
{
  const env = charge();
  env.fichiers['_mp_daily_ES.json'] = mp(jour(L1), jour(M2));
  const B = [...seance(L1, print), ...seance(M2, m => m === 100 ? [104, 106] : m === 700 ? [104, 107.5] : null), ...seance(M3, () => null, 600)];
  const g = graphe(B, { col: 0.25 });
  const S = await calcul(env, g, defaut);
  assert.equal(S.pret, true);
  assert.equal(S.Z.length, 2, 'une zone par séance close');
  const Z = S.Z[0];
  assert.deepEqual([Z.date, Z.bas, Z.haut, Z.ticks, Z.dessus], [L1, 105.75, 109.25, 15, false], 'bornes au tick, clôture sous la zone');
  const d1 = idx(B, L1, 1000);
  assert.deepEqual(copie(Z.N).map(v => [v.q, v.p, v.deb, v.fin]),
    [[0, 105.75, d1, idx(B, M2, 100)], [25, 106.75, d1, idx(B, M2, 700)], [50, 107.5, d1, idx(B, M2, 700)], [75, 108.5, d1, -1], [100, 109.25, d1, -1]]);
  // The second session has the same zone; nothing touches it: its lines start at its last bar before 16:00.
  assert.deepEqual(copie(S.Z[1].N).map(v => [v.deb, v.fin]), Array(5).fill([idx(B, M2, 1319), -1]));
  // Drawing: taken lines stop at their bar, the others run to the right edge.
  env.E.dessine(g, defaut);
  assert.equal(g.traits.length, 1, 'un seul tracé');
  const x = i => i * 0.25;
  assert.deepEqual(segments(g).slice(0, 5), [[x(d1), x(idx(B, M2, 100)), 105.75], [x(d1), x(idx(B, M2, 700)), 106.75],
    [x(d1), x(idx(B, M2, 700)), 107.5], [x(d1), 1000, 108.5], [x(d1), 1000, 109.25]]);
  assert.deepEqual(g.textes.slice(0, 5).map(t => t.t), ['SP 0 %  105.75', 'SP 25 %  106.75', 'SP 50 %  107.50', 'SP 75 %  108.50', 'SP 100 %  109.25']);
  assert.deepEqual([g.traits[0].opt.couleur, g.traits[0].opt.pointille], [defaut.couleur, null]);
  // Hide taken levels, switch levels off, raise the minimum height, drop labels.
  let h = graphe(B, { col: 0.25 });
  env.E.dessine(h, avec({ masquePris: true, n100: false, etiq: false }));
  assert.deepEqual(segments(h).map(s => s[2]), [108.5, 105.75, 106.75, 107.5, 108.5], 'niveaux pris masqués, 100 % éteint');
  assert.equal(h.textes.length, 0);
  h = graphe(B, { col: 0.25 });
  env.E.dessine(h, avec({ mini: 16 }));
  assert.equal(segments(h).length, 0, 'zone de 15 ticks sous la hauteur minimale');
  // Labels closer than 11 px keep the first one only (4 px per point here).
  h = graphe(B, { col: 0.25, y: v => -v * 4 });
  env.E.dessine(h, defaut);
  assert.deepEqual(h.textes.slice(0, 2).map(t => t.t), ['SP 0 %  105.75', 'SP 75 %  108.50'], '25, 50 et 100 % trop près du précédent');
  // A close above the zone: price comes back from above, 0 % is the upper edge.
  const haut = charge();
  haut.fichiers['_mp_daily_ES.json'] = mp(jour(L1, 109.5));
  const R = await calcul(haut, graphe([...seance(L1, print), ...seance(M2)]), defaut);
  assert.deepEqual(copie(R.Z[0].N).map(v => [v.q, v.p]), [[0, 109.25], [25, 108.25], [50, 107.5], [75, 106.5], [100, 105.75]]);
  console.log('OK niveaux | 0 % au bord d\'entrée, prise à la première mèche');
}

// 3. Only sessions loaded to their end, and closed: none for a chart that starts after the
//    close, a session cut before its end or the session in progress. Full session on an RTH chart: masked.
{
  for (const [nom, B] of [['graphe ouvert après 16:00', [...seance(L1, print, 1380, 1330), ...seance(M2)]],
    ['séance coupée à 14:00', [...seance(L1, print, 1200), ...seance(M2)]], ['séance en cours', seance(L1, print, 1300)]]) {
    const env = charge();
    env.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
    const S = await calcul(env, graphe(B), defaut);
    assert.equal(S.pret && S.Z.length, 0, nom);
  }
  const env = charge();
  env.fichiers['_mp_daily_eth_ES.json'] = mp(jour(L1));
  const B = [...seance(L1, print), ...seance(M2, m => m === 5 ? [104, 106] : null)];
  let S = await calcul(env, graphe(B), avec({ profil: 'eth' }));
  assert.deepEqual(copie(S.Z[0].N).map(v => v.fin), [idx(B, M2, 5), -1, -1, -1, -1], 'séance complète : close à la séance suivante');
  const g = graphe(B, { seance: 'rth' });
  S = await calcul(env, g, avec({ profil: 'eth' }));
  assert.equal(S.pret, false);
  env.E.dessine(g, avec({ profil: 'eth' }));
  assert.match(g.textes[0].t, /graphe ETH/, 'raison en légende');
  assert.equal(g.traits.length, 0);
  // RTH chart (minutes from 09:30, 390 per session): the session closes with the next one.
  const rth = charge();
  rth.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
  const C = [...seance(L1, m => m === 70 ? [104, 110] : null, 390), ...seance(M2, m => m === 3 ? [104, 106] : null, 390)];
  S = await calcul(rth, graphe(C, { seance: 'rth' }), defaut);
  assert.deepEqual(copie(S.Z[0].N).map(v => [v.deb, v.fin]), [[70, 393], [70, -1], [70, -1], [70, -1], [70, -1]], 'graphe RTH');
  // Shortened CME session: closed at 13:00 ET (minute 1140), still loaded to its end.
  const court = charge({ feries: [{ date: L1, type: 'reduit' }] });
  court.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
  S = await calcul(court, graphe([...seance(L1, print, 1140), ...seance(M2)]), defaut);
  assert.equal(S.Z.length, 1, 'séance écourtée');
  console.log('OK séances | chargées jusqu\'à leur fin et closes seulement');
}

// 4. Missing data: a level still untouched when the chart has a hole is masked, one taken before stays.
{
  const cas = async (B, feries) => {
    const env = charge({ feries });
    env.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
    const g = graphe(B, { col: 0.25 }), S = await calcul(env, g, defaut);
    env.E.dessine(g, defaut);
    return { N: copie(S.Z[0].N), segs: segments(g) };
  };
  const prise = m => m === 100 ? [104, 106] : null;
  let R = await cas([...seance(L1, print), ...seance(M2, m => m === 200 ? [103.75, 104.25, { _trou: true }] : prise(m)), ...seance(M3)]);
  assert.deepEqual(R.N.map(v => [v.fin >= 0, v.masque]), [[true, false], [false, true], [false, true], [false, true], [false, true]]);
  assert.deepEqual(R.segs.map(s => s[2]), [105.75], 'seul le niveau pris avant le trou est tracé');
  // A business day without a session between two sessions.
  R = await cas([...seance(L1, print), ...seance(M3, prise)]);
  assert.equal(R.segs.length, 0, 'jour ouvré manquant');
  // The same gap over a full CME closure is not a hole.
  R = await cas([...seance(L1, print), ...seance(M3, prise)], [{ date: M2, type: 'ferme' }]);
  assert.deepEqual(R.N.map(v => v.masque), Array(5).fill(false), 'fermeture complète du CME');
  assert.equal(R.segs.length, 5);
  // Minute chart: more than ten minutes without a bar, a session started late, a session cut short.
  const M = seance(M2, prise);
  R = await cas([...seance(L1, print), ...M.filter(b => b.m < 40 || b.m > 55), ...seance(M3, () => null, 600)]);
  assert.equal(R.segs.length, 0, 'seize minutes sans barre');
  R = await cas([...seance(L1, print), ...M.filter(b => b.m < 40 || b.m > 45), ...seance(M3, () => null, 600)]);
  assert.equal(R.segs.length, 5, 'six minutes sans barre : pas un trou');
  R = await cas([...seance(L1, print), ...M.filter(b => b.m >= 30)]);
  assert.equal(R.segs.length, 0, 'séance entamée en retard');
  R = await cas([...seance(L1, print), ...M.filter(b => b.m < 1350), ...seance(M3, () => null, 600)]);
  assert.deepEqual(R.N.map(v => [v.fin >= 0, v.masque]), [[true, false], [false, true], [false, true], [false, true], [false, true]], 'séance coupée avant sa fin');
  // Tick chart: the gap between two bars is a bar's length, holes come from TT's own record.
  const ticks = async trous => {
    const env = charge({ trous });
    env.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
    const B = [...seance(L1, print), ...M.filter(b => b.m % 90 === 0 || b.m === 100), ...seance(M3, () => null, 600)];
    const g = graphe(B, { tf: '12000t' });
    env.E.calcul(g, defaut); await pause(); env.E.calcul(g, defaut); await pause();
    return copie(env.E.calcul(g, defaut).Z[0].N).map(v => [v.fin >= 0, v.masque]);
  };
  assert.deepEqual(await ticks({}), [[true, false], [false, false], [false, false], [false, false], [false, false]], 'barres de 90 min, aucun trou');
  assert.deepEqual(await ticks({ [M2]: [[400, 430]] }), [[true, false], [false, true], [false, true], [false, true], [false, true]], 'trou connu de TT après la prise');
  assert.deepEqual(await ticks({ [M2]: [[20, 60]] }), Array(5).fill([false, true]), 'trou connu de TT avant la prise');
  console.log('OK données manquantes | niveaux vierges masqués devant un trou');
}

// 5. A session just closed waits for TT to bake its profile after the close; a day TT never
//    baked is skipped without waiting.
{
  const env = charge(), f = '_mp_daily_ES.json', r = defaut;
  env.fichiers[f] = mp(jour(L1), jour(M2));
  const fin = env.E.outils.finMs(M2, 'rth');
  assert.equal(new Date(fin).toISOString(), M2 + 'T21:00:00.000Z', '16:00 ET en heure d\'hiver');
  assert.equal(new Date(env.E.outils.finMs('2026-10-27', 'eth')).toISOString(), '2026-10-27T21:00:00.000Z', '17:00 ET en heure d\'été');
  env.lm[f] = new Date(fin - 5 * 60000).toUTCString();   // baked five minutes before the close
  const B = [...seance(L1, print), ...seance(M2, print), ...seance(M3, () => null, 10)];
  const g = graphe(B);
  let S = await calcul(env, g, r);
  assert.deepEqual([S.Z.length, S.attente], [1, M2], 'la séance du jour attend, la précédente est tracée');
  env.E.dessine(g, r);
  assert.match(g.textes[0].t, /en attente pour la séance du 03\/11/);
  // No second read within a minute; then the fresh file brings the zone.
  const lus = env.lus;
  env.t += 30000; await calcul(env, g, r);
  assert.equal(env.lus, lus, 'pas de relecture avant une minute');
  env.lm[f] = new Date(fin + 3 * 60000).toUTCString();
  env.t += 31000; await calcul(env, g, r);
  S = await calcul(env, g, r);
  assert.deepEqual([S.Z.length, S.attente, S.raison], [2, '', '']);
  // A past day missing from the file: nothing for it, nothing waited for.
  const trou = charge();
  trou.fichiers[f] = mp(jour(M2));
  S = await calcul(trou, graphe(B), r);
  assert.deepEqual([S.Z.length, S.Z[0].date, S.attente], [1, M2, '']);
  // No file at all: a reason, no line.
  const sans = charge(), h = graphe(B);
  await calcul(sans, h, r);
  sans.E.dessine(h, r);
  assert.match(h.textes[0].t, /introuvables/);
  console.log('OK fichier de TT | profil attendu après la clôture, relu au plus une fois par minute');
}

// 6. Incremental reading equals a fresh one: bar by bar, then with a session inserted in the middle.
{
  const f = '_mp_daily_ES.json', J = mp(jour(L1), jour(M2), jour(M3));
  const prises = m => m === 100 ? [104, 106] : m === 900 ? [104, 108] : null;
  const B = [...seance(L1, print), ...seance(M2, m => print(m) || (m === 50 ? [104, 106.75] : null)), ...seance(M3, m => print(m) || prises(m)), ...seance(J4, prises, 400)];
  const neuf = async C => { const env = charge(); env.fichiers[f] = J; return copie((await calcul(env, graphe(C), defaut)).Z); };
  const env = charge();
  env.fichiers[f] = J;
  await calcul(env, graphe(B.slice(0, 1500)), defaut);
  for (let n = 1500; n <= B.length; n += n < B.length - 5 ? 37 : 1) env.E.calcul(graphe(B.slice(0, n)), defaut);
  assert.deepEqual(copie(env.E.calcul(graphe(B), defaut).Z), await neuf(B), 'barre après barre');
  // History without its second session (a missing business day), then whole.
  const sans = B.filter(b => b._date !== M2);
  assert.deepEqual(copie(env.E.calcul(graphe(sans), defaut).Z), await neuf(sans), 'séance du milieu absente');
  assert.deepEqual(copie(env.E.calcul(graphe(B), defaut).Z), await neuf(B), 'séance du milieu revenue');
  console.log('OK incrémental | égal à un calcul neuf');
}

// 7. Notification: one per bar for the levels it takes, history and switched-off levels silent.
{
  const env = charge(), r = avec({ alerte: true, n25: false });
  env.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
  const B = [...seance(L1, print), ...seance(M2, m => m === 100 ? [104, 106] : m === 300 ? [104, 107.6] : null)];
  let g = graphe(B.slice(0, 1380 + 200));
  await calcul(env, g, r);
  env.E.dessine(g, r);
  assert.equal(env.notifs.length, 0, 'l\'historique ne sonne pas');
  for (let n = 1380 + 200; n <= 1380 + 302; n++) { g = graphe(B.slice(0, n)); env.E.dessine(g, r); }
  assert.deepEqual(env.notifs, ['ESZ6 · Single prints | Niveau pris : 50 % 107.50'], 'une notification, sans le niveau éteint');
  const muet = charge();
  muet.fichiers['_mp_daily_ES.json'] = mp(jour(L1));
  await calcul(muet, graphe(B.slice(0, 1380 + 200)), defaut);
  for (let n = 1380 + 200; n <= 1380 + 302; n++) muet.E.dessine(graphe(B.slice(0, n)), defaut);
  assert.equal(muet.notifs.length, 0, 'case décochée');
}

// 8. Real ES: TT's baked RTH profiles on TT's baked minute bars, against a brute-force search.
//    Then the footprint: dates in `_sd`, premiere 0, derniere n - 1, frame of 1000 px, frame budget.
{
  const db = JSON.parse(fs.readFileSync(DB, 'utf8')), nom = '_mp_daily_ES.json';
  const MP = JSON.parse(fs.readFileSync(path.join(PAYLOAD, nom), 'utf8'));
  const B = db.sessions.flatMap(s => s.bars.map(b => Object.assign({}, b, { _date: s.date })));
  const env = charge();
  env.fichiers[nom] = MP;
  const g = graphe(B, { tick: db.tick || 0.25 }), S = await calcul(env, g, defaut);
  assert.equal(S.pret, true);
  // Brute force: sessions whose last bar before 16:00 ET starts after 15:00, levels rebuilt from the rows.
  const tick = g.tick, jours = Object.fromEntries(MP.days.map(J => [J.date, J]));
  let niveaux = 0, pris = 0, masques = 0, zones = 0;
  const Z = copie(S.Z);
  // Holes of the archive, which grows live: a session cut short or started late, eleven minutes without a bar.
  const trous = [];
  for (let i = 1; i < B.length; i++) {
    const a = B[i - 1], b = B[i];
    if (a._date !== b._date ? b.m > 11 || a.m < 1380 - 11 : b.m - a.m > 11) trous.push(i);
  }
  db.sessions.forEach((s, k) => {
    const J = jours[s.date], avant = s.bars.filter(b => b.m < 1320), der = avant.at(-1);
    const fin = B.findIndex(b => b._date > s.date || (b._date === s.date && b.m >= 1320));
    const vues = Z.filter(z => z.date === s.date);
    if (!J || !der || der.m < 1260 || fin < 0) { assert.equal(vues.length, 0, 'séance non tracée ' + s.date); return; }
    const ref = E0.outils.suites(J, tick);
    assert.equal(vues.length, ref.length, 'zones du ' + s.date);
    ref.forEach((z, q) => {
      const bas = z.lo - (z.pas / tick - 1) / 2 * tick, haut = z.hi + (z.pas / tick - 1) / 2 * tick, dessus = J.close >= (bas + haut) / 2;
      assert.deepEqual([vues[q].bas, vues[q].haut], [bas, haut], 'bornes ' + s.date);
      zones++;
      vues[q].N.forEach(v => {
        const prof = Math.round(v.q / 100 * (haut - bas) / tick) * tick, p = dessus ? haut - prof : bas + prof;
        assert.equal(v.p, p, 'prix ' + s.date + ' ' + v.q + ' %');
        let i = fin;
        while (i < B.length && !(B[i].l <= p && p <= B[i].h)) i++;
        // Taken before the first hole that follows the close, or masked there.
        const trou = trous.find(t => t >= fin && t <= i);
        assert.deepEqual([v.fin, v.masque], trou === undefined ? [i < B.length ? i : -1, false] : [-1, true], 'prise ' + s.date + ' ' + v.q + ' % à ' + p);
        if (v.masque) masques++;
        assert.ok(B[v.deb]._date === s.date && B[v.deb].m >= 930 && B[v.deb].m < 1320 && B[v.deb].l <= p && p <= B[v.deb].h, 'barre du print ' + s.date);
        niveaux++; if (v.fin >= 0) pris++;
      });
    });
  });
  assert.ok(zones > 0, 'des zones sur l\'archive');
  console.log('OK ES réel |', zones, 'zones,', niveaux, 'niveaux dont', pris, 'pris et', masques, 'masqués par un trou, sur', db.sessions.length, 'séances,', trous.length, 'trous');

  // Footprint: same result with `_sd`, and only what the frame shows is drawn.
  const FP = B.map(b => { const c = Object.assign({}, b, { _sd: b._date }); delete c._date; return c; });
  const fp = charge({ horloge: true });
  fp.fichiers[nom] = MP;
  const vue = () => graphe(FP, { tick, col: 2, gauche: FP.length - 400 });
  fp.E.calcul(vue(), defaut); await pause();
  let R = fp.E.calcul(vue(), defaut), images = 1;
  while (!R.pret && images++ < 200) R = fp.E.calcul(vue(), defaut);
  assert.ok(R.pret && images > 1, 'premier passage étalé sur ' + images + ' images');
  assert.deepEqual(copie(R.Z), Z, 'footprint égal aux bougies');
  const h = vue();
  fp.E.dessine(h, defaut);
  const debut = FP.length - 400;
  for (const [x0, x1] of segments(h)) assert.ok(x0 >= 0 && x1 <= 1000 && x0 <= x1, 'tracé dans le cadre');
  const attendus = Z.flatMap(z => z.ticks < defaut.mini ? [] : z.N.filter(v => !v.masque && (v.fin < 0 || v.fin >= debut))).length;
  assert.equal(segments(h).length, attendus, 'niveaux encore en vie à l\'écran');
  // Never three frames in a row above 8 ms once caught up.
  const t = Array.from({ length: 12 }, () => { const g2 = vue(), t0 = performance.now(); fp.E.dessine(g2, defaut); return performance.now() - t0; });
  assert.ok(!t.some((x, k) => k >= 2 && x > 8 && t[k - 1] > 8 && t[k - 2] > 8), 'budget : ' + t.map(x => x.toFixed(1)).join(', ') + ' ms');
  console.log('OK footprint |', FP.length, 'barres lues en', images, 'images, image courante', Math.min(...t).toFixed(2), 'ms');
}

// 9. Market Profile: no bars. Zones from the profiles the page shows (its globals D, layoutCache,
//    MODE, aggDay), a level taken by the first later profile whose range brackets it.
{
  const profil = (o = {}) => { const traits = [], textes = [];
    return Object.assign({ graphe: 'profil', n: 0, sym: 'ESZ6', seance: 'rth', tick: 0.25, echelle: 1, cadre: { gauche: 0, droite: 1000, haut: -1e9, bas: 1e9 }, y: v => -v * 40,
      trait(p, opt) { traits.push({ p: Array.from(p, q => [...q]), opt: copie(opt) }); }, texte(x, y, t, opt) { textes.push({ x, y, t }); }, traits, textes }, o); };
  const page = (D, o = {}) => { const env = charge();
    Object.assign(env.ctx, { D, MODE: o.mode || 'daily', layoutCache: o.layout || D.map((_, i) => ({ x0: 100 + i * 50, w: 50, i })), aggDay: o.aggDay });
    return env; };
  const plat = (date, lo, hi) => ({ date, close: lo, hi, lo, rows: [[hi, 'AB', 2], [lo, 'AB', 2]] });
  const FUTUR_J = '2099-01-06';   // a session that has not closed yet

  // Real baked RTH days of ES against a brute-force search over the day ranges.
  const D = JSON.parse(fs.readFileSync(path.join(PAYLOAD, '_mp_daily_ES.json'), 'utf8')).days;
  const env = page(D, { layout: D.map((_, i) => ({ x0: 1000 - (D.length - i) * 30, w: 30, i })) });
  const g = profil(), M = env.E.outils.calculProfil(g);
  const clos = j => j < D.length - 1 || Date.now() >= env.E.outils.finMs(D[j].date, 'rth') + 120000;
  let zones = 0, pris = 0, vierges = 0;
  const Z = copie(M.Z), attendues = [];
  D.forEach((J, j) => { if (clos(j)) for (const z of E0.outils.suites(J, 0.25)) attendues.push([j, z]); });
  assert.equal(Z.length, attendues.length, 'zones des profils clos');
  attendues.forEach(([j, z], k) => {
    const bas = z.lo - (z.pas / 0.25 - 1) / 2 * 0.25, haut = z.hi + (z.pas / 0.25 - 1) / 2 * 0.25, dessus = D[j].close >= (bas + haut) / 2;
    assert.deepEqual([Z[k].date, Z[k].bas, Z[k].haut], [D[j].date, bas, haut]);
    zones++;
    for (const v of Z[k].N) {
      const prof = Math.round(v.q / 100 * (haut - bas) / 0.25) * 0.25, p = dessus ? haut - prof : bas + prof;
      let q = j + 1;
      while (q < D.length && !(D[q].lo <= p && p <= D[q].hi)) q++;
      assert.deepEqual([v.p, v.j, v.fin, v.masque], [p, j, q < D.length ? q : -1, false], D[j].date + ' ' + v.q + ' %');
      v.fin >= 0 ? pris++ : vierges++;
    }
  });
  // Drawn from the left edge of the zone's profile to the left edge of the profile that takes the level.
  env.E.dessine(g, avec({ mini: 1 }));
  const x = j => 1000 - (D.length - j) * 30, vus = segments(g);
  const voulus = Z.flatMap(z => z.N).map(v => [Math.max(x(v.j), 0), v.fin >= 0 ? x(v.fin) : 1000, v.p]).filter(t => t[1] > t[0]);
  assert.deepEqual(vus, voulus, 'tracé dans le cadre');
  assert.ok(vus.length > 0);
  console.log('OK Market Profile |', zones, 'zones sur', D.length, 'jours cuits,', pris, 'niveaux pris,', vierges, 'vierges');

  // Synthetic days: taken by a later range, the session in progress has no zone but takes levels.
  const niv = (env, o) => { const M = env.E.outils.calculProfil(profil(o)); return copie(M.Z).map(z => z.N.map(v => [v.q, v.j, v.fin, v.masque])); };
  let R = niv(page([jour(L1), plat(M2, 103.75, 106), plat(M3, 103.75, 107.5), Object.assign(jour(FUTUR_J), { lo: 103.75, hi: 110 })]));
  assert.deepEqual(R, [[[0, 0, 1, false], [25, 0, 2, false], [50, 0, 2, false], [75, 0, -1, true], [100, 0, -1, true]]],
    'une seule zone : la séance en cours n\'en a pas ; jours ouvrés absents avant elle');
  // A business day missing between two daily profiles masks what is still untouched.
  R = niv(page([jour(L1), plat(M3, 103.75, 106)]));
  assert.deepEqual(R[0].map(v => [v[2], v[3]]), Array(5).fill([-1, true]), 'jour ouvré manquant');
  // The last profile closed: it has its zone too. Weekly profiles: the last one never has.
  R = niv(page([jour(L1), jour(M2)]));
  assert.equal(R.length, 2, 'dernier profil clos');
  assert.deepEqual(R[0].map(v => v[2]), Array(5).fill(1), 'pris par le profil suivant, qui couvre la zone');
  R = niv(page([jour(L1), jour(M2)], { mode: 'weekly' }));
  assert.equal(R.length, 1, 'semaine en cours sans zone');
  // Merged days: one profile for two days, its zones from the merged rows, its close from the last day.
  const fusion = (a, b) => ({ hi: 110, lo: 103.75, rows: [[110, '', 4], [108.75, '', 1], [107.5, '', 2], [106.25, '', 1], [105, '', 6], [103.75, '', 4]] });
  const F = page([jour(L1), jour(M2), plat(M3, 108.5, 109)], { layout: [{ x0: 100, w: 80, merge: [0, 1] }, { x0: 180, w: 40, i: 2 }], aggDay: fusion });
  const MF = copie(F.E.outils.calculProfil(profil()).Z);
  assert.deepEqual(MF.map(z => [z.date, z.bas, z.haut, z.N.map(v => v.fin)]), [[M2, 108.25, 109.25, [-1, 1, 1, 1, -1]], [M2, 105.75, 106.75, [-1, -1, -1, -1, -1]]], 'profils fusionnés');
  // Hide taken levels and minimum height apply here too; nothing without the page's globals.
  const h = profil();
  F.E.dessine(h, avec({ mini: 1, masquePris: true }));
  assert.equal(segments(h).length, 7, 'niveaux pris masqués');
  const nu = profil();
  charge().E.dessine(nu, defaut);
  assert.equal(nu.traits.length, 0, 'sans les globales de la page');
}

console.log('OK single_prints_niveaux');
