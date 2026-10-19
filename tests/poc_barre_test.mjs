// Self-check for extensions/poc_barre.js: one segment per bar at its POC, across the candle
// body, on real ES bars baked by Turning Trade and on synthetic ties.
// Run: node tests/poc_barre_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/poc_barre.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
const bars = db.sessions.flatMap(s => s.bars);

const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console }));
assert.equal(defs.length, 1);
const E = defs[0];
assert.equal(E.id, 'poc-barre', 'id stable');
assert.deepEqual([...E.graphes], ['bougies']);
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));

// Same level reader as hfq-ext.js: [price, bid, ask].
const niveaux = b => { const lv = b && b.lv || []; return { n: lv.length, prix: k => lv[k][0], bid: k => lv[k][1] || 0, ask: k => lv[k][2] || 0,
  deltaTotal: () => lv.reduce((s, l) => s + (l[2] || 0) - (l[1] || 0), 0) }; };
// Column width 10 px, prices projected as is.
const dessine = (B, r = defaut, o = {}) => {
  const traits = [];
  E.dessine(Object.assign({ premiere: 0, derniere: B.length - 1, cadre: { haut: -1e9, bas: 1e9 }, niveaux: i => niveaux(B[i]),
    x: i => i * 10, y: v => v, trait(p, opt) { traits.push({ p, opt }); } }, o), r);
  return traits;
};
// Segments of one stroke: point pairs separated by a non-finite point.
const segments = t => { const s = []; for (let k = 0; k < t.p.length; k += 3) { assert.ok(isNaN(t.p[k + 2][0]), 'séparateur'); s.push([t.p[k], t.p[k + 1]]); } return s; };
// Reference POC by brute force: highest bid + ask, lowest price on a tie.
const reference = b => { let p = null, m = 0; for (const [px, bi, a] of b.lv || []) { const v = bi + a; if (v > m || (v === m && p !== null && px < p)) { m = v; p = px; } } return p; };

// 1. Real ES bars: one segment per bar with levels, at its POC, 6.2 px wide, centred on the bar.
{
  const B = bars.slice(-500);
  const [A, V] = dessine(B);
  assert.equal(V.p.length, 0, 'sans teinte, une seule couleur');
  assert.equal(A.opt.couleur, defaut.couleur);
  assert.equal(A.opt.epaisseur, defaut.epais);
  const S = segments(A), avec = B.map((b, i) => [b, i]).filter(([b]) => reference(b) !== null);
  assert.equal(S.length, avec.length, 'un trait par barre à niveaux');
  avec.forEach(([b, i], k) => {
    const [[x0, y0], [x1, y1]] = S[k];
    assert.equal(y0, reference(b), 'POC barre ' + i);
    assert.equal(y1, y0, 'trait horizontal');
    assert.ok(Math.abs(x0 - (i * 10 - 3.1)) < 1e-9 && Math.abs(x1 - (i * 10 + 3.1)) < 1e-9, 'largeur du corps, barre ' + i);
  });
  const egalites = avec.filter(([b]) => { const v = b.lv.map(l => l[1] + l[2]), m = Math.max(...v); return v.filter(x => x === m).length > 1; }).length;
  console.log('OK ES réel |', S.length, 'traits sur', B.length, 'barres,', egalites, 'POC ex aequo');
}

// 2. Ties: the lowest price whatever the level order; no levels or no volume, no segment.
{
  const lv = [[100, 5, 5], [100.25, 2, 8], [100.5, 1, 1], [99.75, 0, 0]];
  const B = [{ lv }, { lv: lv.slice().reverse() }, { lv: [], _trou: true }, { lv: [[101, 0, 0]] }];
  const S = segments(dessine(B)[0]);
  assert.deepEqual(S.map(s => s[0][1]), [100, 100], 'ex aequo : prix le plus bas, dans les deux ordres');
  assert.deepEqual(S.map(s => s[0][0] + 3.1), [0, 10], 'barres sans niveaux ni volume sautées');
}

// 3. Delta tint: buyers (delta >= 0) in one stroke, sellers in the other.
{
  const B = [{ lv: [[100, 1, 9]] }, { lv: [[100, 9, 1]] }, { lv: [[100, 5, 5]] }];
  const [A, V] = dessine(B, Object.assign({}, defaut, { delta: true }));
  assert.equal(A.opt.couleur, defaut.achat);
  assert.equal(V.opt.couleur, defaut.vente);
  assert.deepEqual(segments(A).map(s => s[0][0] + 3.1), [0, 20], 'acheteur et delta nul');
  assert.deepEqual(segments(V).map(s => s[0][0] + 3.1), [10], 'vendeur');
}

// 4. Narrow columns keep TT's 1.2 px minimum body; POCs off the frame are skipped.
{
  const B = [{ lv: [[100, 1, 1]] }, { lv: [[200, 1, 1]] }];
  const S = segments(dessine(B, defaut, { x: i => i, cadre: { haut: 0, bas: 150 } })[0]);
  assert.equal(S.length, 1, 'POC hors cadre sauté');
  assert.ok(Math.abs(S[0][1][0] - S[0][0][0] - 1.2) < 1e-9, 'corps minimal de 1,2 px');
}

console.log('OK poc_barre');
