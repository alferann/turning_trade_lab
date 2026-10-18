// English coverage for every study in extensions/: each name, description, setting
// label and option shown in TT's study panel needs an English entry, registered by
// the study through HFQI18n.dict('en', ...) or already in TT's own dictionary, and
// no study entry may contradict TT's dictionary (payload/hfq-i18n-en.js).
// Run: node tests/i18n_test.mjs   (from the repo root; TT_PAYLOAD overrides the payload folder)
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import assert from 'node:assert/strict';

const RACINE = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DICO_TT = path.join(process.env.TT_PAYLOAD || '/usr/lib/TurningTrade Terminal/payload', 'hfq-i18n-en.js');

// Proper names that read the same in both languages; strings without a lowercase letter are skipped too.
const NEUTRES = new Set(['New York', 'Chicago', 'Paris', 'Tokyo', 'Hong Kong', 'Sydney', 'Turning Trade',
  'Fibonacci', 'Camarilla', 'Woodie', 'DeMark', 'Confluence Scanner','VWAP Pro · A', 'VWAP Pro · B', 'VWAP Pro · C']);

// Runs a script with a fake HFQI18n that keeps what it registers in English.
function charger(fichier, defs) {
  const D = {};
  const ctx = { console, HFQExt: { etude(d) { defs.push(d); return true; } },
    HFQI18n: { dict(l, o) { if (l === 'en') Object.assign(D, o); }, regles() {}, t: s => s } };
  ctx.window = ctx;
  vm.runInContext(fs.readFileSync(fichier, 'utf8'), vm.createContext(ctx));
  return D;
}

const tt = fs.existsSync(DICO_TT) ? charger(DICO_TT, []) : null;
if (!tt) console.warn('dictionnaire de TT introuvable, contrôle des conflits sauté :', DICO_TT);

for (const f of fs.readdirSync(path.join(RACINE, 'extensions')).filter(f => f.endsWith('.js')).sort()) {
  const defs = [], D = charger(path.join(RACINE, 'extensions', f), defs), manque = new Set();
  const voir = s => { if (typeof s === 'string' && /[a-zà-ÿ]/.test(s) && !NEUTRES.has(s) && !(s in D) && !(tt && s in tt)) manque.add(s); };
  for (const d of defs) {
    voir(d.nom);
    voir(d.desc);
    // The panel shows the description followed by the file it comes from.
    if (d.desc) voir(d.desc + ' (extensions/' + f + ')');
    for (const r of d.reglages || []) {
      voir(r.label);
      const opts = typeof r.options === 'function' ? r.options() : r.options;
      for (const o of opts || []) voir(Array.isArray(o) ? o[1] : String(o));
    }
  }
  assert.equal([...manque].join('\n'), '', f + ' : anglais manquant');
  const conflits = tt ? Object.keys(D).filter(k => k in tt && tt[k] !== D[k]).map(k => k + ' → ' + D[k] + ' (TT : ' + tt[k] + ')') : [];
  assert.equal(conflits.join('\n'), '', f + ' : contredit le dictionnaire de TT');
  console.log('OK', f, '|', defs.length, defs.length > 1 ? 'études' : 'étude', '|', Object.keys(D).length, 'entrées anglaises');
}
