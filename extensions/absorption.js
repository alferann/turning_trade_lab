// Absorptions et reprises, lues sur les niveaux bid/ask des barres (bougies
// et footprint) et, en direct, sur la tape.
//
// Etude « absorption » : quatre signatures, chacune ouverte par une case a
// cocher, toutes jugees contre l'instrument lui-meme (mediane des N
// dernieres barres, rarete parmi les derniers paliers de la tape) :
//  - volume piege a l'extreme : gros volume agressif sur les ticks du plus
//    haut (ask) ou du plus bas (bid), cloture repliee d'au moins un quart du
//    range ;
//  - effort sans resultat : |delta| fort, cloture a plat ou contre lui ;
//  - niveau defendu : le meme prix (etendue de trois ticks) encaisse N tests
//    lourds en W barres sans qu'une cloture le traverse ;
//  - tape : un palier (executions agressives d'un meme cote a un meme prix)
//    qui a tenu et compte parmi les plus gros recents. Proxy d'iceberg :
//    HFQExt ne donne pas les tailles du carnet.
// Haussiere : vendeurs agressifs absorbes par des acheteurs passifs, au bas.
// Baissiere : l'inverse, au haut. La zone se prolonge jusqu'a la premiere
// cloture qui la traverse.
//
// Etude « absorption-reprise » : apres une absorption encore valide, la
// premiere des N barres suivantes qui clot au-dela de l'extreme oppose de la
// barre d'absorption avec un delta franc ou des desequilibres empiles dans
// le sens de la reprise. Elle relit les reglages de detection de l'etude
// absorption par HFQExt.etudes().
//
// Barres closes seulement : la barre en formation n'est jamais jugee, donc
// rien ne se repeint ni ne sonne deux fois. Un seul calcul incremental,
// partage par les deux etudes.
//
// Rien ne tient a travers des donnees manquantes : le bloc dont TT comble un
// jour absent, ou un jour ouvre manquant entre deux seances, arrete les zones
// encore ouvertes et les fenetres de reprise, et oublie les niveaux en test.
(function(){

// ponytail: cloture repliee d'au moins un quart du range pour le volume piege a l'extreme.
var RECUL = 0.25;
// ponytail: tolerance d'un niveau defendu, 15 % du range median des barres.
var TOL = 0.15;
// ponytail: memoire de la tape fixee a 2000 paliers, d'ou une rarete d'au plus 1 sur 2000.
var MEM_TAPE = 2000;
// Budget par image, pour le premier calcul des barres et le rattrapage de la tape.
var BUDGET_MS = 4;
var FILET = ' ────────────────────';
// Reglages qui changent la detection sur les barres ; les autres ne touchent que le dessin.
var CLES = ['memoire', 'ext', 'extK', 'extTicks', 'eff', 'effK', 'niv', 'nivTests', 'nivK', 'nivBarres'];
var CLES_REP = ['fenetre', 'cassure', 'combine', 'delta', 'deltaK', 'desq', 'desqRatio', 'desqN'];
var TAG = {ext:'ext', eff:'Δ', niv:'niv', tape:'tape'};

// Anglais : noms, descriptions, reglages, options, textes du canevas et des notifications.
var DESC_ABS = 'Absorptions lues sur les niveaux bid/ask : volume piégé à l\'extrême, effort sans résultat, niveau défendu sur plusieurs barres, et sur la tape en direct (proxy iceberg). Seuils adaptés à l\'instrument, zones prolongées jusqu\'à leur cassure.';
var DESC_ABS_EN = 'Absorptions read from bid/ask levels: volume trapped at the extreme, effort without result, level defended over several bars, and on the live tape (iceberg proxy). Thresholds adapted to the instrument, zones extended until broken.';
var DESC_REP = 'Reprise acheteuse ou vendeuse après une absorption encore valide : clôture au-delà de la barre d\'absorption, avec un delta franc ou des déséquilibres empilés. Relit les réglages de détection de l\'étude Absorptions.';
var DESC_REP_EN = 'Buying or selling resumption after a still valid absorption: close beyond the absorption bar, with a strong delta or stacked imbalances. Reads the detection settings of the Absorptions study.';
var EN = {
  'Absorptions':'Absorptions', 'Reprises après absorption':'Resumptions after absorption',
  'Mémoire (barres)':'Memory (bars)', 'Absorption haussière':'Bullish absorption', 'Absorption baissière':'Bearish absorption',
  'Opacité des zones':'Zone opacity', 'Étiquettes':'Labels', 'Notification d\'absorption':'Absorption notification',
  'Volume mini (× médiane)':'Minimum volume (× median)', 'Ticks de l\'extrême':'Ticks at the extreme',
  'Delta mini (× médiane)':'Minimum delta (× median)', 'Tests mini':'Minimum tests',
  'Volume d\'un test (× médiane)':'Volume of a test (× median)', 'Fenêtre (barres)':'Window (bars)',
  'Rareté (1 palier sur N)':'Rarity (1 run in N)',
  'Fenêtre après l\'absorption (barres)':'Window after the absorption (bars)',
  'Clôture au-delà de la barre d\'absorption':'Close beyond the absorption bar',
  'Delta et déséquilibres':'Delta and imbalances', 'L\'un ou l\'autre':'Either one', 'Les deux':'Both',
  'Reprise acheteuse':'Buying resumption', 'Reprise vendeuse':'Selling resumption',
  'Notification de reprise':'Resumption notification',
  'Rapport de déséquilibre (×)':'Imbalance ratio (×)', 'Déséquilibres consécutifs mini':'Minimum consecutive imbalances',
  'niv':'lvl', 'après absorption à':'after absorption at', 'Absorptions : lecture de la tape':'Absorptions: reading the tape'
};
EN['Volume piégé à l\'extrême' + FILET] = 'Volume trapped at the extreme' + FILET;
EN['Effort sans résultat' + FILET] = 'Effort without result' + FILET;
EN['Niveau défendu sur plusieurs barres' + FILET] = 'Level defended over several bars' + FILET;
EN['Absorption sur la tape (proxy iceberg)' + FILET] = 'Absorption on the tape (iceberg proxy)' + FILET;
EN['Delta franc' + FILET] = 'Strong delta' + FILET;
EN['Déséquilibres empilés' + FILET] = 'Stacked imbalances' + FILET;
EN[DESC_ABS] = DESC_ABS_EN;
EN[DESC_ABS + ' (extensions/absorption.js)'] = DESC_ABS_EN + ' (extensions/absorption.js)';
EN[DESC_REP] = DESC_REP_EN;
EN[DESC_REP + ' (extensions/absorption.js)'] = DESC_REP_EN + ' (extensions/absorption.js)';

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

// Textes du canevas et des notifications, que HFQI18n ne voit pas.
function tr(s){ return typeof HFQI18n !== 'undefined' && HFQI18n.t ? HFQI18n.t(s) : s; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }

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

// Rang d'insertion dans un tableau trie.
function place(a, v){
  var lo = 0, hi = a.length;
  while(lo < hi){ var m = (lo + hi) >> 1; if(a[m] < v) lo = m + 1; else hi = m; }
  return lo;
}

// Fenetre glissante triee : la valeur poussee chasse la plus ancienne, les
// quantiles se lisent sans rien trier.
function fenetre(W){ return {W:W, file:new Array(W), i:0, n:0, tri:[]}; }
function pousse(f, v){
  if(f.n === f.W) f.tri.splice(place(f.tri, f.file[f.i]), 1);
  else f.n++;
  f.file[f.i] = v;
  f.i = (f.i + 1) % f.W;
  f.tri.splice(place(f.tri, v), 0, v);
}
// NaN tant que la fenetre n'est pas a moitie pleine : un seuil ne s'invente pas.
function quantile(f, q){
  var n = f.tri.length;
  return n && 2 * n >= f.W ? f.tri[Math.min(n - 1, Math.floor(n * q))] : NaN;
}

// Ce qu'une barre close apporte : delta, volume agressif sur les Z ticks du
// haut (ask) et du bas (bid), prix le plus frappe de chaque cote.
function mesure(L, b, Z, tick){
  if(!L.n) return null;
  var h = L.haut(), l = L.bas(), D = 0, haut = 0, bas = 0, mb = -1, ma = -1, pb = l, pa = h;
  for(var k = 0; k < L.n; k++){
    var p = L.prix(k), bi = L.bid(k), as = L.ask(k);
    D += as - bi;
    if(p > h - (Z - 0.5) * tick) haut += as;
    if(p < l + (Z - 0.5) * tick) bas += bi;
    if(bi > mb){ mb = bi; pb = p; }
    if(as > ma){ ma = as; pa = p; }
  }
  return {o:b.o, c:b.c, h:h, l:l, D:D, haut:haut, bas:bas, pBid:pb, pAsk:pa, mD:NaN};
}

// Une absorption : barre, sens (+1 haussiere au bas, -1 baissiere au haut),
// zone, signatures et volumes. Deux signatures sur la meme barre et le meme
// sens n'en font qu'une. `fin` : barre dont la cloture l'a traversee, -1 tant
// qu'elle tient ; `vu` : derniere barre close examinee.
function absorption(L, i, s, haut, bas, tag, vol){
  for(var k = L.length - 1; k >= 0 && L[k].i === i; k--){
    var e = L[k];
    if(e.s !== s) continue;
    e.haut = Math.max(e.haut, haut); e.bas = Math.min(e.bas, bas);
    e.tags.push(tag); e.vols.push(vol);
    return;
  }
  L.push({i:i, s:s, haut:haut, bas:bas, tags:[tag], vols:[vol], fin:-1, vu:i});
}

// Niveau defendu : un test est une barre dont l'extreme tombe dans une
// etendue deja testee, avec un volume agressif lourd sur cet extreme.
// L'etendue vaut deux fois `tol` ticks, `tol` suivant le range median des
// barres (1 tick sur l'ES en 1 min, 6 sur le NQ). Le niveau tombe quand une
// cloture le traverse ou que ses tests sortent de la fenetre ; il ne signale
// qu'une fois. Comptes en ticks.
function niveau(S, i, f, r, seuil, tol, tick){
  var C = S.cand, c = Math.round(f.c / tick);
  for(var k = C.length - 1; k >= 0; k--){
    var n = C[k];
    while(n.tests.length && n.tests[0][0] <= i - r.nivBarres) n.tests.shift();
    if(!n.tests.length || (n.s > 0 ? c < n.lo : c > n.hi)) C.splice(k, 1);
  }
  teste(S, i, 1, Math.round(f.l / tick), f.bas, r, seuil, tol, tick);
  teste(S, i, -1, Math.round(f.h / tick), f.haut, r, seuil, tol, tick);
}
function teste(S, i, s, p, v, r, seuil, tol, tick){
  if(v < seuil) return;
  var C = S.cand, n = null, k;
  for(k = 0; k < C.length && !n; k++) if(C[k].s === s && Math.max(C[k].hi, p) - Math.min(C[k].lo, p) <= 2 * tol) n = C[k];
  if(!n) C.push(n = {s:s, lo:p, hi:p, tests:[], fait:false});
  n.lo = Math.min(n.lo, p); n.hi = Math.max(n.hi, p);
  n.tests.push([i, v]);
  if(n.fait || n.tests.length < r.nivTests) return;
  n.fait = true;
  var vol = 0;
  for(k = 0; k < n.tests.length; k++) vol += n.tests[k][1];
  absorption(S.ev, i, s, n.hi * tick, n.lo * tick, 'niv', vol);
}

// Etat des barres, incremental : si le graphe a seulement grandi, seules les
// nouvelles barres closes sont lues. `sceau` : la derniere barre lue, relue a
// chaque image pour voir si le graphe a change sous nos pieds.
var S = null;
function neuf(sig, r){
  var W = Math.max(10, r.memoire | 0);
  return {sig:sig, n:0, sceau:'', F:[], m:[], s0:0, ev:[], cand:[], trou:[], date:'', fD:fenetre(W), fX:fenetre(2 * W), fR:fenetre(W)};
}
function sceauDe(b){ return b ? b.m + ':' + b.o + ':' + b.c : ''; }

function avance(S, g, i, r, tick){
  var b = g.barre(i), Z = Math.max(1, r.extTicks | 0);
  var f = b && !b._trou ? mesure(g.niveaux(i), b, Z, tick) : null;
  S.m[i] = b ? +b.m : NaN;
  if(i && S.m[i] < S.m[i - 1]) S.s0 = i;
  // Trou : barre de comblement, ou premiere barre d'une seance apres un jour
  // ouvre manquant (date `_date`, ou `_sd` que le footprint pose sans dater).
  var d = b ? String(b._date || b._sd || '').slice(0, 10) : '';
  if(b && (b._trou || (d && S.date && d !== S.date && ouvresEntre(S.date, d)))){ S.trou[i] = true; S.cand = []; }
  if(d) S.date = d;
  S.sceau = sceauDe(b);
  S.F[i] = f;
  if(!f) return;
  var mX = quantile(S.fX, 0.5), mD = quantile(S.fD, 0.5), E = f.h - f.l;
  f.mD = mD;
  if(mX === mX && mD === mD){
    var X = Math.max(mX, 1);
    if(r.ext && E > 0){
      if(f.haut >= r.extK * X && f.h - f.c >= RECUL * E) absorption(S.ev, i, -1, f.h, Math.max(f.l, f.h - (Z - 1) * tick), 'ext', f.haut);
      if(f.bas >= r.extK * X && f.c - f.l >= RECUL * E) absorption(S.ev, i, 1, Math.min(f.h, f.l + (Z - 1) * tick), f.l, 'ext', f.bas);
    }
    if(r.eff && f.D && Math.abs(f.D) >= r.effK * Math.max(mD, 1) && (f.c - f.o) * f.D <= 0){
      if(f.D < 0) absorption(S.ev, i, 1, f.pBid, f.l, 'eff', -f.D);
      else absorption(S.ev, i, -1, f.h, f.pAsk, 'eff', f.D);
    }
    if(r.niv) niveau(S, i, f, r, r.nivK * X, Math.max(1, Math.round(TOL * quantile(S.fR, 0.5))), tick);
  }
  pousse(S.fX, f.haut); pousse(S.fX, f.bas); pousse(S.fD, Math.abs(f.D)); pousse(S.fR, Math.round(E / tick));
}

// Etat de la tape, consommee une fois par tranches bornees en temps.
var T = null;
function neufTape(sig){ return {sig:sig, lu:0, sceau:null, run:[null, null], f:fenetre(MEM_TAPE), ev:[]}; }

// Un palier : les executions agressives d'un meme cote a un meme prix,
// jusqu'a ce que ce cote frappe un autre prix. Tenu si ce nouveau prix est
// du bon cote : bid frappe puis vendeurs plus haut, les acheteurs passifs ont
// tenu (haussiere) ; ask leve puis acheteurs plus bas, les vendeurs ont tenu.
// Le palier en cours n'est jamais juge.
function lireTape(T, P, tick, rare){
  var t0 = maintenant(), q = 1 - 1 / rare, i = T.lu;
  for(; i < P.n; i++){
    var c = P.achat(i) ? 1 : 0, p = Math.round(P.prix(i) / tick), ru = T.run[c];
    if(ru && ru.p === p){ ru.v += P.taille(i); ru.t = P.t(i); }
    else {
      if(ru){
        if((c ? p < ru.p : p > ru.p) && ru.v > quantile(T.f, q))
          T.ev.push({i:-1, s:c ? -1 : 1, haut:ru.p * tick, bas:ru.p * tick, tags:['tape'], vols:[ru.v], fin:-1, vu:-1, t:ru.t, p:ru.p});
        pousse(T.f, ru.v);
      }
      T.run[c] = {p:p, v:P.taille(i), t:P.t(i)};
    }
    if((i & 1023) === 1023 && maintenant() - t0 > BUDGET_MS){ i++; break; }
  }
  T.lu = i;
  if(i) T.sceau = [P.t(i - 1), P.prix(i - 1), P.taille(i - 1)];
}
// La longueur ne suffit pas (rejeu, changement d'instrument) : le dernier
// print consomme doit etre toujours le meme.
function memeRuban(T, P){
  if(!T.lu) return true;
  if(P.n < T.lu) return false;
  var k = T.lu - 1;
  return P.t(k) === T.sceau[0] && P.prix(k) === T.sceau[1] && P.taille(k) === T.sceau[2];
}

// Barre de la seance en cours qui contient l'instant t (secondes depuis
// l'ouverture, comme la tape) ; `mF` : minute de la barre en formation.
function barreDe(S, N, mF, t){
  var m = t / 60, lo = mF < S.m[N - 2] ? N - 1 : S.s0, hi = N - 1, mi = function(k){ return k < N - 1 ? S.m[k] : mF; };
  if(lo > hi || !(mi(lo) <= m)) return -1;
  while(lo < hi){ var k = (lo + hi + 1) >> 1; if(mi(k) <= m) lo = k; else hi = k - 1; }
  return lo;
}

// Avance chaque absorption encore valide jusqu'a la derniere barre close. Un
// trou l'arrete aussi : on ne sait pas si une cloture l'a traversee pendant.
function suivre(L, F, trou, n, tick){
  for(var k = 0; k < L.length; k++){
    var e = L[k];
    if(e.i < 0 || e.fin >= 0) continue;
    for(var j = e.vu + 1; j < n && e.fin < 0; j++){
      var f = F[j];
      if(trou[j] || (f && (e.s > 0 ? f.c < e.bas - tick / 2 : f.c > e.haut + tick / 2))) e.fin = j;
    }
    if(n - 1 > e.vu) e.vu = n - 1;
  }
}

// Le calcul partage : barres closes, tape, suivi des zones.
function calcul(g, r){
  var tick = g.tick || 0.25, N = g.n | 0, fin = Math.max(0, N - 1);
  var sig = [g.sym, g.tf, g.seance, g.graphe, tick, sceauDe(N ? g.barre(0) : null), CLES.map(function(k){ return r[k]; }).join(',')].join('|');
  if(!S || S.sig !== sig || fin < S.n || (S.n && sceauDe(g.barre(S.n - 1)) !== S.sceau)){
    S = neuf(sig, r);
    if(T) T.ev.forEach(function(e){ e.i = -1; e.fin = -1; e.vu = -1; e.cleR = undefined; });
  }
  var t0 = maintenant(), i = S.n;
  while(i < fin){
    avance(S, g, i++, r, tick);
    if(!(i & 255) && maintenant() - t0 > BUDGET_MS) break;
  }
  S.n = i;
  var P = r.tape ? g.prints : null, tape = [], lu = 1;
  if(P && P.n){
    var ts = [g.sym, g.seance, tick, r.tapeRare].join('|');
    if(!T || T.sig !== ts || !memeRuban(T, P)) T = neufTape(ts);
    if(T.lu < P.n) lireTape(T, P, tick, Math.max(2, r.tapeRare | 0));
    // Les minutes des barres ne sont toutes connues qu'une fois les barres closes lues.
    var bf = N ? g.barre(N - 1) : null, mF = bf ? +bf.m : NaN;
    if(S.n === fin) T.ev.forEach(function(e){ if(e.i < 0 && (e.i = barreDe(S, N, mF, e.t)) >= 0) e.vu = e.i; });
    tape = T.ev; lu = T.lu / P.n;
  }
  suivre(S.ev, S.F, S.trou, S.n, tick);
  suivre(tape, S.F, S.trou, S.n, tick);
  var pret = S.n === fin && lu === 1;
  if(!pret) redessiner();
  return {ev:S.ev, tape:tape, F:S.F, n:S.n, lu:lu, pret:pret};
}
// TT ne redessine qu'aux ticks et aux gestes : un rattrapage etale sur
// plusieurs images demande lui-meme l'image suivante.
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

// Desequilibres diagonaux consecutifs dans le sens s : a l'achat, l'ask d'un
// prix contre le bid du tick du dessous ; a la vente, le bid contre l'ask du
// tick du dessus. Un prix sans voisin diagonal ne compte pas.
function empile(L, s, ratio, K, tick){
  var M = {}, lo = Infinity, hi = -Infinity, k, p;
  for(k = 0; k < L.n; k++){
    p = Math.round(L.prix(k) / tick); M[p] = k;
    if(p < lo) lo = p;
    if(p > hi) hi = p;
  }
  for(var suite = 0, p2 = lo; p2 <= hi; p2++){
    var a = M[p2], d = M[p2 - s];
    var ok = a !== undefined && d !== undefined &&
      (s > 0 ? L.ask(a) >= ratio * Math.max(L.bid(d), 1) : L.bid(a) >= ratio * Math.max(L.ask(d), 1));
    suite = ok ? suite + 1 : 0;
    if(suite >= K) return true;
  }
  return false;
}

// La barre f (index j) confirme-t-elle la reprise de l'absorption e ?
function confirme(e, a, f, g, j, rr, tick){
  if(rr.cassure && !(e.s > 0 ? f.c > (a ? a.h : e.haut) + tick / 2 : f.c < (a ? a.l : e.bas) - tick / 2)) return false;
  var d = function(){ return f.D * e.s >= rr.deltaK * Math.max(f.mD, 1); };
  var q = function(){ return empile(g.niveaux(j), e.s, rr.desqRatio, Math.max(2, rr.desqN | 0), tick); };
  if(rr.delta && rr.desq) return rr.combine === 'et' ? d() && q() : d() || q();
  return rr.delta ? d() : rr.desq ? q() : true;
}

// Reprise de chaque absorption : premiere barre close des `fenetre` suivantes
// qui confirme, tant que la zone tient. Gardee sur l'absorption, reprise la
// ou elle s'etait arretee a l'image suivante.
function reprises(C, g, rr){
  var tick = g.tick || 0.25, cle = CLES_REP.map(function(k){ return rr[k]; }).join(','), W = Math.max(1, rr.fenetre | 0);
  [C.ev, C.tape].forEach(function(L){
    for(var k = 0; k < L.length; k++){
      var e = L[k];
      if(e.i < 0) continue;
      if(e.cleR !== cle){ e.cleR = cle; e.rep = undefined; e.repVu = e.i; }
      if(e.rep !== undefined) continue;
      var fin = Math.min(e.i + W, C.n - 1);
      for(var j = e.repVu + 1; j <= fin && e.rep === undefined; j++){
        if(e.fin >= 0 && j >= e.fin) e.rep = -1;
        else if(C.F[j] && confirme(e, C.F[e.i], C.F[j], g, j, rr, tick)) e.rep = j;
      }
      if(fin > e.repVu) e.repVu = fin;
      if(e.rep === undefined && e.i + W <= C.n - 1) e.rep = -1;
    }
  });
}

// Notifications de bureau (Mako), une fois par evenement. Tant que le calcul
// rattrape l'historique, on ne fait que noter ce qui existe deja.
function notifier(M, C, cle, recent, message){
  var neufs = [];
  [C.ev, C.tape].forEach(function(L){
    for(var k = 0; k < L.length; k++){
      var e = L[k], c = cle(e);
      if(c === null || M.vu[c]) continue;
      M.vu[c] = 1;
      if(M.amorce && recent(e)) neufs.push(e);
    }
  });
  if(C.pret) M.amorce = true;
  neufs.forEach(function(e){ pousser(message(e)); });
}
function pousser(m){
  try{
    if(typeof Notification === 'undefined') return;
    var envoyer = function(){ try{ new Notification(m.titre, {body:m.texte}); }catch(_){} };
    if(Notification.permission === 'granted') envoyer();
    else if(Notification.permission !== 'denied') Notification.requestPermission().then(function(p){ if(p === 'granted') envoyer(); });
  }catch(_){}
}
function cleEv(e){ return e.i < 0 ? null : e.i + ':' + e.s + ':' + e.tags.join('') + (e.t !== undefined ? ':' + e.t + ':' + e.p : ''); }
function decimales(tick){ var s = String(tick).split('.')[1]; return s ? s.length : 0; }
function zoneTexte(e, tick){
  var d = decimales(tick);
  return e.haut === e.bas ? e.bas.toFixed(d) : e.bas.toFixed(d) + '–' + e.haut.toFixed(d);
}
function etiquette(e){
  return e.tags.map(function(t, k){ return tr(TAG[t]) + ' ' + Math.round(e.vols[k]); }).join(' · ');
}

// Triangle pointe vers le haut sous y (s > 0) ou vers le bas au-dessus de y.
// Rend l'ordonnee de sa base, pour y poser une etiquette.
function triangle(ctx, x, y, s, t, col, plein, e){
  var ya = y + s * 4 * e, yb = ya + s * t * 1.4;
  ctx.beginPath();
  ctx.moveTo(x, ya); ctx.lineTo(x - t, yb); ctx.lineTo(x + t, yb);
  ctx.closePath();
  if(plein){ ctx.fillStyle = col; ctx.fill(); }
  else { ctx.strokeStyle = col; ctx.lineWidth = 1.3 * e; ctx.stroke(); }
  return yb;
}

var NOTIF_ABS = {vu:{}, amorce:false}, NOTIF_REP = {vu:{}, amorce:false};

var defAbs = {
  id:'absorption',
  nom:'Absorptions',
  famille:'Flux',
  desc:DESC_ABS,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'memoire', label:'Mémoire (barres)', type:'number', defaut:100, min:20, max:1000, pas:10},
    {k:'haussiere', label:'Absorption haussière', type:'color', defaut:'#3fa7ff'},
    {k:'baissiere', label:'Absorption baissière', type:'color', defaut:'#ffa53f'},
    {k:'opacite', label:'Opacité des zones', type:'number', defaut:0.18, min:0.02, max:1, pas:0.02},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true},
    {k:'alerte', label:'Notification d\'absorption', type:'check', defaut:true},
    {k:'ext', label:'Volume piégé à l\'extrême' + FILET, type:'check', defaut:true},
    {k:'extK', label:'Volume mini (× médiane)', type:'number', defaut:5, min:1, max:50, pas:0.5},
    {k:'extTicks', label:'Ticks de l\'extrême', type:'number', defaut:2, min:1, max:10, pas:1},
    {k:'eff', label:'Effort sans résultat' + FILET, type:'check', defaut:true},
    {k:'effK', label:'Delta mini (× médiane)', type:'number', defaut:3, min:1, max:50, pas:0.5},
    {k:'niv', label:'Niveau défendu sur plusieurs barres' + FILET, type:'check', defaut:true},
    {k:'nivTests', label:'Tests mini', type:'number', defaut:3, min:2, max:10, pas:1},
    {k:'nivK', label:'Volume d\'un test (× médiane)', type:'number', defaut:2.5, min:0.5, max:20, pas:0.5},
    {k:'nivBarres', label:'Fenêtre (barres)', type:'number', defaut:15, min:3, max:200, pas:1},
    {k:'tape', label:'Absorption sur la tape (proxy iceberg)' + FILET, type:'check', defaut:true},
    {k:'tapeRare', label:'Rareté (1 palier sur N)', type:'number', defaut:1000, min:20, max:2000, pas:10}
  ],
  calcul:calcul,
  outils:{empile:empile, quantile:quantile, fenetre:fenetre, pousse:pousse},
  dessine:function(g, r){
    var C = calcul(g, r), F = g.cadre, e = g.echelle || 1, ctx = g.ctx, tick = g.tick || 0.25;
    var deb = g.premiere | 0, der = g.derniere | 0;
    if(!C.pret && C.lu < 1) g.texte(F.gauche + 8 * e, F.haut + 14 * e, tr('Absorptions : lecture de la tape') + ' ' + Math.floor(100 * C.lu) + ' %', {couleur:'#8a929c', taille:10});
    [C.ev, C.tape].forEach(function(L){
      for(var k = 0; k < L.length; k++){
        var a = L[k];
        if(a.i < 0 || a.i > der || (a.fin >= 0 && a.fin < deb)) continue;
        var col = a.s > 0 ? r.haussiere : r.baissiere, x0 = g.x(a.i), x1 = a.fin >= 0 ? g.x(a.fin) : F.droite;
        var y0 = g.y(a.haut + tick / 2), y1 = g.y(a.bas - tick / 2);
        ctx.globalAlpha = r.opacite;
        ctx.fillStyle = col;
        ctx.fillRect(x0, Math.min(y0, y1), Math.max(1, x1 - x0), Math.max(1, Math.abs(y1 - y0)));
        ctx.globalAlpha = 1;
        if(a.i < deb) continue;
        var yt;
        if(a.t !== undefined){
          ctx.beginPath();
          ctx.arc(x0, g.y(a.bas), 4 * e, 0, Math.PI * 2);
          ctx.strokeStyle = col; ctx.lineWidth = 1.5 * e; ctx.stroke();
          yt = g.y(a.bas) + a.s * 10 * e;
        } else {
          var f = C.F[a.i];
          yt = triangle(ctx, x0, g.y(a.s > 0 ? f.l : f.h), a.s, 5 * e, col, false, e) + a.s * 2 * e;
        }
        if(r.etiq) g.texte(x0, yt, etiquette(a), {couleur:col, taille:9, align:'center', base:a.s > 0 ? 'top' : 'bottom'});
      }
    });
    notifier(NOTIF_ABS, C, cleEv, function(a){ return r.alerte && a.i >= C.n - 2; }, function(a){
      return {titre:tr(a.s > 0 ? 'Absorption haussière' : 'Absorption baissière'),
              texte:(g.sym || '') + ' · ' + zoneTexte(a, tick) + ' · ' + etiquette(a)};
    });
  }
};

// Les reglages de detection tels que l'etude absorption les tient, meme
// masquee, par HFQExt.etudes() qui ne lit que ceux qu'on demande : inventaire()
// relisait ceux de toutes les etudes chargees (20 a 30 ms avec 24 etudes), et
// toutes les 300 ms, une image sur deux quand TT redessine moins souvent.
// ponytail: relu au plus toutes les 300 ms, alors que la lecture ne coute plus que 1 ms.
var DEFAUTS = {}, PART = {t:-Infinity, r:null};
defAbs.reglages.forEach(function(x){ DEFAUTS[x.k] = x.defaut; });
function partages(){
  var t = maintenant();
  if(PART.r && t - PART.t < 300) return PART.r;
  var out = DEFAUTS;
  try{
    var L = HFQExt.etudes();
    for(var i = 0; i < L.length; i++) if(L[i].id === 'ext:absorption'){
      out = {};
      L[i].params.forEach(function(x){ out[x.k] = x.get(); });
    }
  }catch(_){}
  PART.t = t; PART.r = out;
  return out;
}

var defRep = {
  id:'absorption-reprise',
  nom:'Reprises après absorption',
  famille:'Flux',
  desc:DESC_REP,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'fenetre', label:'Fenêtre après l\'absorption (barres)', type:'number', defaut:10, min:1, max:100, pas:1},
    {k:'cassure', label:'Clôture au-delà de la barre d\'absorption', type:'check', defaut:true},
    {k:'combine', label:'Delta et déséquilibres', type:'select', defaut:'ou', options:[['ou','L\'un ou l\'autre'],['et','Les deux']]},
    {k:'achat', label:'Reprise acheteuse', type:'color', defaut:'#4bd48e'},
    {k:'vente', label:'Reprise vendeuse', type:'color', defaut:'#e0567f'},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true},
    {k:'alerte', label:'Notification de reprise', type:'check', defaut:true},
    {k:'delta', label:'Delta franc' + FILET, type:'check', defaut:true},
    {k:'deltaK', label:'Delta mini (× médiane)', type:'number', defaut:1, min:0.5, max:20, pas:0.5},
    {k:'desq', label:'Déséquilibres empilés' + FILET, type:'check', defaut:true},
    {k:'desqRatio', label:'Rapport de déséquilibre (×)', type:'number', defaut:3, min:1.5, max:10, pas:0.5},
    {k:'desqN', label:'Déséquilibres consécutifs mini', type:'number', defaut:3, min:2, max:10, pas:1}
  ],
  // Pour le banc : reglages de detection et de reprise passes a la main.
  calcul:function(g, r, rr){ var C = calcul(g, r); reprises(C, g, rr); return C; },
  dessine:function(g, rr){
    var C = calcul(g, partages()), e = g.echelle || 1, ctx = g.ctx, tick = g.tick || 0.25;
    var deb = g.premiere | 0, der = g.derniere | 0;
    reprises(C, g, rr);
    [C.ev, C.tape].forEach(function(L){
      for(var k = 0; k < L.length; k++){
        var a = L[k];
        if(!(a.rep >= 0) || a.rep < deb || a.i > der) continue;
        var f = C.F[a.rep], col = a.s > 0 ? rr.achat : rr.vente, x = g.x(a.rep);
        g.trait([[g.x(a.i), g.y((a.haut + a.bas) / 2)], [x, g.y(f.c)]], {couleur:col, epaisseur:1, pointille:[2, 3], opacite:0.7});
        if(a.rep > der) continue;
        var yb = triangle(ctx, x, g.y(a.s > 0 ? f.l : f.h), a.s, 6 * e, col, true, e);
        if(rr.etiq) g.texte(x, yb + a.s * 2 * e, 'R', {couleur:col, taille:10, align:'center', base:a.s > 0 ? 'top' : 'bottom'});
      }
    });
    notifier(NOTIF_REP, C, function(a){ return a.rep >= 0 ? cleEv(a) + ':' + a.rep : null; }, function(a){ return rr.alerte && a.rep >= C.n - 2; }, function(a){
      var f = C.F[a.rep];
      return {titre:tr(a.s > 0 ? 'Reprise acheteuse' : 'Reprise vendeuse'),
              texte:(g.sym || '') + ' · ' + f.c.toFixed(decimales(tick)) + ' · ' + tr('après absorption à') + ' ' + zoneTexte(a, tick) + ' (' + etiquette(a) + ')'};
    });
  }
};

HFQExt.etude(defAbs);
HFQExt.etude(defRep);

})();
