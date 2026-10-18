// Points pivots : PP, R1 a R3 et S1 a S3 journaliers, hebdomadaires et
// mensuels, calcules sur le haut, le bas, la cloture (et l'ouverture pour
// DeMark) de la periode precedente, traces en marches sur les barres de
// chaque periode. Formule au choix : classique, Fibonacci, Camarilla, Woodie,
// DeMark. Une sous-section par periode, ouverte par une case a cocher, avec
// sa couleur et son opacite.
//
// Les periodes se lisent sur la date de seance des barres : le footprint ne
// datant pas les siennes, il n'y a la que les pivots journaliers. Une semaine
// ou un mois precedent qui n'est pas charge en entier ne donne pas de pivots.
(function(){

// ponytail: minutes de seance de RTH (09:30 a 16:00 ET) sur un graphe ETH ouvert a 18:00 ET (ES, NQ).
var RTH = [930, 1320];
// Dessin du mois au jour, pour que le journalier passe au-dessus.
var PERIODES = [{k:'mois', p:'m'}, {k:'sem', p:'w'}, {k:'jour', p:''}];
var FILET = ' ────────────────────';
var SEANCES = {sig:'', n:0, J:[], prev:null, sess:0}, CACHE = {cle:'', P:null};

// Anglais : nom, description, reglages et options tels que le panneau les affiche.
var DESC = 'PP, R1 à R3, S1 à S3 journaliers, hebdomadaires et mensuels, formule classique, Fibonacci, Camarilla, Woodie ou DeMark, une couleur par période.';
var DESC_EN = 'Daily, weekly and monthly PP, R1 to R3, S1 to S3, classic, Fibonacci, Camarilla, Woodie or DeMark formula, one color per period.';
var EN = {
  'Points pivots':'Pivot Points', 'Formule':'Formula',
  'Calcul sur RTH seul (graphe ETH)':'Computed on RTH only (ETH chart)'
};
EN['Pivots journaliers' + FILET] = 'Daily pivots' + FILET;
EN['Pivots hebdomadaires' + FILET] = 'Weekly pivots' + FILET;
EN['Pivots mensuels' + FILET] = 'Monthly pivots' + FILET;
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/pivots.js)'] = DESC_EN + ' (extensions/pivots.js)';

// Le panneau d'etudes s'ouvre dans la fenetre du terminal, au-dessus des
// graphes : le dictionnaire s'enregistre dans chaque fenetre parente.
function anglais(D){
  var w = typeof window !== 'undefined' ? window : null;
  for(var n = 0; w && n < 8; n++){
    try{ if(w.HFQI18n) w.HFQI18n.dict('en', D); }catch(_){}
    try{ w = w.parent !== w ? w.parent : null; }catch(_){ w = null; }
  }
}
anglais(EN);

// Semaine ISO d'une date AAAA-MM-JJ, en cle triable.
function semaine(cle){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(cle);
  if(!m) return '';
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  var j = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - j);
  var an = d.getUTCFullYear();
  var num = Math.ceil(((d - Date.UTC(an, 0, 1)) / 86400000 + 1) / 7);
  return an + '-' + (num < 10 ? '0' : '') + num;
}

// Vrai si la date est le premier jour ouvre de sa semaine (lundi) ou de son mois.
// ponytail: les feries sont ignores ; une periode ouverte par un ferie passe pour incomplete, donc masquee.
function premierOuvre(T, date){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if(!m) return false;
  var jour = function(k){ return new Date(Date.UTC(+m[1], +m[2] - 1, k)).getUTCDay(); };
  if(T === 'sem') return jour(+m[3]) === 1;
  for(var k = 1; k < +m[3]; k++) if(jour(k) % 6) return false;
  return true;
}

// Niveaux d'une periode a partir du haut, du bas, de la cloture et de l'ouverture de la precedente.
function niveaux(f, H, L, C, O){
  var E = H - L, pp;
  if(f === 'demark'){
    var X = C < O ? H + 2 * L + C : C > O ? 2 * H + L + C : H + L + 2 * C;
    return [['S1', X / 2 - H], ['PP', X / 4], ['R1', X / 2 - L]];
  }
  if(f === 'camarilla'){
    var q = 1.1 * E;
    return [['S3', C - q / 4], ['S2', C - q / 6], ['S1', C - q / 12], ['PP', (H + L + C) / 3], ['R1', C + q / 12], ['R2', C + q / 6], ['R3', C + q / 4]];
  }
  pp = f === 'woodie' ? (H + L + 2 * C) / 4 : (H + L + C) / 3;
  if(f === 'fibonacci') return [['S3', pp - E], ['S2', pp - 0.618 * E], ['S1', pp - 0.382 * E], ['PP', pp], ['R1', pp + 0.382 * E], ['R2', pp + 0.618 * E], ['R3', pp + E]];
  return [['S3', L - 2 * (H - pp)], ['S2', pp - E], ['S1', 2 * pp - H], ['PP', pp], ['R1', 2 * pp - L], ['R2', pp + E], ['R3', H + 2 * (pp - L)]];
}

// Met a jour une periode avec une barre : max, min et derniere cloture se
// reprennent sans dommage sur une barre deja vue qui a grossi.
function ajoute(p, b, i, rth){
  p.fin = i;
  if(b._trou || (rth && (+b.m < RTH[0] || +b.m >= RTH[1]))) return;
  if(p.O === null) p.O = b.o;
  p.C = b.c;
  if(b.h > p.H) p.H = b.h;
  if(b.l < p.L) p.L = b.l;
}

function periode(cle, debut, deb){ return {cle:cle, debut:debut, deb:deb, fin:deb, H:-Infinity, L:Infinity, O:null, C:null, niv:null}; }

// Seances du graphe, barre de debut et de fin, haut, bas, ouverture et
// cloture. Incremental : si le graphe a seulement grandi, la derniere barre
// connue est reprise et seules les nouvelles sont lues.
function seances(S, g, rth){
  var n = g.n | 0, b0 = n ? g.barre(0) : null, b;
  var sig = [g.sym, g.tf, g.seance, rth, b0 ? (b0._date || '') + ':' + b0.m : ''].join('|');
  if(sig !== S.sig || n < S.n){ S.sig = sig; S.n = 0; S.J = []; S.prev = null; S.sess = 0; }
  var J = S.J, prev = S.prev, sess = S.sess;
  if(S.n > 0 && J.length && (b = g.barre(S.n - 1))){ ajoute(J[J.length - 1], b, S.n - 1, rth); prev = b; }
  for(var i = S.n; i < n; i++){
    b = g.barre(i);
    if(!b) continue;
    if(!prev || (b._date != null ? b._date !== prev._date : +b.m < +prev.m)){
      if(prev) sess++;
      J.push(periode('j' + sess, b._date ? String(b._date).slice(0, 10) : '', i));
    }
    ajoute(J[J.length - 1], b, i, rth);
    prev = b;
  }
  S.n = n; S.prev = prev; S.sess = sess;
  return J;
}

// Semaines ou mois : les seances datees regroupees par cle.
function regroupe(J, cleDe){
  var out = [], p = null;
  for(var k = 0; k < J.length; k++){
    var s = J[k], c = s.debut && cleDe(s.debut);
    if(!c) continue;
    if(!p || p.cle !== c) out.push(p = periode(c, s.debut, s.deb));
    p.fin = s.fin;
    if(s.O === null) continue;
    if(p.O === null) p.O = s.O;
    p.C = s.C;
    if(s.H > p.H) p.H = s.H;
    if(s.L < p.L) p.L = s.L;
  }
  return out;
}

// Periodes de chaque type et niveaux tires de la precedente. Les pivots de
// la periode en cours ne dependent pas de ses propres barres : ils ne se
// recalculent qu'a chaque nouvelle barre ou changement de formule.
function calcul(g, r){
  var J = seances(SEANCES, g, !!r.rth && g.seance === 'eth');
  var cle = SEANCES.sig + '|' + SEANCES.n + '|' + r.formule;
  if(cle === CACHE.cle) return CACHE.P;
  var P = {jour:J, sem:regroupe(J, semaine), mois:regroupe(J, function(d){ return d.slice(0, 7); })};
  // La premiere periode chargee n'est complete que si elle s'ouvre au premier jour ouvre.
  for(var T in P) for(var k = 0; k < P[T].length; k++){
    var a = P[T][k - 1];
    P[T][k].niv = !a || a.O === null || (T !== 'jour' && k === 1 && !premierOuvre(T, a.debut)) ? null : niveaux(r.formule, a.H, a.L, a.C, a.O);
  }
  CACHE.cle = cle; CACHE.P = P;
  return P;
}

function sousSection(k, label, couleur){
  return [{k:k, label:label + FILET, type:'check', defaut:true}, {k:k + 'C', label:'Couleur', type:'color', defaut:couleur},
    {k:k + 'O', label:'Opacité', type:'number', defaut:1, min:0.05, max:1, pas:0.05}];
}

var def = {
  id:'pivots',
  nom:'Points pivots',
  famille:'Prix',
  desc:DESC,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'formule', label:'Formule', type:'select', defaut:'classique', options:[['classique','Classique'],['fibonacci','Fibonacci'],['camarilla','Camarilla'],['woodie','Woodie'],['demark','DeMark']]},
    {k:'rth', label:'Calcul sur RTH seul (graphe ETH)', type:'check', defaut:false},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true}
  ].concat(sousSection('jour', 'Pivots journaliers', '#5aa9e6'), sousSection('sem', 'Pivots hebdomadaires', '#ffb347'), sousSection('mois', 'Pivots mensuels', '#e0567f')),
  calcul:calcul,
  outils:{niveaux:niveaux, premierOuvre:premierOuvre, semaine:semaine},
  dessine:function(g, r){
    var P = calcul(g, r), F = g.cadre, e = g.echelle || 1;
    var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, (g.n | 0) - 1);
    if(fin < deb) return;
    for(var t = 0; t < PERIODES.length; t++){
      var T = PERIODES[t], L = P[T.k], col = r[T.k + 'C'], op = +r[T.k + 'O'];
      if(!r[T.k]) continue;
      for(var k = 0; k < L.length; k++){
        var p = L[k];
        if(!p.niv || p.fin < deb || p.deb > fin) continue;
        // La periode en cours se prolonge jusqu'au bord droit.
        var x0 = g.x(Math.max(p.deb, deb)), x1 = k === L.length - 1 ? F.droite : g.x(Math.min(p.fin, fin));
        for(var j = 0; j < p.niv.length; j++){
          var y = g.y(p.niv[j][1]), nom = p.niv[j][0];
          g.trait([[x0, y], [x1, y]], {couleur:col, opacite:op, epaisseur:nom === 'PP' ? 1.5 : 1});
          if(r.etiq) g.texte(Math.max(x0, F.gauche) + 3 * e, y - 2 * e, T.p + nom, {couleur:col, opacite:op, taille:10, base:'bottom'});
        }
      }
    }
  }
};

HFQExt.etude(def);

})();
