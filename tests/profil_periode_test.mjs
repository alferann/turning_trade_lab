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
// TT's market calendar (hfq-sessions.js): full CME closures (New Year, Good Friday, Christmas) are no missing day.
const HFQSessions = (() => { const c = {}; vm.runInContext(fs.readFileSync(path.join(process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload', 'hfq-sessions.js'), 'utf8'), vm.createContext(c)); return c.HFQSessions; })();
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');
const PAYLOAD = process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload';

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = [];
for (const s of db.sessions) for (const b of s.bars) bars.push(Object.assign({ _date: s.date }, b));
const last = db.sessions[db.sessions.length - 1], iLast = bars.length - last.bars.length;
// The last session that reaches 16:00 ET, for the session windows: the archive may end in the Asian session.
const kPlein = db.sessions.findLastIndex(s => s.bars.some(b => b.m >= 1320)), plein = db.sessions[kPlein];
const iPlein = bars.findIndex(b => b._date === plein.date), BP = bars.slice(0, iPlein + plein.bars.length);

// Each context gets its own study instances; `extra` adds globals such as HFQSessionsMonde.
const charger = (extra = {}) => { const defs = []; vm.runInContext(SRC, vm.createContext(Object.assign({ HFQExt: { etude(d) { defs.push(d); return true; } }, console, performance, HFQSessions }, extra))); return defs; };
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

// Weekdays strictly between two dates: one without a session passes for a holiday, two make a hole.
const manquent = (a, b) => { let n = 0; for (let d = Date.parse(a) + 864e5; d < Date.parse(b); d += 864e5) if (new Date(d).getUTCDay() % 6) n++; return n; };

// 3. Week and month on real ES: the sessions of the last one's ISO week and month; partial when the chart
// starts inside them. A previous period that is partial, or incomplete (a session joined late or cut more than
// 4 h before the close, two weekdays without a session, as the archive may hold), is left out.
{
  const partiel = (T, S) => !E.outils.premierOuvre(T, S[0].date) || S[0].bars[0].m >= 60 ? S[0].date : null;
  const entiere = (T, S) => !partiel(T, S) && S.every((s, i) => s.bars[0].m < 60 && s.bars.at(-1).m >= 1140 && (!i || manquent(S[i - 1].date, s.date) <= 1));
  for (const [T, cle] of [['sem', sem], ['mois', d => d.slice(0, 7)]]) {
    const S = db.sessions.filter(s => cle(s.date) === cle(last.date)), R = cour(g(), avec({ periode: T }));
    egal(R, reference(S.flatMap(s => s.bars)), T + ' : ' + S.length + ' séances');
    assert.equal(R.partiel, partiel(T, S), T + ' : partiel');
    assert.equal(R.cle, T === 'sem' ? sem(last.date).slice(5) : last.date.slice(0, 7));
    // The last three previous periods, whatever the archive spans, but the partial or incomplete ones.
    const avant = db.sessions.filter(s => cle(s.date) < cle(last.date)), prec = complet(g(bars, { premiere: 0 }), avec({ periode: T, hist: 3 })).prec;
    const attendu = [...new Set(avant.map(s => cle(s.date)))].slice(-3).filter(c => entiere(T, avant.filter(s => cle(s.date) === c)));
    assert.deepEqual(prec.map(R => R.cle), attendu.map(c => T === 'sem' ? c.slice(5) : c), T + ' : précédents, partiel omis');
  }
}

// 4. RTH only on an ETH chart: 09:30-16:00 bars only; ignored on an RTH chart.
{
  egal(cour(g(BP), avec({ rth: true })), reference(plein.bars, entre(930, 1320)), 'RTH seul');
  egal(cour(g(BP, { seance: 'rth' }), avec({ rth: true })), reference(plein.bars), 'graphe RTH : pas de filtre');
}

// 5. US, Europe and Asia sessions with the built-in hours: RTH is m ∈ [930, 1320) on an ETH chart opened
// at 18:00 ET, Asia runs from the open to Europe, which starts at 08:00 London and so moves against ET
// between the two DST switches; the three cover the session but its last hour.
{
  assert.deepEqual([...E.outils.bornesET('us', '2026-10-14')], [570, 960], 'RTH 09:30 → 16:00 ET');
  assert.deepEqual([...E.outils.bornesET('eu', '2026-10-14')], [180, 570], 'Europe 03:00 → 09:30 ET');
  assert.deepEqual([...E.outils.bornesET('asie', '2026-10-14')], [1080, 180], 'Asie 18:00 → 03:00 ET');
  assert.deepEqual([...E.outils.bornesET('eu', '2026-10-26')], [240, 570], 'Europe 04:00 ET, Londres à l\'heure d\'hiver avant New York');
  // Windows of that session's date, in chart minutes.
  const fenDe = T => { const [a, b] = E.outils.bornesET(T, plein.date).map(v => (v - 1080 + 1440) % 1440); return entre(a, b <= a ? b + 1440 : b); };
  const fen = { us: fenDe('us'), eu: fenDe('eu'), asie: fenDe('asie') }, total = {};
  for (const T of Object.keys(fen)) {
    const R = cour(g(BP), avec({ periode: T }));
    egal(R, reference(plein.bars, fen[T]), T);
    assert.deepEqual([R.deb, R.fin], [iPlein + plein.bars.findIndex(b => fen[T](b.m)), iPlein + plein.bars.findLastIndex(b => fen[T](b.m))], T + ' : barres de la fenêtre');
    assert.equal(R.cle, plein.date);
    for (const [t, e] of Object.entries(plat(R))) { const s = total[t] ||= [0, 0]; s[0] += e[0]; s[1] += e[1]; }
  }
  assert.deepEqual(total, reference(plein.bars, m => m < 1320), 'Asie + Europe + US = séance sans sa dernière heure');
  // Previous sessions keep their own window; a recording cut before 09:30 has no RTH, one cut during it (last
  // RTH bar more than an hour before 16:00 and before 13:00) is left out.
  const prec = complet(g(BP, { premiere: 0 }), avec({ periode: 'us', hist: 9 })).prec;
  const touchent = db.sessions.slice(0, kPlein).filter(s => s.bars.some(b => fen.us(b.m)));
  const avecRTH = touchent.filter(s => { const U = s.bars.filter(b => fen.us(b.m)); return U[0].m < 990 && U.at(-1).m >= 1140; });
  assert.equal(prec.length, avecRTH.length, 'une RTH par séance précédente qui l\'a entière');
  prec.forEach((R, k) => egal(R, reference(avecRTH[k].bars, fen.us), 'RTH du ' + avecRTH[k].date));
  // Before 09:30 the last US session is the previous one; Europe is already today's.
  const tot = BP.slice(0, iPlein + plein.bars.findIndex(b => b.m >= 900));
  assert.equal(cour(g(tot), avec({ periode: 'us' })).cle, touchent.at(-1).date, 'avant 09:30 : RTH de la veille');
  assert.equal(cour(g(tot), avec({ periode: 'eu' })).cle, plein.date, 'Europe du jour');
  // TT's world sessions win over the defaults: US moved to 10:00-11:00 ET.
  const D = charger({ HFQSessionsMonde: { bornes: () => [{ id: 'us', debut: 36000, fin: 39600 }] } })[0];
  egal(cour(g(BP), avec({ periode: 'us' }), D), reference(plein.bars, entre(960, 1020)), 'sessions de TT');
}

// Synthetic weekday sessions of three one-minute bars with three levels each, by default at the open, the next
// minute and the last minute, so that each session runs to its close.
const jours = (de, a) => { const out = []; for (let d = new Date(de + 'T00:00:00Z'); d <= new Date(a + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) if (d.getUTCDay() % 6) out.push(d.toISOString().slice(0, 10)); return out; };
const synth = (dates, M = [0, 1, 1379]) => dates.flatMap((date, s) => [0, 1, 2].map(k => { const b = 100 + 0.25 * ((s * 7 + k) % 40); return { _date: date, m: M[k], o: b, h: b + 0.5, l: b, c: b + 0.25, v: 6, lv: [[b, 1, 1], [b + 0.25, s % 3, 2], [b + 0.5, 1, k]] }; }));

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
  assert.match(complet(g(synth(jours('2026-10-12', '2026-10-14'), [0, 1, 389]), { seance: 'rth' }), avec({ periode: 'asie' })).raison, /fenêtre de séance/, 'pas d\'Asie sur un graphe RTH');
  const tard = B.filter(b => b._date >= '2026-10-12').map(b => b._date === '2026-10-12' ? Object.assign({}, b, { m: b.m + 100 }) : b);
  assert.equal(cour(g(tard), avec({ periode: 'sem' })).partiel, '2026-10-12', 'lundi pris plus d\'une heure après son ouverture : partiel');
}

// 6b. A tick chart that does not start its week or month is completed from the candles' minute file,
// read once by fetch; masked until it is read, if the file does not reach the first business day, or
// if it has a gap of more than four days. A minute chart comes from that file: masked, nothing read.
{
  const B = synth(jours('2026-08-31', '2026-10-14')), fichier = S => ({ sessions: S.map(date => ({ date, bars: B.filter(b => b._date === date).map(({ _date, ...b }) => b) })) });
  const FICHIERS = {}, appels = [], attente = [];
  const D = charger({ HFQSymGuard: { histFile: (t, s) => t + '_' + s + '.json' },
    fetch: f => { appels.push(f); return new Promise(ok => attente.push(() => ok({ json: () => FICHIERS[f] }))); } })[0];
  const servir = async () => { attente.splice(0).forEach(x => x()); await new Promise(r => setImmediate(r)); };
  const tous = jours('2026-08-31', '2026-10-14'), M = avec({ periode: 'mois' }), W = avec({ periode: 'sem' });
  const plein = cour(g(B), M, D);
  const ticks = (Bc, sym, S = tous) => { FICHIERS['_footprint_eth_' + sym + '.json'] = fichier(S); return g(Bc, { sym, tf: '1000t' }); };

  // Chart from Tuesday 6/10: October and week 41 completed once the file is read, equal to the full chart.
  const G = ticks(B.filter(b => b._date >= '2026-10-06'), 'TK1');
  assert.equal(cour(G, M, D).partiel, '2026-10-06', 'masqué tant que le fichier n\'est pas lu');
  await servir();
  const C = cour(G, M, D);
  assert.equal(C.partiel, null, 'octobre complété');
  egal(C, reference(parDate(B, d => d >= '2026-10')), 'octobre complété');
  assert.deepEqual([plat(C), C.poc, C.vah, C.val], [plat(plein), plein.poc, plein.vah, plein.val], 'octobre complété = graphe entier');
  assert.equal(C.deb, 0, 'dessiné depuis la première barre du graphe');
  const G2 = ticks(B.filter(b => b._date >= '2026-10-13'), 'TK1');
  egal(cour(G2, W, D), reference(parDate(B, d => d >= '2026-10-12')), 'semaine 42 complétée par le lundi du fichier');
  assert.equal(appels.filter(f => f === '_footprint_eth_TK1.json').length, 1, 'fichier lu une fois');

  // A previous week opened by the chart's first session is completed too.
  const G6 = ticks(B.filter(b => b._date >= '2026-10-06'), 'TK6');
  complet(G6, avec({ periode: 'sem', hist: 1 }), D); await servir();
  const P6 = complet(G6, avec({ periode: 'sem', hist: 1 }), D).prec;
  assert.deepEqual(P6.map(R => R.cle), ['41'], 'semaine 41 précédente complétée');
  egal(P6[0], reference(parDate(B, d => d >= '2026-10-05' && d <= '2026-10-09')), 'semaine 41 entière');

  // Real full sessions redated from Monday 2/11, the chart holding the last two: the frame that reads
  // five sessions of the file stays a single slow frame, far from three in a row.
  const PL = db.sessions.filter(s => s.bars[0].m === 0 && s.bars[s.bars.length - 1].m >= 1370);
  const RS = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'].map((date, k) => ({ date, bars: PL[k % PL.length].bars }));
  const GR = ticks(RS.slice(5).flatMap(s => s.bars.map(b => Object.assign({ _date: s.date }, b))), 'TKR', []);
  FICHIERS['_footprint_eth_TKR.json'] = { sessions: RS };
  complet(GR, M, D); await servir();
  const images = []; let XR = null;
  for (let k = 0; k < 100 && !XR; k++) { const t = performance.now(); XR = D.calcul(GR, M); images.push(performance.now() - t); }
  assert.ok(!images.some((v, k) => k >= 2 && v > 8 && images[k - 1] > 8 && images[k - 2] > 8), 'pas trois images lentes de suite : ' + images.map(v => v.toFixed(1)).join(' '));
  assert.equal(XR.cour.partiel, null, 'novembre complété sur barres réelles');
  egal(XR.cour, reference(RS.flatMap(s => s.bars)), 'novembre complété = toutes les séances');
  console.log('  complétion de cinq séances réelles, images :', images.map(v => v.toFixed(1)).join(' '), 'ms');

  // Chart starting at the second minute of 6/10: the first minute comes from the file.
  const G3 = ticks(B.filter(b => b._date > '2026-10-06' || (b._date === '2026-10-06' && b.m >= 1)), 'TK2');
  cour(G3, M, D); await servir();
  egal(cour(G3, M, D), reference(parDate(B, d => d >= '2026-10')), 'minute manquante prise au fichier');

  // File without 1/10 (no earlier session either): masked. Gap 2/10 → 12/10: masked. Lone day missing: passes.
  const sans1 = tous.filter(d => d >= '2026-10-02'), G4 = ticks(B.filter(b => b._date >= '2026-10-06'), 'TK3', sans1);
  cour(G4, M, D); await servir();
  assert.equal(cour(G4, M, D).partiel, '2026-10-06', 'fichier sans le 1er : masqué');
  const G5 = ticks(B.filter(b => b._date >= '2026-10-13'), 'TK4', tous.filter(d => d < '2026-10-05' || d > '2026-10-09'));
  cour(G5, M, D); await servir();
  assert.equal(cour(G5, M, D).partiel, '2026-10-13', 'trou du 2 au 12 : masqué');

  // Minute chart starting on 6/10: masked, no fetch.
  const avant = appels.length;
  assert.equal(cour(g(B.filter(b => b._date >= '2026-10-06'), { sym: 'TK5' }), M, D).partiel, '2026-10-06', 'graphe en minutes : masqué');
  assert.equal(appels.length, avant, 'graphe en minutes : rien lu');
}

// 6c. Nothing displayed on missing data. Real whole sessions on the business days from Monday 2 November (winter
// time on both sides: Asia m ∈ [0, 540), Europe [540, 930), US [930, 1320)), on minute charts.
const PL = db.sessions.filter(s => s.bars[0].m === 0 && s.bars.at(-1).m >= 1370);
const NOV = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10'].map((date, k) => ({ date, bars: PL[k % PL.length].bars }));
const aplat = S => S.flatMap(s => s.bars.map(b => Object.assign({ _date: s.date }, b)));
const coupe = (s, f) => ({ date: s.date, bars: s.bars.filter(f) });
const trous = date => Array.from({ length: 8 }, () => ({ _trou: true, _date: date, m: 0, o: 7000, h: 7000, l: 7000, c: 7000, lv: [] }));
const FN = Object.fromEntries(['us', 'eu', 'asie'].map(T => { const [a, z] = E.outils.bornesET(T, '2026-11-04').map(v => (v - 1080 + 1440) % 1440); return [T, entre(a, z <= a ? z + 1440 : z)]; }));
const cles = X => X.prec.map(R => R.cle);
// Caption and painted rectangles of a chart whose compute is done.
const vue = (B, r, o = {}) => { const G = g(B, Object.assign({ premiere: 0 }, o)), X = complet(G, r); rec.length = 0; E.dessine(G, r); return { X, textes: rec.filter(x => x.k === 'texte').map(x => x.s), rects: rec.filter(x => x.k === 'rect').length }; };
{
  assert.ok(PL.length >= 1, 'une séance entière dans l\'archive');
  assert.deepEqual(['asie', 'eu', 'us'].map(T => [0, 540, 930].findIndex(m => FN[T](m))), [0, 1, 2], 'fenêtres d\'hiver');
  const X = (B, r) => complet(g(B, { premiere: 0 }), r);

  // Joined at 05:40 ET on Monday 2 (m 700, Europe opened at m 540): its session and its Europe are left out of the
  // previous periods, its US session, which opens later, is kept whole. Joined so on the current day: masked, and
  // the caption says it.
  const L = aplat([coupe(NOV[0], b => b.m >= 700), NOV[1], NOV[2]]);
  assert.deepEqual(cles(X(L, avec({ hist: 2 }))), ['2026-11-03'], 'séance du 2 prise à 05:40 omise');
  assert.deepEqual(cles(X(L, avec({ periode: 'eu', hist: 2 }))), ['2026-11-03'], 'Europe du 2 omise');
  const U = X(L, avec({ periode: 'us', hist: 2 })).prec;
  assert.deepEqual(U.map(R => R.cle), ['2026-11-02', '2026-11-03'], 'RTH du 2 gardée');
  egal(U[0], reference(NOV[0].bars, FN.us), 'RTH du 2 entière');
  const T = aplat([NOV[0], coupe(NOV[1], b => b.m >= 700)]);
  for (const [periode, titre] of [['jour', 'Séance 2026-11-03'], ['eu', 'Séance Europe 2026-11-03']]) {
    const V = vue(T, avec({ periode }));
    assert.deepEqual([V.textes, V.rects], [[titre + ' · masqué : partiel'], 0], periode + ' prise à 05:40 : masquée, légende');
  }
  assert.equal(vue(T, avec({ periode: 'us' })).X.cour.partiel, null, 'RTH du 3 entière');

  // A previous session cut at 07:37 ET (m 817): its session and its Europe are left out, its Asia kept; it has no RTH.
  const C = aplat([NOV[0], coupe(NOV[1], b => b.m < 818), NOV[2]]);
  assert.deepEqual(cles(X(C, avec({ hist: 2 }))), ['2026-11-02'], 'séance coupée à 07:37 omise');
  assert.deepEqual(cles(X(C, avec({ periode: 'eu', hist: 2 }))), ['2026-11-02'], 'Europe coupée omise');
  assert.deepEqual(cles(X(C, avec({ periode: 'asie', hist: 2 }))), ['2026-11-02', '2026-11-03'], 'Asie entière gardée');
  assert.deepEqual(cles(X(C, avec({ periode: 'us', hist: 2 }))), ['2026-11-02'], 'pas de RTH le 3');
  // A holiday early close at 13:15 ET is a whole session, and its RTH too.
  assert.deepEqual(cles(X(aplat([NOV[0], coupe(NOV[1], b => b.m < 1155), NOV[2]]), avec({ periode: 'us', hist: 2 }))), ['2026-11-02', '2026-11-03'], 'RTH close à 13:15 gardée');
  // A TT session straddling the chart's open, 16:00 → 18:30 ET: its part after the open lacks its first hour, masked;
  // 17:00 → 18:30 starts in the maintenance break, so the open starts it.
  const chevauche = debut => cour(g(aplat(NOV.slice(0, 2))), avec({ periode: 'us' }), charger({ HFQSessionsMonde: { bornes: () => [{ id: 'us', debut, fin: 66600 }] } })[0]).partiel;
  assert.deepEqual([chevauche(57600), chevauche(61200)], [true, null], 'session à cheval sur l\'ouverture');
  // The current RTH, once over, must have run to its end: cut at 10:40 ET and resumed at 16:10, it is masked;
  // still in progress at 10:40, it is drawn.
  assert.equal(X(aplat([NOV[0], coupe(NOV[1], b => b.m <= 1000 || b.m >= 1330)]), avec({ periode: 'us' })).cour.partiel, true, 'RTH finie tronquée : masquée');
  assert.equal(X(aplat([NOV[0], coupe(NOV[1], b => b.m <= 1000)]), avec({ periode: 'us' })).cour.partiel, null, 'RTH en cours : tracée');

  // Weeks: a session cut at 07:37 ET, a missing day (TT's filler bars, also outside the RTH window), a session joined
  // late or a weekday without a session make the week incomplete, named in the caption; a full CME closure from
  // TT's calendar does not. A week that does not start on its Monday further on is partial.
  const W = avec({ periode: 'sem' }), WR = avec({ periode: 'sem', rth: true });
  const TR = [...aplat([NOV[0]]), ...trous('2026-11-03'), ...aplat([NOV[2]])];
  const cas = [['coupée', aplat([NOV[0], coupe(NOV[1], b => b.m < 818), NOV[2]]), W, '2026-11-03'], ['comblée', TR, W, '2026-11-03'],
    ['comblée, RTH seul', TR, WR, '2026-11-03'], ['entamée à 05:40', aplat([NOV[0], coupe(NOV[1], b => b.m >= 700), NOV[2]]), W, '2026-11-03'],
    ['mardi et mercredi sans séance', aplat([NOV[0], NOV[3]]), W, '2026-11-05'], ['mardi sans séance', aplat([NOV[0], NOV[2]]), W, '2026-11-04'],
    ['clôture anticipée à 13:15', aplat([NOV[0], coupe(NOV[1], b => b.m < 1155), NOV[2]]), W, null]];
  for (const [nom, B, r, date] of cas) assert.deepEqual([X(B, r).cour.incomplet, X(B, r).cour.partiel], [date, null], 'semaine ' + nom);
  assert.equal(X(aplat([...NOV.slice(0, 5), NOV[6]]), W).cour.partiel, '2026-11-10', 'semaine 46 sans son lundi : partielle');
  const V = vue(TR, W);
  assert.deepEqual([V.textes, V.rects], [['Semaine 45 · masqué : séance manquante ou incomplète le 2026-11-03'], 0], 'jour manquant : légende');
  assert.deepEqual(cles(X([...TR, ...aplat(NOV.slice(3))], avec({ periode: 'sem', hist: 1 }))), [], 'semaine précédente comblée omise');
  assert.deepEqual(cles(X(aplat(NOV), avec({ periode: 'sem', hist: 1 }))), ['45'], 'semaine précédente entière gardée');

  // Footprint, without dates: a first session joined at 05:40 ET is masked, "partial" alone; the next one is drawn.
  const sans = B => B.map(b => { const c = Object.assign({}, b); delete c._date; return c; });
  const F = sans(aplat([coupe(NOV[0], b => b.m >= 700)]));
  assert.deepEqual(vue(F, defaut).textes, ['Séance · masqué : partiel'], 'footprint pris à 05:40 : masqué');
  const F2 = X(sans(aplat([coupe(NOV[0], b => b.m >= 700), NOV[1]])), avec({ hist: 1 }));
  assert.deepEqual([F2.prec.length, F2.cour.partiel], [0, null], 'footprint : séance suivante tracée');
}

// 6d. Tick charts: a session, or its Europe, joined at 05:40 ET is completed from the one-minute file, equal to the
// whole one; masked if the file starts the session late, stops more than an hour before the first tick bar, or
// lacks the day. A week completed from the file must get whole sessions from it, and no two missing weekdays.
{
  const FICHIERS = {}, attente = [];
  const D = charger({ HFQSymGuard: { histFile: (t, s) => t + '_' + s + '.json' },
    fetch: f => new Promise(ok => attente.push(() => ok({ json: () => FICHIERS[f] }))) })[0];
  const servir = async () => { attente.splice(0).forEach(x => x()); await new Promise(r => setImmediate(r)); };
  const ticks = (B, sym, S) => { FICHIERS['_footprint_eth_' + sym + '.json'] = { sessions: S }; return g(B, { sym, tf: '1000t', premiere: 0 }); };
  const du4 = (f, S = NOV) => S.map(s => s.date === '2026-11-04' ? coupe(s, f) : s), mer = coupe(NOV[2], b => b.m >= 700), T = aplat([mer]);
  const G = { ok: ticks(T, 'N1', NOV), tard: ticks(T, 'N2', du4(b => b.m >= 300)), court: ticks(T, 'N3', du4(b => b.m < 500)), sans: ticks(T, 'N4', NOV.filter(s => s.date !== '2026-11-04')) };
  const J = defaut, U = avec({ periode: 'eu' });
  for (const x of Object.values(G)) { cour(x, J, D); cour(x, U, D); }
  assert.equal(cour(G.ok, J, D).partiel, true, 'masqué tant que le fichier n\'est pas lu');
  await servir();
  const C = cour(G.ok, J, D);
  assert.equal(C.partiel, null, 'séance du 4 complétée');
  egal(C, reference(NOV[2].bars), 'séance du 4 complétée = séance entière');
  egal(cour(G.ok, U, D), reference(NOV[2].bars, FN.eu), 'Europe du 4 complétée');
  assert.equal(cour(G.tard, J, D).partiel, true, 'fichier qui prend le 4 à 23:00 : séance masquée');
  const E2 = cour(G.tard, U, D);
  assert.equal(E2.partiel, null); egal(E2, reference(NOV[2].bars, FN.eu), 'fichier qui prend le 4 à 23:00 : Europe complétée');
  for (const nom of ['court', 'sans']) assert.deepEqual([cour(G[nom], J, D).partiel, cour(G[nom], U, D).partiel], [true, true], 'fichier ' + nom + ' : masqué');

  // Week from a tick chart: from Wednesday 4, masked if the file cuts Tuesday 3 at 07:37 ET or starts it at 23:00,
  // or, joined at 05:40 on the 4th, lacks Wednesday; from Friday 6, masked if Tuesday and Wednesday are both
  // missing, and if only Wednesday is; completed across Good Friday, a full CME closure in TT's calendar.
  const Wk = avec({ periode: 'sem' }), d4 = aplat(NOV.slice(2, 5)), d4b = aplat([mer, NOV[3], NOV[4]]), d6 = aplat([NOV[4]]);
  const du3 = f => NOV.map(s => s.date === '2026-11-03' ? coupe(s, f) : s);
  const cas = [['coupé', d4, du3(b => b.m < 818), '2026-11-04'], ['tard', d4, du3(b => b.m >= 300), '2026-11-04'],
    ['sans le mercredi', d4b, NOV.filter(s => s.date !== '2026-11-04'), '2026-11-04'], ['entier', d4b, NOV, null],
    ['deux jours', d6, [NOV[0], NOV[3]], '2026-11-06'], ['un jour', d6, [NOV[0], NOV[1], NOV[3]], '2026-11-06']];
  const GW = cas.map(([, B, S], k) => ticks(B, 'NW' + k, S));
  GW.forEach(x => cour(x, Wk, D)); await servir();
  cas.forEach(([nom, , , partiel], k) => assert.equal(cour(GW[k], Wk, D).partiel, partiel, 'fichier ' + nom));
  const AV = ['2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-06'].slice(2).map((date, k) => ({ date, bars: NOV[k].bars })), GA = ticks(aplat([AV[2]]), 'GF', AV.slice(0, 2));
  cour(GA, avec({ periode: 'mois' }), D); await servir();
  egal(cour(GA, avec({ periode: 'mois' }), D), reference(aplat(AV)), 'avril complété par-dessus le Vendredi saint');
  egal(cour(GW[3], Wk, D), reference(aplat(NOV.slice(0, 5))), 'semaine complétée depuis le 4 à 05:40');
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
  const RT = cour(g(trou), defaut);
  assert.deepEqual([RT.nb, RT.partiel], [2, true], 'barre de comblement ignorée, séance masquée');
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

// 9b. Bars inserted before the last one read (tick history filling a missing day): the shared session
// state starts over and the profiles are those of a fresh computation.
{
  const trou = bars.filter(b => b._date !== db.sessions[1].date), r = avec({ periode: 'jour', hist: 4 });
  const X = B => complet(g(B, { sym: 'INS', premiere: 0 }), r), vu = R => [resume(R.cour)].concat(R.prec.map(resume));
  X(trou);
  assert.deepEqual(vu(X(bars)), vu(complet(g(bars, { premiere: 0 }), r)), 'insertion = calcul complet');
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
  assert.deepEqual(dessin(avec({ periode: 'us' }), g(synth(jours('2026-10-12', '2026-10-14'), [930, 931, 932]))).textes.map(x => x.s.split(' ').slice(0, 2).join(' ')),
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

  // A partial month, or one with a bar lacking levels, is not drawn; its caption says why, even without labels.
  const P = B.slice(3); P[P.length - 1] = Object.assign({}, P[P.length - 1], { lv: [] });
  const DP = dessin(avec({ periode: 'mois', etiq: false }), g(P));
  assert.deepEqual(DP.textes.map(x => x.s), ['Mois 2026-10 · masqué : partiel, depuis le 2026-10-13, 17 % des barres sans niveaux'], 'mises en garde');
  assert.ok(!DP.rects.length && !DP.traits.some(x => x.p.length), 'période incomplète masquée');
  const B1 = B.slice(); B1[B1.length - 1] = Object.assign({}, B1[B1.length - 1], { lv: [] });
  assert.ok(!dessin(avec({ periode: 'jour' }), g(B1)).rects.length, 'séance à barre sans niveaux masquée');
  // Maximum width caps the fullest row, pinned to the right edge or on its period.
  const plusLarge = D => Math.max(...D.rects.filter(x => x.c === r.achatC).map(x => x.w + D.rects.find(y => y.c === r.venteC && y.y === x.y).w));
  assert.ok(proche(plusLarge(dessin(avec({ periode: 'sem', rangee: 1, largeurMax: 10 }))), 100), 'bord droit plafonné à 10 % du graphe');
  assert.ok(proche(plusLarge(dessin(avec({ periode: 'sem', rangee: 1, largeur: 80 }))), 800), 'bord droit jusqu\'à 80 %');
  const etroit = g(H, { premiere: 0, cadre: { gauche: 0, droite: 20, haut: 0, bas: 1e5, largeur: 20, hauteur: 1e5 } });
  assert.ok(proche(plusLarge(dessin(avec({ hist: 2, rangee: 1, place: 'periode', largeurMax: 5 }), etroit)), 1), 'sur sa période, plafonné à 5 % du graphe');
  assert.ok(proche(plusLarge(dessin(avec({ hist: 2, rangee: 1, place: 'periode', sens: 'passe', largeurMax: 5 }), etroit)), 1), 'depuis la clôture, plafonné aussi');
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
  // Sessions cut short are not drawn, so not compared.
  const prec = complet(g(bars, { premiere: 0 }), avec({ hist: 9 })).prec.concat([cour(g(), defaut)]), parDate = new Map(prec.map(R => [R.cle, R]));
  const vus = db.sessions.filter(s => parDate.has(s.date));
  assert.ok(vus.length >= 2, 'au moins deux séances comparées');
  vus.forEach(s => {
    const tt = ctx.HFQCompositeVP.buildFromBars(s.bars, { tick: 0.25, vaPct: 0.7 }).profile, R = parDate.get(s.date);
    assert.deepEqual([R.poc, R.vah, R.val].map(t => t * 0.25), [tt.poc, tt.vah, tt.val], 'comme le SVP de TT, ' + s.date);
  });
} else console.warn('payload de TT introuvable, comparaison avec son profil sautée :', PAYLOAD);

// 13. Budget: a month of one-minute ETH sessions with five levels per bar, the month and every previous
// session drawn by two instances. The first compute spans several frames, neither instance over 8 ms three
// frames in a row (TT's suspension rule, so a lone GC pause does not fail the bench), and lands on the
// brute-force profiles; then cached frames.
{
  const B = jours('2026-09-22', '2026-10-16').flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => {
    const b = Math.round((7000 + 20 * Math.sin(s + m / 200)) * 4) / 4;
    return { _date: date, m, o: b, h: b + 1, l: b, c: b + 0.25, lv: [0, 1, 2, 3, 4].map(k => [b + k * 0.25, 1 + (m % 7), 2 + (k % 3)]) };
  }));
  const G = g(B, { sym: 'MES', premiere: 0, cadre: { gauche: 0, droite: 1000, haut: 0, bas: 600, largeur: 1000, hauteur: 600 }, x: i => i * 1000 / B.length, y: v => 600 - (v - 6970) * 10 });
  const rM = avec({ periode: 'mois', achatC: '#000001', venteC: '#000002' }), rJ = avec({ hist: 30 });
  let images = 0, pire = 0, prets, suspendue = false;
  const lents = new Map();
  do {
    rec.length = 0;
    for (const [D, r] of [[defs[2], rM], [E, rJ]]) {
      const t = performance.now(); D.dessine(G, r); const ms = performance.now() - t, l = ms > 8 ? (lents.get(D) || 0) + 1 : 0;
      pire = Math.max(pire, ms); lents.set(D, l); suspendue ||= l >= 3;
    }
    images++;
    prets = new Set(rec.filter(x => x.k === 'rect').map(x => x.c)).size;
  } while (prets < 4 && images < 100);
  assert.ok(images > 1 && !suspendue, 'calcul étalé : ' + images + ' images, pire ' + pire.toFixed(2) + ' ms');
  egal(cour(G, rM, defs[2]), reference(parDate(B, d => d >= '2026-10')), 'octobre, calcul étalé');
  const X = complet(G, rJ);
  assert.equal(X.prec.length, 18, 'dix-huit séances précédentes');
  egal(X.prec[0], reference(parDate(B, d => d === '2026-09-22')), 'première séance');
  const t1 = performance.now(); for (let k = 0; k < 50; k++) { defs[2].dessine(G, rM); E.dessine(G, rJ); } const chaud = (performance.now() - t1) / 100;
  assert.ok(chaud < 2, 'image en cache : ' + chaud.toFixed(3) + ' ms');
  // NQ-like load: eighty levels per one-minute bar, a session reads in 10 ms or more in one block. The cold
  // compute of "session + nine previous" and the live session, its last bar moving every frame, stay within
  // TT's rule: never three frames over 8 ms in a row.
  const NQ = jours('2026-10-01', '2026-10-14').flatMap((date, s) => Array.from({ length: 1380 }, (_, m) => {
    const b = Math.round((20000 + 60 * Math.sin(s + m / 150)) * 4) / 4;
    return { _date: date, m, o: b, h: b + 10, l: b - 10, c: b, lv: Array.from({ length: 80 }, (_, k) => [b - 10 + k * 0.25, 1 + (m + k) % 5, 1 + (k % 4)]) };
  }));
  const GN = Bn => g(Bn, { sym: 'NQL', premiere: 0, cadre: { gauche: 0, droite: 1000, haut: 0, bas: 600, largeur: 1000, hauteur: 600 }, x: i => i * 1000 / Bn.length, y: v => 600 - (v - 19900) * 2 });
  const rN = avec({ hist: 9 }), suite = L => L.some((v, k) => k >= 2 && v > 8 && L[k - 1] > 8 && L[k - 2] > 8);
  const froid = [];
  for (let k = 0, X = null; k < 400 && !X; k++) { const t = performance.now(); X = defs[3].calcul(GN(NQ), rN); froid.push(performance.now() - t); }
  assert.ok(!suite(froid) && Math.max(...froid) < 30, 'NQ à froid : lecture étalée, pas trois images lentes de suite : ' + froid.map(v => v.toFixed(1)).join(' '));
  const direct = [];
  for (let k = 1; k <= 30; k++) {
    const Bn = NQ.slice(), d = Bn[Bn.length - 1];
    Bn[Bn.length - 1] = Object.assign({}, d, { c: d.c + k * 0.25, lv: d.lv.map(([p, bi, a]) => [p, bi + k, a]) });
    const t = performance.now(); defs[3].calcul(GN(Bn), rN); direct.push(performance.now() - t);
  }
  assert.ok(Math.max(...direct.slice(1)) < 4, 'NQ en direct : la dernière barre seule est relue, pire ' + Math.max(...direct.slice(1)).toFixed(2) + ' ms');
  egal(cour(GN(NQ), defaut, defs[3]), reference(parDate(NQ, d => d === '2026-10-14')), 'NQ : séance en cours exacte');
  // A tick chart holding the last two sessions: October completed from a minute file of eight NQ sessions,
  // read over several frames.
  const fichierNQ = { sessions: jours('2026-10-01', '2026-10-14').map(date => ({ date, bars: NQ.filter(b => b._date === date).map(({ _date, ...b }) => b) })) };
  const DN = charger({ HFQSymGuard: { histFile: (t, s) => t + '_' + s + '.json' }, fetch: () => Promise.resolve({ json: () => fichierNQ }) })[2];
  const GT = g(NQ.filter(b => b._date >= '2026-10-13'), { sym: 'NQF', tf: '1000t' }), rMo = avec({ periode: 'mois' });
  DN.calcul(GT, rMo); await new Promise(r => setImmediate(r));
  const fic = []; let XF = null;
  for (let k = 0; k < 400 && !XF; k++) { const t = performance.now(); XF = DN.calcul(GT, rMo); fic.push(performance.now() - t); }
  assert.ok(!suite(fic) && Math.max(...fic) < 30, 'NQ : fichier minute lu sur plusieurs images : ' + fic.map(v => v.toFixed(1)).join(' '));
  egal(XF.cour, reference(NQ), 'NQ : octobre complété par le fichier');
  console.log('  NQ, 80 niveaux par barre : froid', froid.length, 'images, pire', Math.max(...froid).toFixed(1), 'ms ; fichier', fic.length, 'images, pire', Math.max(...fic).toFixed(1), 'ms ; direct, pire', Math.max(...direct.slice(1)).toFixed(2), 'ms');
  const R = cour(g(), defaut), S = cour(g(), avec({ periode: 'sem' })), U = cour(g(), avec({ periode: 'us' }));
  console.log('OK', bars.length, 'barres ES,', db.sessions.length, 'séances | séance POC', (R.poc * 0.25).toFixed(2), 'VA', (R.val * 0.25).toFixed(2), '-', (R.vah * 0.25).toFixed(2),
    '| RTH POC', (U.poc * 0.25).toFixed(2), '| semaine POC', (S.poc * 0.25).toFixed(2), '|', B.length, 'barres synthétiques,', images, 'images, pire', pire.toFixed(2), 'ms, chaud', chaud.toFixed(3), 'ms');
}
