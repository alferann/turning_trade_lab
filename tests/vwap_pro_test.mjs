// Self-check for extensions/vwap_pro.js on real ES bars baked by Turning Trade.
// Run: node tests/vwap_pro_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/vwap_pro.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date, v: b.lv.reduce((a, l) => a + l[1] + l[2], 0) }, b));
const N = bars.length, tick = db.tick;
const J = e => !e || !e.length ? { n: 0, prix: () => 0, bid: () => 0, ask: () => 0 }
  : { n: e.length, prix: k => e[k][0], bid: k => e[k][1] || 0, ask: k => e[k][2] || 0 };

// No HFQSessionsMonde in the context: the study falls back to its built-in session defaults. fetch serves the
// one-minute files of FICHIERS only when servir() is awaited, like a request in flight.
const defs = [], FICHIERS = {}, appels = [], attente = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console,
  HFQSymGuard: { histFile: (t, s) => t + '_' + s + '.json' },
  fetch(f) { appels.push(f); return new Promise(ok => attente.push(() => ok({ json: () => FICHIERS[f] }))); } }));
const servir = async () => { while (attente.length) attente.shift()(); await new Promise(r => setImmediate(r)); };
assert.equal(defs.length, 6, 'six instances');
assert.deepEqual(defs.map(d => d.id), ['vwap-pro-a', 'vwap-pro-b', 'vwap-pro-c', 'vwap-pro-d', 'vwap-pro-e', 'vwap-pro-f'], 'ids stables');
const A = defs[0];
const defaut = Object.fromEntries(A.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

const rec = [];
const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() { rec.push({ k: 'fill', col: this.fillStyle, op: this.globalAlpha }); } };
const g = (B = bars, seance = 'eth', premiere = B.length - 300) => ({ n: B.length, premiere, derniere: B.length - 1, tick, seance, sym: 'ES', tf: 1, echelle: 1, ctx,
  cadre: { gauche: 0, droite: 1e9, haut: 0, bas: 500 }, barre: i => B[i] || null, niveaux: i => J(B[i] && B[i].lv), x: i => 2 * i, y: v => v,
  trait(p, o) { rec.push({ k: 'trait', p, o }); }, etiquette(p, o) { rec.push({ k: 'etiq', p, o }); }, ligne() {}, zone() {}, texte() {} });

// The study draws nothing until its cold compute has caught up with the chart: compute it all first.
const dessine = (G, r) => { A.calcul(G, r); rec.length = 0; A.dessine(G, r); };

// Brute-force VWAP and σ from the per-price volume of a set of bars.
const brute = bs => { let sv = 0, spv = 0, spv2 = 0; for (const b of bs) for (const [p, bid, ask] of b.lv) { const v = bid + ask; sv += v; spv += p * v; spv2 += p * p * v; } const vwap = spv / sv; return { vwap, sd: Math.sqrt(spv2 / sv - vwap * vwap) }; };
const cur = db.sessions[db.sessions.length - 1], iCur = N - cur.bars.length;
// The last session that reaches 16:00 ET, for the session windows: the archive may end in the Asian session.
const plein = db.sessions.findLast(s => s.bars.some(b => b.m >= 1320)), iPlein = bars.findIndex(b => b._date === plein.date);
const NP = iPlein + plein.bars.length, BP = bars.slice(0, NP);
const proche = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, msg + ' : ' + a + ' vs ' + b);

// 1. Daily anchor: the last bar carries the VWAP of the whole current session; the first bar of the session restarts the sums.
{
  const C = A.calcul(g(), defaut), B = brute(cur.bars);
  proche(C.vwap[N - 1], B.vwap, 'DVWAP'); proche(C.sd[N - 1], B.sd, 'σ journalière');
  proche(C.vwap[iCur], brute([cur.bars[0]]).vwap, 'remise à zéro à l\'ouverture');
  proche(C.vwap[iCur - 1], brute(db.sessions[db.sessions.length - 2].bars).vwap, 'veille complète');
}

// 2. Time zones: London 08:00 is 03:00 New York in October, Tokyo 09:00 is 20:00 New York the evening before.
{
  assert.equal(A.outils.versET(8 * 60, 'Europe/London', '2026-10-14'), 180, 'Londres → ET');
  assert.equal(A.outils.versET(9 * 60, 'Asia/Tokyo', '2026-10-14'), 1200, 'Tokyo → ET');
  assert.equal(A.outils.versET(9 * 60 + 30, 'America/Chicago', '2026-10-14'), 630, 'Chicago → ET');
  assert.deepEqual([...A.outils.bornesET('us', '2026-10-14', defaut)], [570, 960], 'RTH 09:30 → 16:00 ET');
  assert.deepEqual([...A.outils.bornesET('eu', '2026-10-14', defaut)], [180, 570], 'Europe 03:00 → 09:30 ET');
  assert.deepEqual([...A.outils.bornesET('asie', '2026-10-14', defaut)], [1080, 180], 'Asie 18:00 → 03:00 ET');
}

// 3. Session anchors on an ETH chart: RTH is m ∈ [930, 1320), Asia runs from the open to Europe, which starts
// at 08:00 London and so moves against ET between the two DST switches; outside, nothing.
{
  const fen = Object.fromEntries(['us', 'eu', 'asie'].map(anc => {
    const [a, b] = A.outils.bornesET(anc, plein.date, defaut).map(v => (v - 1080 + 1440) % 1440);
    return [anc, [a, b <= a ? b + 1440 : b]];
  }));
  assert.deepEqual(fen.us, [930, 1320], 'RTH en minutes de séance');
  for (const anc of Object.keys(fen)) {
    const C = A.calcul(g(BP), avec({ anc }));
    const dedans = [], dehors = [];
    for (let i = iPlein; i < NP; i++) (bars[i].m >= fen[anc][0] && bars[i].m < fen[anc][1] ? dedans : dehors).push(i);
    assert.ok(dehors.every(i => Number.isNaN(C.vwap[i])), anc + ' : rien hors séance');
    assert.ok(dedans.every(i => Number.isFinite(C.vwap[i])), anc + ' : une valeur par barre de séance');
    const fin = dedans[dedans.length - 1], B = brute(dedans.map(i => bars[i]));
    proche(C.vwap[fin], B.vwap, anc + ' : VWAP de séance'); proche(C.sd[fin], B.sd, anc + ' : σ de séance');
    proche(C.vwap[dedans[0]], brute([bars[dedans[0]]]).vwap, anc + ' : remise à zéro au début de séance');
  }
}

// 4. Forced hours in another zone: 09:30 Chicago = 10:30 New York = m 990, until 16:00 ET.
{
  const C = A.calcul(g(BP), avec({ anc: 'us', deb: '570', tz: 'America/Chicago' }));
  const premier = BP.findIndex((b, i) => i >= iPlein && Number.isFinite(C.vwap[i]));
  assert.equal(bars[premier].m, 990, 'début forcé 09:30 Chicago');
  assert.ok(Number.isNaN(C.vwap[BP.findIndex((b, i) => i >= iPlein && b.m === 1320)]), 'fin auto à 16:00 ET');
}

// 5. Weekly and monthly. Up to eight whole sessions (first bar within the hour, last one within 4 h of the close: a
// cut one, like 22/10 stopping at 07:37 ET, masks the rest of its week) are relabelled on the business days from
// Monday 2 November 2026, the first business day of its month, so the bench does not depend on the days the archive
// holds: week 45 (2 to 6 November), then week 46.
const ouvres = [];
for (const d = new Date(Date.UTC(2026, 10, 2)); ouvres.length < 8; d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) ouvres.push(d.toISOString().slice(0, 10));
const entiere = s => s.bars.length && s.bars[0].m < 60 && s.bars.at(-1).m >= 1140;
const R = db.sessions.filter(entiere).slice(0, 8).map((s, k) => ({ date: ouvres[k], bars: s.bars }));
assert.ok(R.length >= 4, 'au moins quatre séances complètes dans l\'archive');
const aplat = S => S.flatMap(s => s.bars.map(b => Object.assign({ _date: s.date, v: b.lv.reduce((a, l) => a + l[1] + l[2], 0) }, b)));
const cleP = { sem: d => A.outils.semaine(d), mois: d => d.slice(0, 7) };
const BR = aplat(R), BT = aplat(R.slice(2)), d0 = BR.length - BT.length;
const ticks = (B, sym) => Object.assign(g(B), { tf: '1000t', sym });
const sem45 = b => A.outils.semaine(b._date) === A.outils.semaine(R[2].date);
{
  const last = R.at(-1), iLast = BR.length - last.bars.length;
  for (const anc of ['sem', 'mois']) {
    const S = R.filter(s => cleP[anc](s.date) === cleP[anc](last.date)), C = A.calcul(g(BR), avec({ anc }));
    proche(C.vwap[BR.length - 1], brute(S.flatMap(s => s.bars)).vwap, anc + ' sur ' + S.length + ' séances');
    proche(C.vwap[iLast], brute(S.slice(0, -1).flatMap(s => s.bars).concat([last.bars[0]])).vwap, anc + ' : ouverture de la dernière séance');
  }
}

// 5b. A minute chart is cut from the very file that would complete it: taken from Wednesday 4 November, its month and
// first week are masked, the next week is drawn, and no file is read.
{
  const n0 = appels.length;
  assert.ok(Array.from(A.calcul(g(BT), avec({ anc: 'mois' })).vwap.subarray(0, BT.length)).every(Number.isNaN), 'minutes depuis le 4 : mois masqué');
  const W = A.calcul(g(BT), avec({ anc: 'sem' }));
  assert.ok(BT.every((b, i) => !sem45(b) || Number.isNaN(W.vwap[i])), 'minutes depuis le 4 : semaine 45 masquée');
  if (!sem45(BT.at(-1))) assert.ok(Number.isFinite(W.vwap[BT.length - 1]), 'semaine 46 tracée');
  assert.equal(appels.length, n0, 'graphe en minutes : aucun fichier lu');
}

// 5c. Tick chart from Wednesday 4 November: masked until the one-minute file is read, then completed by it, equal to
// the minute chart that holds the whole period; the file is read once for every anchor.
{
  FICHIERS['_footprint_eth_T1.json'] = { sessions: R };
  const T = ticks(BT, 'T1'), n0 = appels.length;
  assert.ok(Number.isNaN(A.calcul(T, avec({ anc: 'mois' })).vwap[0]), 'masqué tant que le fichier n\'est pas lu');
  await servir();
  for (const anc of ['mois', 'sem']) {
    const r = avec({ anc }), ref = Array.from(defs[1].calcul(g(BR), r).vwap.subarray(d0, BR.length));
    const tk = Array.from(A.calcul(T, r).vwap.subarray(0, BT.length));
    assert.ok(tk.every((v, i) => Number.isNaN(v) ? Number.isNaN(ref[i]) : Math.abs(v - ref[i]) < 1e-6), anc + ' : ticks complétés = minutes entières');
  }
  assert.deepEqual(appels.slice(n0), ['_footprint_eth_T1.json'], 'fichier minute lu une fois');
}

// 5d. Tick chart starting mid-session: the minutes of that session before its first bar are added too.
{
  FICHIERS['_footprint_eth_T2.json'] = { sessions: R };
  const k = BR.findIndex(b => b._date === R[2].date && b.m >= 600), T = ticks(BR.slice(k), 'T2');
  assert.ok(k > 0, 'séance du 4 jusqu\'à 04:00 ET');
  A.calcul(T, avec({ anc: 'mois' })); await servir();
  proche(A.calcul(T, avec({ anc: 'mois' })).vwap[BR.length - k - 1], brute(R.flatMap(s => s.bars)).vwap, 'ticks pris en cours de séance');
}

// 5e. Nothing displayed on missing data: a file that does not reach the first business day, or that has a hole of
// more than four days, masks the period instead of drawing it from the first loaded bar.
{
  FICHIERS['_footprint_eth_T3.json'] = { sessions: R.slice(1) };
  FICHIERS['_footprint_eth_T4.json'] = { sessions: [{ date: '2026-11-02', bars: R[0].bars }, { date: '2026-11-10', bars: R[1].bars }] };
  const T3 = ticks(BT, 'T3'), T4 = ticks(aplat([{ date: '2026-11-11', bars: R[2].bars }]), 'T4');
  A.calcul(T3, avec({ anc: 'mois' })); A.calcul(T4, avec({ anc: 'mois' })); await servir();
  assert.ok(Array.from(A.calcul(T3, avec({ anc: 'mois' })).vwap.subarray(0, BT.length)).every(Number.isNaN), 'fichier sans le 2 : mois masqué');
  const W = A.calcul(T3, avec({ anc: 'sem' }));
  assert.ok(BT.every((b, i) => !sem45(b) || Number.isNaN(W.vwap[i])), 'fichier sans le 2 : semaine 45 masquée');
  assert.ok(Array.from(A.calcul(T4, avec({ anc: 'mois' })).vwap.subarray(0, R[2].bars.length)).every(Number.isNaN), 'trou du 2 au 10 : mois masqué');
}

// 5f. Nothing displayed on missing data, every anchor. Whole sessions on the business days from Monday 2 November
// (London and New York both on winter time: Asia m ∈ [0, 540), Europe [540, 930), US [930, 1320)).
const RS = ouvres.slice(0, 6).map((date, k) => ({ date, bars: R[k % R.length].bars }));
const fenDe = anc => { const [a, z] = A.outils.bornesET(anc, '2026-11-04', defaut).map(v => (v - 1080 + 1440) % 1440); return b => b.m >= a && b.m < (z <= a ? z + 1440 : z); };
const FEN = { us: fenDe('us'), eu: fenDe('eu'), asie: fenDe('asie') };
assert.deepEqual(['us', 'eu', 'asie'].map(anc => A.outils.bornesET(anc, '2026-11-04', defaut)[0]), [570, 180, 1080], 'heures d\'hiver');
const coupe = (s, f) => ({ date: s.date, bars: s.bars.filter(f) });
const trous = date => Array.from({ length: 8 }, () => ({ _trou: true, _date: date, m: 0, o: 7000, h: 7000, l: 7000, c: 7000, lv: [], v: 0 }));
// Each bar is drawn exactly when f says so.
const traces = (C, B, f, msg) => { const k = B.findIndex((b, i) => Number.isFinite(C.vwap[i]) !== !!f(b)); assert.equal(k, -1, msg + (k < 0 ? '' : ' : barre ' + k + ', ' + B[k]._date + ' m ' + B[k].m)); };
const fin = (C, B, f) => C.vwap[B.findLastIndex(f)];
{
  // Minute chart joined at 05:40 ET on Monday 2 (m 700, Europe started at m 540): that day's session and its Europe
  // are masked, its US session, which opens later, is drawn whole; the next days are drawn. No file is read.
  const n0 = appels.length, L = aplat([coupe(RS[0], b => b.m >= 700), RS[1], RS[2]]);
  traces(A.calcul(g(L), defaut), L, b => b._date !== '2026-11-02', 'minutes prises à 05:40 : séance masquée');
  traces(A.calcul(g(L), avec({ anc: 'eu' })), L, b => FEN.eu(b) && b._date !== '2026-11-02', 'minutes prises à 05:40 : Europe masquée');
  const U = A.calcul(g(L), avec({ anc: 'us' }));
  traces(U, L, FEN.us, 'minutes prises à 05:40 : RTH entière');
  proche(fin(U, L, b => b._date === '2026-11-02' && FEN.us(b)), brute(RS[0].bars.filter(FEN.us)).vwap, 'RTH du 2 entière');
  assert.equal(appels.length, n0, 'graphe en minutes : aucun fichier lu');

  // A session joined late further on (a partial day): that session masked, the week masked from it on, RTH drawn.
  const M = aplat([RS[0], coupe(RS[1], b => b.m >= 700), RS[2]]);
  traces(A.calcul(g(M), defaut), M, b => b._date !== '2026-11-03', 'séance du 3 entamée à 05:40 : masquée');
  traces(A.calcul(g(M), avec({ anc: 'sem' })), M, b => b._date === '2026-11-02', 'semaine masquée depuis le 3');
  traces(A.calcul(g(M), avec({ anc: 'us' })), M, FEN.us, 'RTH du 3 entière');

  // Footprint, without dates: same masking, no file to complete it from.
  const sans = L.map(b => { const c = Object.assign({}, b); delete c._date; return c; }), k1 = L.findIndex(b => b._date === '2026-11-03');
  const P = A.calcul(g(sans), defaut);
  assert.ok(sans.every((b, i) => Number.isFinite(P.vwap[i]) === (i >= k1)), 'footprint pris à 05:40 : séance masquée');
  assert.equal(appels.length, n0, 'footprint : aucun fichier lu');

  // A window straddling the chart's open: 16:00 → 18:30 ET is masked after the open, its first hour being in the
  // previous session; 17:00 → 18:30 starts in the maintenance break, so the open starts it.
  const O = aplat(RS.slice(0, 2));
  traces(A.calcul(g(O), avec({ anc: 'us', deb: '960', fin: '1110' })), O, b => b.m >= 1320, '16:00 → 18:30 : masquée après l\'ouverture');
  traces(A.calcul(g(O), avec({ anc: 'us', deb: '1020', fin: '1110' })), O, b => b.m < 30, '17:00 → 18:30 : tracée depuis l\'ouverture');
}

// 5g. Tick chart joined at 05:40 ET on Wednesday 4: its session and its Europe are completed from the one-minute
// file, equal to the minute chart that holds them; masked if the file starts that session late, stops more than an
// hour before the first tick bar, or lacks the day.
{
  const BR6 = aplat(RS), k = BR6.findIndex(b => b._date === '2026-11-04' && b.m >= 700), T = BR6.slice(k);
  const fichier = (sym, S) => { FICHIERS['_footprint_eth_' + sym + '.json'] = { sessions: S }; return ticks(T, sym); };
  const G = { ok: fichier('S1', RS), tard: fichier('S2', RS.map(s => s.date === '2026-11-04' ? coupe(s, b => b.m >= 300) : s)),
    court: fichier('S3', RS.map(s => s.date === '2026-11-04' ? coupe(s, b => b.m < 500) : s)), sans: fichier('S4', RS.filter(s => s.date !== '2026-11-04')) };
  const r = { jour: defaut, eu: avec({ anc: 'eu' }), us: avec({ anc: 'us' }) };
  for (const x of Object.values(G)) for (const rr of Object.values(r)) A.calcul(x, rr);
  assert.ok(Number.isNaN(A.calcul(G.ok, defaut).vwap[0]), 'masqué tant que le fichier n\'est pas lu');
  await servir();
  const vu = (x, rr) => Array.from(A.calcul(x, rr).vwap.subarray(0, T.length));
  const meme = (a, b) => a.every((v, i) => Number.isNaN(v) ? Number.isNaN(b[i]) : Math.abs(v - b[i]) < 1e-6);
  for (const [nom, rr] of Object.entries(r)) {
    const ref = Array.from(defs[1].calcul(g(BR6), rr).vwap.subarray(k, BR6.length));
    assert.ok(meme(vu(G.ok, rr), ref), nom + ' : ticks complétés = minutes entières');
  }
  const du4 = b => b._date === '2026-11-04';
  traces(A.calcul(G.tard, defaut), T, b => !du4(b), 'fichier qui prend le 4 à 23:00 : séance masquée');
  assert.ok(meme(vu(G.tard, r.eu), Array.from(defs[1].calcul(g(BR6), r.eu).vwap.subarray(k, BR6.length))), 'fichier qui prend le 4 à 23:00 : Europe complétée');
  for (const [nom, x] of [['court', G.court], ['sans', G.sans]]) {
    traces(A.calcul(x, defaut), T, b => !du4(b), nom + ' : séance masquée');
    traces(A.calcul(x, r.eu), T, b => FEN.eu(b) && !du4(b), nom + ' : Europe masquée');
  }
  traces(A.calcul(G.sans, r.us), T, FEN.us, 'RTH du 4 entière dans le graphe');
}

// 5h. Week completed from the file: every session it brings must be whole and none may be missing. Tick chart from
// Wednesday 4: masked if the file cuts Tuesday 3 at 07:37 ET or starts it at 23:00; joined at 05:40 that day, masked
// if the file lacks Wednesday; from Friday 6, masked if Tuesday and Wednesday are both missing, drawn if only
// Wednesday is (it passes for a holiday).
{
  const W = avec({ anc: 'sem' }), mer = aplat(RS.slice(2, 5)), ven = aplat([RS[4]]), mer540 = mer.filter(b => b._date !== '2026-11-04' || b.m >= 700);
  const cas = [['coupé', mer, RS.map(s => s.date === '2026-11-03' ? coupe(s, b => b.m < 818) : s), false],
    ['tard', mer, RS.map(s => s.date === '2026-11-03' ? coupe(s, b => b.m >= 300) : s), false],
    ['sans le mercredi', mer540, RS.filter(s => s.date !== '2026-11-04'), false], ['entier', mer540, RS, true],
    ['deux jours', ven, [RS[0], RS[3]], false], ['un jour', ven, [RS[0], RS[1], RS[3]], true]];
  const G = cas.map(([nom, B, S], k) => { FICHIERS['_footprint_eth_W' + k + '.json'] = { sessions: S }; return ticks(B, 'W' + k); });
  G.forEach(x => A.calcul(x, W)); await servir();
  cas.forEach(([nom, B, , ok], k) => traces(A.calcul(G[k], W), B, () => ok, 'fichier ' + nom + ' : semaine ' + (ok ? 'complétée' : 'masquée')));
}

// 5i. Inside the chart: a session cut at 07:37 ET or a missing day (TT's filler bars) masks the week from there on,
// the next week is drawn; each session keeps its own VWAP, exact up to its last bar. Two weekdays without a session
// mask the week too; a lone one passes for a holiday.
{
  const W = avec({ anc: 'sem' }), apres = b => b._date >= '2026-11-09';
  const C = aplat([RS[0], coupe(RS[1], b => b.m < 818), RS[2], RS[3], RS[4], RS[5]]);
  traces(A.calcul(g(C), W), C, b => b._date <= '2026-11-03' || apres(b), 'séance coupée : semaine masquée ensuite');
  const J = A.calcul(g(C), defaut);
  traces(J, C, () => true, 'séance coupée : chaque séance tracée');
  proche(fin(J, C, b => b._date === '2026-11-03'), brute(RS[1].bars.filter(b => b.m < 818)).vwap, 'séance coupée exacte jusqu\'à sa fin');
  traces(A.calcul(g(C), avec({ anc: 'eu' })), C, FEN.eu, 'Europe du 3 tracée jusqu\'à la coupure');
  const T = [...aplat([RS[0]]), ...trous('2026-11-03'), ...aplat(RS.slice(2))];
  traces(A.calcul(g(T), W), T, b => b._date === '2026-11-02' || apres(b), 'jour manquant : semaine masquée depuis le trou');
  traces(A.calcul(g(T), defaut), T, b => !b._trou, 'jour manquant : les autres séances tracées');
  const D = aplat([RS[0], RS[3]]), U = aplat([RS[0], RS[2]]);
  traces(A.calcul(g(D), W), D, b => b._date === '2026-11-02', 'mardi et mercredi sans séance : semaine masquée');
  traces(A.calcul(g(U), W), U, () => true, 'mardi sans séance : férié, semaine tracée');
}

// 6. Incremental cache: one more bar extends the sums instead of recomputing, same result as from scratch.
{
  const C1 = A.calcul(g(bars.slice(0, N - 1)), defaut);
  assert.equal(C1.n, N - 1);
  const C2 = A.calcul(g(), defaut);
  assert.equal(C2.n, N);
  proche(C2.vwap[N - 1], brute(cur.bars).vwap, 'extension d\'une barre');
  proche(C2.vwap[N - 2], brute(cur.bars.slice(0, -1)).vwap, 'barre précédente intacte');
}

// 6b. Bars inserted before the last one read (tick history filling a missing day): the cache starts over
// and gives what a fresh computation gives, whatever the anchor.
{
  const trou = bars.filter(b => b._date !== db.sessions[1].date), sur = (B, sym) => Object.assign(g(B), { sym });
  for (const anc of ['jour', 'us', 'sem']) {
    A.calcul(sur(trou, 'INS'), avec({ anc }));
    const ins = Array.from(A.calcul(sur(bars, 'INS'), avec({ anc })).vwap.subarray(0, N));
    assert.deepEqual(ins, Array.from(defs[1].calcul(sur(bars, 'NEUF'), avec({ anc })).vwap.subarray(0, N)), anc + ' : insertion = calcul complet');
  }
}

// 7. Footprint-like bars without _date: sessions are split where m falls back.
{
  const sans = bars.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  const C = A.calcul(g(sans), defaut);
  proche(C.vwap[N - 1], brute(cur.bars).vwap, 'DVWAP sans _date');
  proche(C.vwap[iCur], brute([cur.bars[0]]).vwap, 'remise à zéro sans _date');
}

// 8. Drawing: one trait per line (VWAP + 2 per active level), one inner band per level with opacity > 0, labels.
{
  dessine(g(), defaut);
  const traits = rec.filter(x => x.k === 'trait');
  assert.equal(traits.length, 1 + 2 * 3, 'VWAP et trois paliers par défaut');
  assert.deepEqual(rec.filter(x => x.k === 'fill').map(x => x.op), [defaut.f1, defaut.f1, defaut.f2, defaut.f2, defaut.f3, defaut.f3], 'bandes intérieures, opacité de chaque palier');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 1, 'étiquette VWAP seule');
  const vwap = traits[traits.length - 1];
  assert.equal(vwap.o.couleur, defaut.vwapC, 'couleur perso du VWAP');
  assert.equal(vwap.p.filter(Boolean).length, 300, 'un point par barre visible');
  const sd1 = traits.find(t => t.o.couleur === defaut.c1);
  assert.ok(sd1 && sd1.o.pointille && sd1.o.pointille.length === 2, 'σ1 en tirets, couleur perso');

  const six = { on4: true, on5: true, on6: true, sd4: 2.5, sd5: 3.9, sd6: 0.5, f4: 0.1, f5: 0.1, f6: 0.1 };
  dessine(g(), avec({ ...six, theme: 'neon', etiq: 'tous', t1: 'plein' }));
  const T = rec.filter(x => x.k === 'trait');
  assert.equal(T.length, 1 + 2 * 6, 'six paliers');
  assert.equal(rec.filter(x => x.k === 'fill').length, 2 * 6, 'remplissages');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 1 + 2 * 6, 'étiquettes VWAP et bandes');
  assert.equal(T[T.length - 1].o.couleur, '#ffffff', 'VWAP du thème Néon');
  assert.ok(T.some(t => t.o.couleur === '#00f0ff' && t.o.pointille === null), 'σ1 néon, plein');

  // Only the band between σ4 and σ5 is filled: it belongs to σ5, the outer level.
  dessine(g(), avec({ on4: true, on5: true, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0.2 }));
  assert.deepEqual(rec.filter(x => x.k === 'fill').map(x => [x.col, x.op]), [[defaut.c5, 0.2], [defaut.c5, 0.2]], 'bande σ4 → σ5 seule');

  dessine(g(), avec({ on2: false, sd3: 0 }));
  assert.equal(rec.filter(x => x.k === 'trait').length, 3, 'case décochée ou multiplicateur nul : palier éteint');
  assert.equal(rec.filter(x => x.k === 'fill').length, 2, 'seule la bande de σ1');
  dessine(g(), avec({ vwapOn: false }));
  assert.equal(rec.filter(x => x.k === 'trait').length, 2 * 3, 'VWAP masqué, bandes gardées');
  assert.equal(rec.filter(x => x.k === 'etiq').length, 0, 'pas d\'étiquette sans le trait');

  // Unsorted multipliers are filled from the inside out: the band 1σ→2.5σ takes the colour of the 2.5σ slot.
  dessine(g(), avec({ sd1: 2.5, sd2: 1, on3: false, f1: 0.1, f2: 0.1 }));
  const fills = rec.filter(x => x.k === 'fill');
  assert.deepEqual(fills.map(f => f.col), [defaut.c2, defaut.c2, defaut.c1, defaut.c1], 'paliers triés par multiplicateur');

  // TT's settings panel upper-cases every label except checkboxes: σ would read Σ.
  assert.equal(A.reglages.filter(x => x.type !== 'check' && /σ/.test(x.label)).map(x => x.k).join(), '', 'pas de σ hors des cases à cocher');
  assert.equal(A.reglages.filter(x => x.type === 'check').map(x => x.label.split(' ')[0]).join(), 'VWAP,σ1,σ2,σ3,σ4,σ5,σ6', 'une sous-section par trait');
}

// 9. Current period only: the view spans two sessions, only the last one is drawn.
{
  dessine(g(bars, 'eth', iCur - 200), avec({ hist: 'cour' }));
  const vwap = rec.filter(x => x.k === 'trait').pop();
  assert.equal(vwap.p.filter(Boolean).length, cur.bars.length, 'séance en cours seule');
  dessine(g(bars, 'eth', iCur - 200), defaut);
  assert.equal(rec.filter(x => x.k === 'trait').pop().p.filter(Boolean).length, cur.bars.length + 200, 'tout l\'historique');
}

// 10. Zoomed out, four bars per pixel: one point every 2 px, on multiples of the step, with the ends of each run
// and the last bar; the kept points are those of the full-resolution line.
{
  dessine(g(), defaut); const plein = new Map(rec.filter(x => x.k === 'trait').pop().p.filter(Boolean).map(([x, y]) => [x / 2, y]));
  dessine(Object.assign(g(), { x: i => i / 4 }), defaut); const reduit = rec.filter(x => x.k === 'trait').pop().p.filter(Boolean);
  assert.ok(reduit.length < plein.size / 6, 'un point toutes les huit barres : ' + reduit.length + ' sur ' + plein.size);
  assert.ok(reduit.every(([x, y]) => plein.get(4 * x) === y), 'points du trait complet');
  assert.equal(reduit.at(-1)[0], (N - 1) / 4, 'dernière barre gardée');
  dessine(Object.assign(g(bars, 'eth', iCur - 200), { x: i => i / 4 }), avec({ hist: 'cour' }));
  assert.equal(rec.filter(x => x.k === 'trait').pop().p.find(Boolean)[0], iCur / 4, 'première barre de la séance gardée');
}

// 10b. Footprint: TT passes the whole history as premiere..derniere. Only the bars inside the frame are drawn,
// plus one on each side, else six levels over every bar got the study suspended.
{
  const six = avec({ on4: true, on5: true, on6: true, sd4: 2.5, sd5: 3.9, sd6: 0.5, f4: 0.1, f5: 0.1, f6: 0.1 });
  const G = Object.assign(g(bars, 'eth', 0), { x: i => (i - N + 40) * 40 + 20, cadre: { gauche: 0, droite: 1000, haut: 0, bas: 500 } });
  dessine(G, six);
  const p = rec.filter(x => x.k === 'trait').pop().p.filter(Boolean);
  assert.deepEqual([p.length, p[0][0], p.at(-1)[0]], [27, -20, 1020], 'footprint : barres du cadre seules, une de chaque côté');
  const t = performance.now(); for (let k = 0; k < 50; k++) A.dessine(G, six);
  const ms = (performance.now() - t) / 50;
  assert.ok(ms < 1, 'footprint : image chaude ' + ms.toFixed(3) + ' ms');
}

// 11. Budget: the cold compute spans several frames, never three in a row over 8 ms (TT's suspension rule, so a
// lone GC pause does not fail the bench); then cached frames.
{
  const G = g(), r = avec({ anc: 'eu' });
  let images = 0, froid = 0, lents = 0, suspendue = false;
  do {
    rec.length = 0; const t = performance.now(); A.dessine(G, r); const ms = performance.now() - t;
    froid = Math.max(froid, ms); lents = ms > 8 ? lents + 1 : 0; suspendue ||= lents >= 3; images++;
  } while (!rec.length && images < 100);
  const t1 = performance.now(); for (let k = 0; k < 50; k++) A.dessine(G, r); const chaud = (performance.now() - t1) / 50;
  assert.ok(!suspendue && images > 1 && chaud < 1, 'budget 8 ms, pire image ' + froid.toFixed(2) + ' en ' + images + ' images, chaud ' + chaud.toFixed(3));
  const D = A.calcul(G, defaut);
  console.log('OK', N, 'barres,', db.sessions.length, 'séances | DVWAP', D.vwap[N - 1].toFixed(2), 'σ', D.sd[N - 1].toFixed(2), '| froid', froid.toFixed(2), 'ms en', images, 'images, chaud', chaud.toFixed(3), 'ms');
}
