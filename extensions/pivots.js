// Points pivots : PP, R1 a R3 et S1 a S3 journaliers, hebdomadaires et
// mensuels, calcules sur le haut, le bas, la cloture (et l'ouverture pour
// DeMark) de la periode precedente, traces en marches sur les barres de
// chaque periode. Formule au choix : classique, Fibonacci, Camarilla, Woodie,
// DeMark. Une sous-section par periode, ouverte par une case a cocher, avec
// sa couleur et son opacite.
//
// Les periodes se lisent sur la date de seance des barres : le footprint ne
// datant pas les siennes, il n'y a la que les pivots journaliers. Une semaine
// ou un mois precedent qui n'est pas charge en entier (chaque jour ouvre, du
// premier au dernier) ne donne pas de pivots, ni une veille qui ne couvre pas
// sa seance (historique en ticks encore en cours de chargement, debut
// d'historique en pleine seance) ou qui n'est pas le jour ouvre d'avant.
(function(){

// ponytail: minutes de seance de RTH (09:30 a 16:00 ET) sur un graphe ETH ouvert a 18:00 ET (ES, NQ).
var RTH = [930, 1320];
// ponytail: duree de la seance du graphe en minutes, 23 h en ETH et 6 h 30 en RTH (ES, NQ).
var DUREE = {eth:1380, rth:390};
// Une seance est complete si ses barres partent dans la premiere heure et
// vont jusqu'a 4 h de la fin : une cloture anticipee de jour ferie passe.
var MARGE = [60, 240];
// Dessin du mois au jour, pour que le journalier passe au-dessus.
var PERIODES = [{k:'mois', p:'m'}, {k:'sem', p:'w'}, {k:'jour', p:''}];
var FILET = ' ────────────────────';
var SEANCES = {sig:'', gen:0, n:0, der:'', J:[], prev:null, sess:0}, CACHE = {cle:'', P:null};

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

// Date AAAA-MM-JJ en millisecondes UTC, null si la cle n'est pas une date.
function jour(cle){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(cle);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

// Jours de fermeture complete du CME (Jour de l'An, Vendredi saint, Noel,
// reports compris), lus dans le calendrier de TT (HFQSessions.feriesUS) ; les
// seances ecourtees restent ouvrees. Sans ce calendrier, tout jour de semaine l'est.
var FERMES = {};
function ouvre(ms){
  var d = new Date(ms), an = d.getUTCFullYear();
  if(!(d.getUTCDay() % 6)) return false;
  if(!FERMES[an]){
    FERMES[an] = {};
    try{ HFQSessions.feriesUS(an).forEach(function(f){ if(f.type === 'ferme') FERMES[an][f.date] = 1; }); }catch(_){}
  }
  return !FERMES[an][d.toISOString().slice(0, 10)];
}

// Jours ouvres strictement entre deux dates : une seance manque entre elles.
function ouvresEntre(a, b){
  var d = jour(a), f = jour(b), n = 0;
  if(d === null || f === null) return 0;
  for(d += 864e5; d < f; d += 864e5) if(ouvre(d)) n++;
  return n;
}

// Jours ouvres de la semaine ou du mois d'une date : une periode close en
// compte autant de seances si elle est chargee de son premier jour a son dernier.
function ouvres(T, date){
  var t = jour(date), x = new Date(t), d, fin, n = 0;
  if(T === 'sem'){ d = t - ((x.getUTCDay() + 6) % 7) * 864e5; fin = d + 5 * 864e5; }
  else { d = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1); fin = Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1); }
  for(; d < fin; d += 864e5) if(ouvre(d)) n++;
  return n;
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
  if(p.O === null){ p.O = b.o; p.m0 = +b.m; }
  p.m1 = +b.m;
  p.C = b.c;
  if(b.h > p.H) p.H = b.h;
  if(b.l < p.L) p.L = b.l;
}

function periode(cle, debut, deb, date){ return {cle:cle, debut:debut, date:date || debut, deb:deb, fin:deb, nb:0, H:-Infinity, L:Infinity, O:null, C:null, m0:null, m1:null, complet:true, niv:null}; }

// Vrai si les barres comptees de la seance couvrent la fenetre f [debut, fin) en minutes.
function complete(p, f){ return p.O !== null && p.m0 <= f[0] + MARGE[0] && p.m1 >= f[1] - MARGE[1]; }

function cleBarre(b){ return b ? (b._date || '') + ':' + b.m : ''; }

// --- Completion par les fichiers (2026-11-04, demande de l'utilisateur) ---
// Un graphe en ticks ne tient que ses dernieres seances, et le mois precedent
// n'y est jamais entier : la veille, la semaine ou le mois qui precede la
// premiere periode du graphe, et les jours qui manquent a cette premiere
// periode, se lisent dans le fichier minute des bougies (vingt-quatre seances
// glissantes), puis, pour les jours plus anciens, dans l'archive minute par
// jour que le hub sert en gzip (_hist/profile_<ROOT>_<date>.json.gz). Un jour
// absent ou incomplet masque la periode : rien sur des donnees manquantes.
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}
// Change a chaque fichier arrive : les caches qui en dependent se recalculent.
var GEN = 0;
function racine(sym){ return String(sym || '').toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ''); }
function iso(ms){ return new Date(ms).toISOString().slice(0, 10); }

// Fichier minute des bougies, lu une fois par fetch : seances par date.
var MINUTES = {};
function minutes(g){
  var f;
  try{ f = HFQSymGuard.histFile(g.seance === 'rth' ? '_footprint' : '_footprint_eth', g.sym); }catch(_){ return null; }
  if(!MINUTES[f]){
    var M = MINUTES[f] = {pret:false, S:{}}, fini = function(){ M.pret = true; GEN++; redessiner(); };
    try{
      fetch(f, {cache:'no-cache'}).then(function(rep){ return rep.json(); })
        .then(function(j){ if(j && Array.isArray(j.sessions)) j.sessions.forEach(function(x){ M.S[String(x.date || '').slice(0, 10)] = x; }); fini(); }, fini);
    }catch(_){ M.pret = true; }
  }
  return MINUTES[f];
}

// Minute depuis 18:00 ET d'un horodatage unix en secondes, heure d'ete comprise.
var FMT = null;
function minuteET(t){
  if(!FMT) FMT = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', hour12:false, hour:'2-digit', minute:'2-digit'});
  var h = 0, mi = 0;
  FMT.formatToParts(new Date(t * 1000)).forEach(function(x){ if(x.type === 'hour') h = +x.value % 24; else if(x.type === 'minute') mi = +x.value; });
  return (h >= 18 ? h - 18 : h + 6) * 60 + mi;
}

// Jour de l'archive minute, lu une fois : {pret, s}, s au format des seances
// du fichier ({date, bars:[{m, o, h, l, c, v, lv}]}), null s'il manque ou
// s'il est incomplet.
var HIST = {};
function jourHist(sym, date){
  var k = racine(sym) + '|' + date, J = HIST[k];
  if(J) return J;
  J = HIST[k] = {pret:false, s:null};
  var fini = function(){ J.pret = true; GEN++; redessiner(); };
  try{
    fetch('/_hist/profile_' + racine(sym) + '_' + date + '.json.gz', {cache:'no-cache'})
      .then(function(rep){ if(!rep.ok) throw new Error('absent'); return rep.arrayBuffer(); })
      .then(function(buf){ return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json(); })
      .then(function(j){ J.s = convertir(j, date); fini(); }, fini);
  }catch(_){ J.pret = true; }
  return J;
}
function convertir(j, date){
  if(!j || !Array.isArray(j.bars) || j.complete === false) return null;
  var bars = [];
  for(var i = 0; i < j.bars.length; i++){
    var b = j.bars[i], L = b.ladder || [], lv = [];
    for(var q = 0; q < L.length; q++) lv.push([+L[q][0], +L[q][1] || 0, +L[q][2] || 0]);
    bars.push({m:minuteET(+b.t), o:+b.o, h:+b.h, l:+b.l, c:+b.c, v:+b.v || 0, lv:lv});
  }
  return bars.length ? {date:date, bars:bars} : null;
}

// Jours ouvres de la semaine ou du mois d'une date, ou la veille ouvree ('jour').
function joursDe(T, date){
  var t = jour(date), out = [], d, fin, x;
  if(t === null) return out;
  if(T === 'jour'){ for(d = t - 864e5; d > t - 15 * 864e5; d -= 864e5) if(ouvre(d)) return [iso(d)]; return out; }
  x = new Date(t);
  if(T === 'sem'){ d = t - ((x.getUTCDay() + 6) % 7) * 864e5; fin = d + 5 * 864e5; }
  else { d = Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1); fin = Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1); }
  for(; d < fin; d += 864e5) if(ouvre(d)) out.push(iso(d));
  return out;
}
// Jours ouvres de la periode qui precede celle de la date.
function joursAvant(T, date){
  if(T === 'jour') return joursDe('jour', date);
  var t = jour(date), x = new Date(t), d = T === 'sem' ? t - ((x.getUTCDay() + 6) % 7) * 864e5 : Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1);
  return joursDe(T, iso(d - 864e5));
}

// Periode assemblee jour par jour : la seance du graphe quand elle couvre sa
// fenetre, sinon le fichier minute, sinon l'archive par jour. {p, attente} :
// p null si un jour manque ou est incomplet, attente tant qu'un fichier se lit.
var FICH = {};
function periodeFichiers(g, J, dates, rth, f, cle){
  var k = [g.sym, g.seance, cle, rth, GEN].join('|'), c = FICH[k];
  if(c) return c;
  var p = periode(cle, dates[0] || '', -1, dates[0] || ''), attente = false, ok = dates.length > 0;
  for(var i = 0; i < dates.length && ok; i++){
    var d = dates[i], s = null, j, q;
    for(j = 0; j < J.length; j++) if(J[j].date === d){ s = J[j]; break; }
    if(s && !(s.O !== null && complete(s, f))) s = null;
    if(!s){
      var M = minutes(g), src = M && M.pret ? M.S[d] : null;
      if(M && !M.pret) attente = true;
      else if(!src){ var H = jourHist(g.sym, d); if(!H.pret) attente = true; else src = H.s; }
      if(src && src.bars){
        s = periode(d, d, 0, d);
        for(q = 0; q < src.bars.length; q++) ajoute(s, src.bars[q], q, rth);
        if(!(s.O !== null && complete(s, f))) s = null;
      }
    }
    if(!s){ ok = false; break; }
    p.nb++;
    if(p.O === null) p.O = s.O;
    p.C = s.C;
    if(s.H > p.H) p.H = s.H;
    if(s.L < p.L) p.L = s.L;
  }
  return FICH[k] = {p:ok && !attente ? p : null, attente:attente && ok};
}

// Seances du graphe, barre de debut et de fin, haut, bas, ouverture et
// cloture. Incremental : si le graphe a seulement grandi, la derniere barre
// connue est reprise et seules les nouvelles sont lues. Si elle n'est plus a
// son index (barres inserees plus tot, comme l'historique en ticks qui se
// remplit), tout repart de zero ; `gen` change alors pour vider le cache.
function seances(S, g, rth){
  var n = g.n | 0, b0 = n ? g.barre(0) : null, b;
  var sig = [g.sym, g.tf, g.seance, rth, cleBarre(b0)].join('|');
  if(sig !== S.sig || n < S.n || (S.n && cleBarre(g.barre(S.n - 1)) !== S.der)){ S.sig = sig; S.gen++; S.n = 0; S.der = ''; S.J = []; S.prev = null; S.sess = 0; }
  var J = S.J, prev = S.prev, sess = S.sess;
  if(S.n > 0 && J.length && (b = g.barre(S.n - 1))){ ajoute(J[J.length - 1], b, S.n - 1, rth); prev = b; }
  for(var i = S.n; i < n; i++){
    b = g.barre(i);
    if(!b) continue;
    if(!prev || (b._date != null ? b._date !== prev._date : +b.m < +prev.m)){
      if(prev) sess++;
      // Date de seance : `_date` des bougies, sinon `_sd`, que le footprint pose
      // sur ses barres sans les dater ; elle ne sert qu'a voir une veille manquante.
      var date = String(b._date || b._sd || '').slice(0, 10);
      J.push(periode('j' + sess, b._date ? date : '', i, date));
    }
    ajoute(J[J.length - 1], b, i, rth);
    prev = b;
  }
  S.n = n; S.prev = prev; S.sess = sess; S.der = cleBarre(prev);
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
    p.nb++;
    if(!s.complet) p.complet = false;
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
  var rth = !!r.rth && g.seance === 'eth', J = seances(SEANCES, g, rth);
  var cle = SEANCES.sig + '|' + SEANCES.gen + '|' + SEANCES.n + '|' + r.formule + '|' + GEN;
  if(cle === CACHE.cle) return CACHE.P;
  var f = rth ? RTH : [0, DUREE[g.seance] || DUREE.eth];
  for(var j = 0; j < J.length; j++) J[j].complet = complete(J[j], f);
  var P = {jour:J, sem:regroupe(J, semaine), mois:regroupe(J, function(d){ return d.slice(0, 7); })};
  // Une periode precedente incomplete ne donne pas de pivots : seance qui ne
  // couvre pas sa fenetre ou qui n'est pas le jour ouvre d'avant, semaine ou
  // mois qui contient une seance incomplete ou qui n'a pas tous ses jours ouvres.
  for(var T in P) for(var k = 0; k < P[T].length; k++){
    var a = P[T][k - 1];
    P[T][k].niv = !a || a.O === null || !a.complet || (T === 'jour' ? ouvresEntre(a.date, P[T][k].date) : a.nb < ouvres(T, a.debut)) ? null : niveaux(r.formule, a.H, a.L, a.C, a.O);
  }
  // Par les fichiers : la premiere periode du graphe recoit les pivots de celle
  // d'avant, et la deuxieme ceux de la premiere quand le graphe l'a prise en
  // cours de route (jours d'avant sa premiere barre lus dans les fichiers).
  for(T in P){
    var L = P[T], d0 = L.length ? L[0].date : '', R;
    if(!d0) continue;
    if(!L[0].niv){
      R = periodeFichiers(g, J, joursAvant(T, d0), rth, f, T + '|avant|' + d0);
      if(R.p) L[0].niv = niveaux(r.formule, R.p.H, R.p.L, R.p.C, R.p.O);
    }
    if(L.length > 1 && !L[1].niv){
      R = periodeFichiers(g, J, T === 'jour' ? [d0] : joursDe(T, d0), rth, f, T + '|premiere|' + d0);
      if(R.p && (T !== 'jour' || !ouvresEntre(d0, L[1].date))) L[1].niv = niveaux(r.formule, R.p.H, R.p.L, R.p.C, R.p.O);
    }
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
  outils:{niveaux:niveaux, ouvres:ouvres, ouvresEntre:ouvresEntre, semaine:semaine, complete:complete, joursDe:joursDe, joursAvant:joursAvant, minuteET:minuteET},
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
