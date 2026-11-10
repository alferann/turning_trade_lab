// Self-check for extensions/ligne_distance.js: a horizontal line at an offset from the last
// price, from the right edge to the most recent visible bar that touches it, on real ES bars
// baked by Turning Trade and on synthetic bars.
// Run: node tests/ligne_distance_test.mjs   (from the repo root; TT_DATA overrides the data folder)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import path from 'node:path';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = fs.readFileSync(path.join(RACINE, 'extensions/ligne_distance.js'), 'utf8');
const DB = path.join(process.env.TT_DATA || path.join(process.env.HOME, '.local/share/TurningTrade'), '_footprint_db_rec_ES.json');

const defs = [];
vm.runInContext(SRC, vm.createContext({ HFQExt: { etude(d) { defs.push(d); return true; } }, console }));
assert.equal(defs.length, 1);
const E = defs[0];
assert.equal(E.id, 'ligne-distance', 'id stable');
assert.deepEqual([...E.graphes], ['bougies', 'footprint']);
const defaut = Object.fromEntries(E.reglages.map(x => [x.k, x.defaut]));
const avec = o => Object.assign({}, defaut, o);

// Fake chart: column width `col` px, bar `i` at x = (i - gauche) * col, prices projected as is.
// `o.premiere`/`o.derniere` default to the whole history, as the footprint page passes them.
const graphe = (B, o = {}) => {
  const col = o.col || 10, g0 = o.gauche || 0, traits = [], textes = [], lus = { barre: 0, x: 0 };
  return Object.assign({ n: B.length, tick: 0.25, echelle: 1, premiere: 0, derniere: B.length - 1,
    cadre: { gauche: 0, droite: 1000, haut: -1e9, bas: 1e9 },
    barre: i => { lus.barre++; return B[i]; }, x: i => { lus.x++; return (i - g0) * col; }, y: v => v,
    // Points copied out of the study's vm realm, so deepEqual compares plain arrays.
    trait(p, opt) { traits.push({ p: Array.from(p, q => [...q]), opt: Object.assign({}, opt, opt.pointille && { pointille: [...opt.pointille] }) }); }, texte(x, y, t, opt) { textes.push({ x, y, t, opt }); },
    traits, textes, lus }, o);
};
const barre = (l, h, c, extra) => Object.assign({ o: c, h, l, c, lv: [] }, extra);

// 1. Real ES bars: both levels match a brute-force search over the bars on screen.
{
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const B = db.sessions.flatMap(s => s.bars).slice(-600);
  let contacts = 0, butees = 0;
  for (const d of [4, 20, 80, 400]) {
    // Frame of 1000 px, 2 px per bar, bars 100..599 on screen.
    const g = graphe(B, { col: 2, gauche: 100, tick: db.tick || 0.25 });
    const R = E.calcul(g, avec({ hautD: d, basD: d }));
    const c = B[B.length - 1].c;
    assert.equal(R.c, c);
    for (const v of R.L) {
      assert.equal(v.p, c + v.s * d * g.tick, 'prix du niveau à ' + d + ' ticks');
      let ref = -1;
      for (let i = B.length - 1; i >= 100 && ref < 0; i--) if (!B[i]._trou && B[i].l <= v.p && v.p <= B[i].h) ref = i;
      assert.equal(v.i, ref, 'bougie de contact à ' + d + ' ticks, côté ' + v.s);
      ref < 0 ? butees++ : contacts++;
    }
    E.dessine(g, avec({ hautD: d, basD: d }));
    assert.equal(g.traits.length, 2);
    g.traits.forEach((t, k) => {
      const v = R.L[k];
      assert.deepEqual(t.p, [[1000, v.p], [v.i >= 0 ? (v.i - 100) * 2 : 0, v.p]], 'du bord droit au contact ou au bord gauche');
    });
  }
  console.log('OK ES réel |', contacts, 'contacts,', butees, 'butées au bord gauche');
}

// 2. Wick included, current bar included, filler bars skipped, no contact: left edge, price still written.
{
  // Last price 100. +8 ticks = 102: touched by the wick of bar 1 only. -8 ticks = 98: bar 2 is a filler, bar 0 touches.
  const B = [barre(97, 99, 98), barre(100, 102, 100.5), barre(97, 103, 100, { _trou: true }), barre(99.5, 100.5, 100)];
  const r = avec({ hautD: 8, basD: 8 });
  let g = graphe(B);
  assert.deepEqual(Array.from(E.calcul(g, r).L, v => [v.p, v.i]), [[102, 1], [98, 0]]);
  // Current bar counts: its own wick reaches +2 ticks.
  assert.deepEqual(Array.from(E.calcul(g, avec({ hautD: 2, basD: 2 })).L, v => [v.p, v.i]), [[100.5, 3], [99.5, 3]]);
  // Distance 0: the line sits on the price, stopped by the current bar.
  assert.deepEqual(Array.from(E.calcul(g, avec({ hautD: 0, bas: false })).L, v => [v.p, v.i]), [[100, 3]]);
  // Nothing on screen reaches +/- 40 ticks.
  g = graphe(B);
  E.dessine(g, avec({ hautD: 40, basD: 40 }));
  assert.deepEqual(g.traits.map(t => t.p), [[[1000, 110], [0, 110]], [[1000, 90], [0, 90]]], 'butée au bord gauche');
  assert.deepEqual(g.textes.map(t => t.t), ['110.00  +40 t', '90.00  −40 t'], 'prix toujours écrit');
  assert.deepEqual(g.textes.map(t => [t.x, t.opt.align, t.opt.base]), [[997, 'right', 'bottom'], [997, 'right', 'top']]);
}

// 3. Units, sides, label, style.
{
  const B = [barre(90, 110, 100), barre(99.5, 100.5, 100)];
  let g = graphe(B);
  E.dessine(g, avec({ unite: 'points', hautD: 5, basD: 3, style: 'plein', ep: 2, op: 0.5 }));
  assert.deepEqual(g.traits.map(t => t.p), [[[1000, 105], [0, 105]], [[1000, 97], [0, 97]]], 'points, contact sur la barre 0');
  assert.deepEqual(g.textes.map(t => t.t), ['105.00  +5 pt', '97.00  −3 pt']);
  assert.deepEqual(g.traits.map(t => [t.opt.couleur, t.opt.epaisseur, t.opt.opacite, t.opt.pointille]),
    [[defaut.hautC, 2, 0.5, null], [defaut.basC, 2, 0.5, null]]);
  g = graphe(B);
  E.dessine(g, avec({ haut: false, etiq: false }));
  assert.equal(g.traits.length, 1, 'un seul côté');
  assert.equal(g.traits[0].p[0][1], 95);
  assert.equal(g.textes.length, 0, 'sans étiquette');
  assert.deepEqual(g.traits[0].opt.pointille, [6, 4], 'tirets par défaut');
  // A fractional distance lands on the tick grid; a tick of 0.1 survives float noise.
  g = graphe([barre(0.2, 0.4, 0.3), barre(0.1, 0.1, 0.1)], { tick: 0.1 });
  const v = E.calcul(g, avec({ hautD: 2.4, bas: false })).L[0];
  assert.ok(Math.abs(v.p - 0.3) < 1e-9 && v.i === 0, 'grille du tick');
  // Level off the frame: nothing drawn. No bars: nothing either.
  g = graphe(B, { cadre: { gauche: 0, droite: 1000, haut: 96, bas: 104 } });
  E.dessine(g, defaut);
  assert.equal(g.traits.length + g.textes.length, 0, 'niveaux hors cadre');
  g = graphe([]);
  E.dessine(g, defaut);
  assert.equal(g.traits.length, 0, 'sans barres');
}

// 4. Footprint: premiere 0, derniere n - 1, frame of 1000 px. Only bars on screen are read,
//    a contact left of the frame is not one, a bar right of the frame neither.
{
  const n = 60000, B = Array.from({ length: n }, () => barre(99.75, 100.25, 100));
  B[10] = barre(99, 110, 100);        // touches +20 ticks, far left of the frame
  B[n - 50] = barre(99, 105, 100);    // touches +20 ticks, on screen
  B[n - 3] = barre(95, 101, 100);     // touches -20 ticks, right of the frame
  B[n - 30] = barre(95, 101, 100);    // touches -20 ticks, on screen
  // Bars n-110..n-10 on screen (10 px each), the last 9 bars right of the frame.
  let g = graphe(B, { gauche: n - 110 });
  E.dessine(g, defaut);
  assert.deepEqual(g.traits.map(t => t.p), [[[1000, 105], [600, 105]], [[1000, 95], [800, 95]]]);
  assert.ok(g.lus.barre <= 102 && g.lus.x <= 60, 'barres à l\'écran seulement : ' + g.lus.barre + ' barres, ' + g.lus.x + ' g.x');
  // Scrolled so that bar n-50 is left of the frame and the last bars are back on screen: the
  // upper line runs to the left edge, the lower one stops at n-3, more recent than n-30.
  g = graphe(B, { gauche: n - 45 });
  assert.deepEqual(Array.from(E.calcul(g, defaut).L, v => v.i), [-1, n - 3]);
  // Three frames in a row stay far under the 8 ms budget on a fully zoomed-out footprint.
  g = graphe(B, { col: 1000 / n });
  const t = [0, 0, 0].map(() => { const t0 = performance.now(); E.dessine(g, avec({ hautD: 4000, basD: 4000 })); return performance.now() - t0; });
  assert.ok(Math.min(...t) < 8, 'budget par image : ' + t.map(x => x.toFixed(1)).join(', ') + ' ms');
  console.log('OK footprint |', n, 'barres, pire balayage', Math.max(...t).toFixed(1), 'ms');
}

console.log('OK ligne_distance');
