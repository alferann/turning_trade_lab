// Niveaux de single prints : les zones a une seule lettre du profil TPO d'une
// seance close, celles du Market Profile de TT (suite de prix a une lettre prise
// entre deux niveaux plus fournis, les extremes du profil n'en sont pas),
// lues dans les profils cuits par TT (_mp_daily pour RTH, _mp_daily_eth pour
// la seance complete). Chaque zone porte cinq niveaux, 0, 25, 50, 75 et
// 100 % : 0 % est le bord d'entree, celui que le prix rencontre en revenant
// (du cote de la cloture de la seance), 100 % le bord oppose. Chaque trait
// part de la barre qui a laisse le print et s'arrete a la premiere meche qui
// le touche apres la fin de la seance ; sinon il file au bord droit.
//
// Seules les seances dont la fin est chargee sur le graphe sont tracees. Rien
// n'est tire de donnees manquantes : un niveau encore vierge quand le graphe
// a un trou (barre de comblement, jour ouvre sans seance, seance entamee en
// retard ou coupee, plus de dix minutes sans barre, trou connu de TT sur
// ticks, volume ou range) est masque, et une seance close attend que TT ait
// cuit son profil apres la cloture.
//
// Sur le Market Profile, qui n'a pas de barres, les memes niveaux se posent
// sur les profils que la page affiche : voir calculProfil.
(function(){

var ET = 'America/New_York';
var NIVEAUX = [0, 25, 50, 75, 100];
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3]};
// ponytail: budget du premier passage par image ; la suite aux images suivantes.
var BUDGET_MS = 4;
// ponytail: une seance est chargee jusqu'a sa fin si sa derniere barre commence a moins d'une heure de la cloture, la marge des autres etudes.
var MARGE_FIN = 60;
// Delai entre deux relectures du fichier de TT quand une seance close n'y est pas encore cuite.
var RELIRE_MS = 60000;
// ponytail: un profil est tenu pour complet si son fichier a ete ecrit au moins 2 min apres la cloture.
var CUIT_MS = 120000;

// Etat de la lecture : `n` la prochaine barre a lire, `prev`/`ip` la derniere
// lue, `d` sa date de seance, `clos` la derniere seance fermee, `Z` les zones
// des seances closes, `act` leurs niveaux encore vierges tries par prix,
// `attente` une seance close que le fichier de TT ne porte pas encore.
var ETAT = {sig:'', n:0, vu:0, prev:null, ip:-1, d:'', clos:'', W:{}, Z:[], act:[], pret:false, neufs:[], attente:'', raison:'', eps:0};

// Anglais : nom, description, reglages, options, textes du canevas et notifications.
var DESC = 'Niveaux 0, 25, 50, 75 et 100 % des zones de single prints des séances closes (celles du Market Profile de TT), depuis le bord d\'entrée ; chaque trait s\'arrête à la première mèche qui le touche, ou au premier profil qui le recroise sur le Market Profile.';
var DESC_EN = '0, 25, 50, 75 and 100% levels of the single print zones of closed sessions (those of TT\'s Market Profile), from the entry edge; each line stops at the first wick that touches it, or at the first profile that crosses it on the Market Profile.';
var EN = {
  'Niveaux de single prints':'Single Print Levels', 'Profil TPO':'TPO profile', 'RTH':'RTH', 'Séance complète':'Full session',
  'Hauteur minimale (ticks)':'Minimum height (ticks)',
  'Niveau 0 % (bord d\'entrée)':'0% level (entry edge)', 'Niveau 25 %':'25% level', 'Niveau 50 %':'50% level', 'Niveau 75 %':'75% level',
  'Niveau 100 % (bord opposé)':'100% level (far edge)', 'Masquer les niveaux pris':'Hide taken levels', 'Style':'Style',
  'Notification quand un niveau est pris':'Notification when a level is taken', 'Niveau pris':'Level taken',
  'Single prints : profils TPO de TT introuvables':'Single prints: TT\'s TPO profiles not found',
  'Single prints : le profil de séance complète demande un graphe ETH':'Single prints: the full-session profile needs an ETH chart',
  'Single prints : dates de séance absentes du graphe':'Single prints: no session dates on this chart',
  'Single prints : profil de TT en attente pour la séance du':'Single prints: waiting for TT\'s profile of session'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/single_prints_niveaux.js)'] = DESC_EN + ' (extensions/single_prints_niveaux.js)';

// Le panneau d'etudes s'ouvre dans la fenetre du terminal, au-dessus des
// graphes : le dictionnaire s'enregistre dans chaque fenetre parente.
function anglais(D){
  var w = typeof window !== 'undefined' ? window : null;
  for(var n = 0; w && n < 8; n++){
    try{ if(w.HFQI18n) w.HFQI18n.dict('en', D); }catch(_){}
    try{ w = w.parent !== w ? w.parent : null; }catch(_){ w = null; }
  }
}
// Textes du canevas et des notifications, que HFQI18n ne voit pas.
function tr(s){ return typeof HFQI18n !== 'undefined' && HFQI18n.t ? HFQI18n.t(s) : s; }
anglais(EN);

function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}
// Date de seance d'une barre : `_date` sur les bougies, `_sd` sur le footprint.
function dateDe(b){ return String(b._date || b._sd || '').slice(0, 10); }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? dateDe(b) + ':' + b.m : ''; }

// Calendrier du CME lu chez TT (HFQSessions.feriesUS) : `ferme` les jours de
// fermeture complete (Jour de l'An, Vendredi saint, Noel, reports compris),
// `reduit` les seances ecourtees, closes a 13:00 ET (Labor Day, Thanksgiving).
// Sans ce calendrier, tout jour de semaine est ouvre et plein.
var FERIES = {};
function ferie(date, type){
  var an = String(date).slice(0, 4);
  if(!FERIES[an]){
    FERIES[an] = {};
    try{ HFQSessions.feriesUS(+an).forEach(function(f){ FERIES[an][f.date] = f.type; }); }catch(_){}
  }
  return FERIES[an][String(date).slice(0, 10)] === type;
}
// Jours ouvres strictement entre deux dates de seance : une seance manque entre elles.
function ouvresEntre(a, b){
  var d = Date.parse(a), f = Date.parse(b), n = 0;
  if(!(d < f)) return 0;
  for(d += 864e5; d < f; d += 864e5) if(new Date(d).getUTCDay() % 6 && !ferie(new Date(d).toISOString(), 'ferme')) n++;
  return n;
}

var DECAL = {};
// Decalage de New York par rapport a UTC, en minutes, a midi UTC de la date.
function decalage(date){
  if(DECAL[date] != null) return DECAL[date];
  var d = new Date(date + 'T12:00:00Z'), v;
  try{
    var p = new Intl.DateTimeFormat('en-US', {timeZone:ET, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}).formatToParts(d), o = {};
    for(var i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
    v = Math.round((Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute) - d.getTime()) / 60000);
  }catch(_){ v = -300; }
  return (DECAL[date] = v);
}

// ponytail: heures des futures du CME (ES, NQ) ; un autre marche demandera ses propres bornes.
// Fenetre du profil dans la seance du graphe, en minutes de seance : [a, b)
// et `fin`, la minute de cloture. Graphe ETH ouvert a 18:00 ET : RTH de 930
// a 1320, seance complete jusqu'a 1380 ; graphe RTH ouvert a 09:30 : la
// seance entiere, 390 min. Seance ecourtee : cloture a 13:00 ET. `dur` est
// la fin de la seance du graphe. null quand le graphe ne peut pas porter le
// profil (seance complete sur graphe RTH).
function fenetre(g, profil, date){
  var court = ferie(date, 'reduit'), dur = g.seance === 'rth' ? (court ? 210 : 390) : court ? 1140 : 1380;
  if(g.seance === 'rth') return profil === 'rth' ? {a:0, b:Infinity, fin:dur, dur:dur} : null;
  if(profil === 'rth') return {a:930, b:Math.min(1320, dur), fin:Math.min(1320, dur), dur:dur};
  return {a:0, b:Infinity, fin:dur, dur:dur};
}
// Instant de la cloture de la seance d'une date, en millisecondes : 16:00 ET
// pour RTH, 17:00 ET pour la seance complete, 13:00 ET une seance ecourtee.
function finMs(date, profil){
  return Date.parse(date + 'T00:00:00Z') + ((ferie(date, 'reduit') ? 780 : profil === 'rth' ? 960 : 1020) - decalage(date)) * 60000;
}

// Trous d'une seance d'un graphe en ticks, volume ou range, lus chez TT : la
// page pour la seance du direct (subGap, subTrous de candles.html et
// footprint.html), le memo de HFQLiveSeed.ticksJour pour les jours passes.
// {ok, t:[[m0, m1], ...]} en minutes de seance, bornes incluses ; null tant
// que la reponse n'est pas la (niveaux masques), et tout se relit a son
// arrivee. Sans HFQLiveSeed (banc), aucun trou connu. Un rachat en cours chez
// le courtier se redemande 15 s plus tard.
var TROUS = {cle:'', J:{}};
function trousTicks(g, date, vif){
  var cle = [g.sym, g.seance].join('|');
  if(TROUS.cle !== cle){ TROUS.cle = cle; TROUS.J = {}; }
  if(vif){
    var gap = -1, t = [];
    try{ if(typeof subGap === 'function') gap = subGap(); if(typeof subTrous === 'function') t = (subTrous() || []).slice(); }catch(_){}
    if(gap >= 0) t.push([0, gap]);
    return {ok:true, t:t};
  }
  var J = TROUS.J[date];
  if(J && J.exp && maintenant() > J.exp) J = undefined;
  if(J !== undefined) return J;
  var LS = typeof HFQLiveSeed !== 'undefined' ? HFQLiveSeed : null;
  if(!LS || typeof LS.ticksJour !== 'function' || !date) return (TROUS.J[date] = {ok:true, t:[]});
  TROUS.J[date] = null;
  // Reponse rendue dans l'appel (memo synchrone) : servie tout de suite ; sinon tout se relit a son arrivee.
  var sync = true, fini = function(r){
    TROUS.J[date] = r && r.ok ? {ok:r.complet !== false || (r.trous || []).length > 0, t:r.trous || []}
      : r && r.enCours ? {ok:false, t:[], exp:maintenant() + 15000} : {ok:false, t:[]};
    if(!sync){ ETAT.sig = ''; redessiner(); }
  };
  try{ LS.ticksJour({sym:g.sym, day:date, session:g.seance, attendre:false}).then(fini, function(){ fini(null); }); }
  catch(_){ fini(null); }
  sync = false;
  return TROUS.J[date];
}
// Seance du direct : celle de la derniere barre quand la page est en direct
// (LIVE_ON de candles.html et footprint.html).
function enDirect(g, b){
  try{ var der = g.barre((g.n | 0) - 1); return !!(typeof LIVE_ON !== 'undefined' && LIVE_ON && der && dateDe(der) === dateDe(b)); }catch(_){ return false; }
}

// Profils cuits par TT, un fichier par instrument et par profil, lus sur le
// hub : `J` les jours par date, `dernier` la derniere date, `lm` l'instant de
// la derniere ecriture du fichier (en-tete Last-Modified), `gen` change quand
// le contenu change. null sans le nommage de TT (HFQSymGuard).
var FICHIERS = {};
function fichier(g, profil){
  var f;
  try{ f = HFQSymGuard.histFile(profil === 'eth' ? '_mp_daily_eth' : '_mp_daily', g.sym); }catch(_){ return null; }
  return f ? FICHIERS[f] || (FICHIERS[f] = {nom:f, lu:false, vol:false, t:-Infinity, J:{}, nb:0, dernier:'', lm:NaN, gen:0}) : null;
}
// Lit ou relit le fichier, au plus une fois par RELIRE_MS.
function lire(F){
  if(F.vol || maintenant() - F.t < RELIRE_MS) return;
  F.vol = true; F.t = maintenant();
  var lm = NaN, fini = function(j){
    F.vol = false;
    var D = j && Array.isArray(j.days) ? j.days : null;
    if(D && (!F.lu || String(lm) !== String(F.lm) || D.length !== F.nb)){
      F.J = {}; F.nb = D.length; F.dernier = ''; F.lm = lm;
      D.forEach(function(x){ var d = String(x.date || '').slice(0, 10); F.J[d] = x; if(d > F.dernier) F.dernier = d; });
      F.gen++;
    }
    F.lu = true;
    redessiner();
  };
  try{
    fetch(F.nom, {cache:'no-cache'}).then(function(rep){
      try{ lm = Date.parse(rep.headers.get('Last-Modified')); }catch(_){}
      return rep.json();
    }).then(fini, function(){ fini(null); });
  }catch(_){ fini(null); }
}

// Suites de single prints d'un jour du Market Profile, regle de TT
// (mpSinglesRuns de marketprofile_pro.html) : rangees [prix, lettres, nombre
// de lettres, ...] triees du haut vers le bas, suites de rangees voisines a
// une seule lettre, bordees des deux cotes par une rangee voisine. `pas` est
// l'ecart entre deux rangees.
function suites(J, tick){
  var R = (J && J.rows || []).slice().sort(function(x, y){ return y[0] - x[0]; }), pas = 1e9, L = [], i, k;
  for(i = 1; i < R.length; i++){ var d = R[i - 1][0] - R[i][0]; if(d > 0 && d < pas) pas = d; }
  if(pas >= 1e9) pas = tick;
  var colle = function(x, y){ return R[x][0] - R[y][0] <= pas * 1.5; };
  for(i = 0; i < R.length; i = k + 1){
    k = i;
    if(R[i][2] !== 1) continue;
    while(k + 1 < R.length && R[k + 1][2] === 1 && colle(k, k + 1)) k++;
    if(i > 0 && k < R.length - 1 && colle(i - 1, i) && colle(k, k + 1)) L.push({hi:R[i][0], lo:R[k][0], pas:pas});
  }
  return L;
}

// Zone d'une suite : ses bornes au tick (une rangee est centree sur son
// prix), sa hauteur en ticks et ses niveaux. La cloture de la seance au-dessus
// du milieu : le prix reviendra par le haut, 0 % est le bord haut.
function zone(z, J, tick, date){
  var tb = Math.ceil((z.lo - z.pas / 2) / tick - 1e-6), th = Math.floor((z.hi + z.pas / 2) / tick + 1e-6), bas = tb * tick, haut = th * tick;
  var dessus = +J.close >= (bas + haut) / 2, N = [], vus = {}, h = th - tb + 1;
  NIVEAUX.forEach(function(q){
    // Profondeur en ticks entiers depuis le bord d'entree : la meme des deux cotes.
    var c = dessus ? th - Math.round(q / 100 * (th - tb)) : tb + Math.round(q / 100 * (th - tb));
    if(vus[c]) return;
    vus[c] = 1;
    // `deb` la barre qui a laisse le print, `fin` celle qui prend le niveau (-1 : vierge), `masque` : trou avant la prise.
    N.push({q:q, p:c * tick, h:h, deb:-1, fin:-1, masque:false});
  });
  return {date:date, bas:bas, haut:haut, ticks:h, dessus:dessus, deb:0, N:N};
}

// Premier index de la liste triee `A` dont le prix atteint `p`.
function rang(A, p){
  var lo = 0, hi = A.length;
  while(lo < hi){ var m = (lo + hi) >> 1; if(A[m].p < p) lo = m + 1; else hi = m; }
  return lo;
}
// Un trou de donnees : les niveaux encore vierges ont pu etre pris dedans.
function vider(S){
  S.act.forEach(function(v){ v.masque = true; });
  S.act = [];
}

// La seance `date` vient de finir a la barre `i` : ses zones entrent en jeu si
// le graphe la porte jusqu'a sa fin et si TT a cuit son profil apres la
// cloture (le dernier jour du fichier peut etre une seance encore en cours).
function ferme(S, P, date, i){
  var W = S.W[date], pr = S.prev, F = P.F, J = F.J[date];
  if(!pr || +pr.m < W.a || +pr.m >= W.b || +pr.m < W.fin - MARGE_FIN) return;
  if(!J || (date === F.dernier && F.lm < finMs(date, P.profil) + CUIT_MS)){
    if(date >= F.dernier) S.attente = date;
    return;
  }
  suites(J, P.tick).forEach(function(z){
    var Z = zone(z, J, P.tick, date), reste = Z.N.length, deb = i - 1;
    // Debut de chaque trait : la derniere barre de la seance qui a traite le niveau.
    for(var k = i - 1; k >= 0 && reste; k--){
      var b = P.g.barre(k);
      if(!b || dateDe(b) !== date || +b.m < W.a) break;
      if(b._trou) continue;
      for(var q = 0; q < Z.N.length; q++){
        var v = Z.N[q];
        if(v.deb < 0 && b.l - S.eps <= v.p && v.p <= b.h + S.eps){ v.deb = k; reste--; if(k < deb) deb = k; }
      }
    }
    Z.N.forEach(function(v){
      if(v.deb < 0) v.deb = i - 1;
      S.act.splice(rang(S.act, v.p), 0, v);
    });
    Z.deb = deb;
    S.Z.push(Z);
  });
}

// Lit une barre : ferme la seance de la barre precedente si elle vient de
// finir, masque les niveaux vierges devant un trou, puis note les niveaux que
// la meche de la barre touche. Relire la derniere barre, qui grossit encore,
// ne change rien de ce qui est deja note. Trou entre deux barres : un jour
// ouvre sans seance ; en minutes, une seance coupee avant sa fin, entamee en
// retard ou plus de P.tol minutes sans barre (seuil des marques « sans
// donnee » de TT) ; sur ticks, volume ou range, ou l'ecart entre deux barres
// est la duree d'une barre, un trou connu de TT entre les deux.
function lit(S, b, i, P){
  var d = dateDe(b), pr = S.prev, m = +b.m, suite = pr && pr !== b;
  if(suite){
    var dp = S.d, W = S.W[dp] || (S.W[dp] = fenetre(P.g, P.profil, dp));
    if(S.clos !== dp && (d !== dp || m >= W.b)){ ferme(S, P, dp, i); S.clos = dp; }
    if(d !== dp ? ouvresEntre(dp, d) || (!P.ticks && (m > P.tol || +pr.m < W.dur - P.tol)) : !P.ticks && m - pr.m > P.tol) vider(S);
  }
  if(P.ticks){
    if(!P.T || P.T.d !== d) P.T = {d:d, v:trousTicks(P.g, d, enDirect(P.g, b))};
    var T = P.T.v, m0 = !pr ? 0 : !suite ? m : S.d === d ? +pr.m : 0;
    if(!T || !T.ok || T.t.some(function(h){ return h[0] <= m && h[1] >= m0; })) vider(S);
  }
  S.d = d;
  if(b._trou){ vider(S); return; }
  var A = S.act, k0 = rang(A, b.l - S.eps), k = k0;
  while(k < A.length && A[k].p <= b.h + S.eps){ A[k].fin = i; if(S.pret) S.neufs.push(A[k]); k++; }
  if(k > k0) A.splice(k0, k - k0);
}

// Incremental : les barres closes ne se lisent qu'une fois, la derniere se
// relit a chaque passage. Un graphe qui raccourcit (replay ramene en
// arriere), une autre serie, un autre profil, un fichier de TT relu ou une
// derniere barre lue qui n'est plus a son index (barres inserees plus tot)
// repart de zero, sans notifier l'historique, dont la lecture s'etale sur
// plusieurs images au-dela de BUDGET_MS.
function calcul(g, r){
  var S = ETAT, n = g.n | 0, b0 = n ? g.barre(0) : null, profil = r.profil === 'eth' ? 'eth' : 'rth', F = fichier(g, profil);
  var stop = function(raison){ S.sig = ''; S.pret = false; S.raison = raison; return S; };
  if(!F) return stop('Single prints : profils TPO de TT introuvables');
  if(!F.lu){ lire(F); return stop(''); }
  if(!F.nb) return stop('Single prints : profils TPO de TT introuvables');
  if(!fenetre(g, profil, '')) return stop('Single prints : le profil de séance complète demande un graphe ETH');
  if(b0 && !dateDe(b0)) return stop('Single prints : dates de séance absentes du graphe');
  var sig = [g.sym, g.tf, g.seance, g.tick, cleBarre(b0), profil, F.nom, F.gen].join('|');
  if(sig !== S.sig || n < S.vu || (S.prev && cleBarre(g.barre(S.ip)) !== cleBarre(S.prev))){
    S.sig = sig; S.n = 0; S.prev = null; S.ip = -1; S.d = ''; S.clos = ''; S.W = {}; S.Z = []; S.act = []; S.pret = false; S.neufs = []; S.attente = '';
  }
  S.vu = n; S.raison = '';
  var tick = +g.tick || 0.25, ticks = typeof g.tf !== 'number', b;
  var P = {g:g, profil:profil, F:F, tick:tick, ticks:ticks, tol:ticks ? 0 : Math.max(1, g.tf) + 10, T:null};
  S.eps = tick / 4;
  for(var i = S.n, t0 = maintenant(); i < n; i++){
    if(!(i & 255) && i > S.n && i < n - 1 && maintenant() - t0 > BUDGET_MS){ S.n = i; redessiner(); return S; }
    if(!(b = g.barre(i))) continue;
    lit(S, b, i, P);
    S.prev = b; S.ip = i;
  }
  S.n = Math.max(S.n, n - 1); S.pret = true;
  if(S.attente){
    lire(F);
    S.raison = tr('Single prints : profil de TT en attente pour la séance du') + ' ' + S.attente.slice(8, 10) + '/' + S.attente.slice(5, 7);
  }
  return S;
}

// Market Profile : la page n'a pas de barres. Les profils qu'elle affiche
// (jours, jours fusionnes ou semaines : globales D, layoutCache, aggDay et
// MODE de marketprofile_pro.html) donnent les zones, et un niveau est pris
// par le premier profil suivant dont le haut et le bas l'encadrent, comme les
// single prints prolongees de TT ; le profil affiche (RTH ou ETH) est celui
// de la page, pas le reglage. Le dernier profil n'a pas de zones tant que sa
// seance n'est pas close (une semaine ou un replay : jamais), mais il prend
// les niveaux des precedents. Un jour ouvre absent entre deux profils
// journaliers masque les niveaux encore vierges. `P` les profils dans l'ordre
// de la page (`k` leur rang dans layoutCache), `Z` les zones ; chaque niveau
// porte `j`, le profil de sa zone, et `fin`, celui qui le prend.
var MP = {cle:'', P:[], Z:[]};
function calculProfil(g){
  var D0, LC, mode;
  try{ D0 = D; LC = layoutCache; mode = MODE; }catch(_){ return null; }
  if(!D0 || !D0.length || !LC || !LC.length) return null;
  var der = D0[D0.length - 1], tick = +g.tick || 0.25, eps = tick / 4;
  var ouvert = mode === 'weekly' || !!der._replay || !(Date.now() >= finMs(String(der.date).slice(0, 10), g.seance === 'eth' ? 'eth' : 'rth') + CUIT_MS);
  var cle = [mode, g.seance, tick, D0.length, D0[0].date, der.date, der.hi, der.lo, ouvert,
    LC.map(function(c){ return !c ? '' : c.merge ? c.merge.join('-') : c.i; }).join()].join('|');
  if(cle === MP.cle) return MP;
  var P = [], Z = [];
  LC.forEach(function(c, k){
    if(!c) return;
    var a = c.merge ? c.merge[0] : c.i, b = c.merge ? c.merge[1] : c.i, J = c.merge ? aggDay(a, b) : D0[a];
    if(J && D0[a] && D0[b]) P.push({k:k, J:J, a:String(D0[a].date).slice(0, 10), b:String(D0[b].date).slice(0, 10), close:D0[b].close, clos:!(ouvert && b === D0.length - 1)});
  });
  P.forEach(function(p, j){
    if(!p.clos) return;
    suites(p.J, tick).forEach(function(z){
      var Zn = zone(z, p, tick, p.b);
      Zn.N.forEach(function(v){
        v.j = j;
        for(var q = j + 1; q < P.length; q++){
          if(mode !== 'weekly' && ouvresEntre(P[q - 1].b, P[q].a)){ v.masque = true; break; }
          if(+P[q].J.lo - eps <= v.p && v.p <= +P[q].J.hi + eps){ v.fin = q; break; }
        }
      });
      Z.push(Zn);
    });
  });
  MP = {cle:cle, P:P, Z:Z};
  return MP;
}

function pousser(titre, texte){
  try{
    if(typeof Notification === 'undefined') return;
    var envoyer = function(){ try{ new Notification(titre, {body:texte}); }catch(_){} };
    if(Notification.permission === 'granted') envoyer();
    else if(Notification.permission !== 'denied') Notification.requestPermission().then(function(p){ if(p === 'granted') envoyer(); });
  }catch(_){}
}

// Une notification par barre pour les niveaux affiches qu'elle prend, sur les
// deux dernieres barres seulement : un saut de replay ne sonne pas pour ce
// qu'il enjambe.
function notifier(S, g, r){
  var n = g.n | 0, mini = +r.mini || 0, d = (String(g.tick).split('.')[1] || '').length;
  var N = S.neufs.filter(function(v){ return v.fin >= n - 2 && r['n' + v.q] && v.h >= mini; });
  S.neufs = [];
  if(r.alerte && N.length) pousser((g.sym ? g.sym + ' · ' : '') + 'Single prints',
    tr('Niveau pris') + ' : ' + N.map(function(v){ return v.q + ' % ' + v.p.toFixed(d); }).join(', '));
}

// Premier index de [deb, fin] dont l'abscisse atteint x, fin + 1 sinon : g.x
// croit avec l'index. Le footprint passe tout l'historique dans
// premiere..derniere, pas seulement les barres a l'ecran.
function borne(g, deb, fin, x){
  while(deb <= fin){ var m = (deb + fin) >> 1; if(g.x(m) < x) deb = m + 1; else fin = m - 1; }
  return deb;
}

HFQExt.etude({
  id:'single-prints-niveaux',
  nom:'Niveaux de single prints',
  famille:'Profil',
  desc:DESC,
  graphes:['profil','bougies','footprint'],

  reglages:[
    {k:'profil',     label:'Profil TPO',                 type:'select', defaut:'rth', options:[['rth','RTH'],['eth','Séance complète']]},
    {k:'mini',       label:'Hauteur minimale (ticks)',   type:'number', defaut:10, min:1, pas:1},
    {k:'n0',         label:'Niveau 0 % (bord d\'entrée)', type:'check', defaut:true},
    {k:'n25',        label:'Niveau 25 %',                type:'check',  defaut:true},
    {k:'n50',        label:'Niveau 50 %',                type:'check',  defaut:true},
    {k:'n75',        label:'Niveau 75 %',                type:'check',  defaut:true},
    {k:'n100',       label:'Niveau 100 % (bord opposé)', type:'check',  defaut:true},
    {k:'masquePris', label:'Masquer les niveaux pris',   type:'check',  defaut:false},
    {k:'couleur',    label:'Couleur',                    type:'color',  defaut:'#e8b84a'},
    {k:'style',      label:'Style',                      type:'select', defaut:'plein', options:[['plein','Plein'],['tirets','Tirets'],['points','Pointillés']]},
    {k:'ep',         label:'Épaisseur',                  type:'number', defaut:1, min:0.5, max:4, pas:0.5},
    {k:'op',         label:'Opacité',                    type:'number', defaut:0.85, min:0.05, max:1, pas:0.05},
    {k:'etiq',       label:'Étiquettes',                 type:'check',  defaut:true},
    {k:'alerte',     label:'Notification quand un niveau est pris', type:'check', defaut:false},
    {k:'legende',    label:'Légende',                    type:'check',  defaut:true}
  ],

  calcul:calcul,
  outils:{suites:suites, zone:zone, fenetre:fenetre, finMs:finMs, fichiers:FICHIERS, calculProfil:calculProfil},

  dessine:function(g, r){
    var F = g.cadre, e = g.echelle || 1, n = g.n | 0, Zs, xs;
    if(g.graphe === 'profil'){
      var M = calculProfil(g), LC = M ? layoutCache : null;
      if(!M) return;
      Zs = M.Z;
      // Du bord gauche du profil de la zone au bord gauche du profil qui prend le niveau.
      xs = function(v){
        var a = Math.max(LC[M.P[v.j].k].x0, F.gauche), b = v.fin >= 0 ? Math.min(LC[M.P[v.fin].k].x0, F.droite) : F.droite;
        return b > a ? [a, b] : null;
      };
    }
    else {
      var S = calcul(g, r);
      if(S.raison && r.legende) g.texte(F.gauche + 8 * e, F.haut + 14 * e, tr(S.raison), {couleur:'#8a929c', taille:10, align:'left'});
      if(!S.pret) return;
      notifier(S, g, r);
      var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, n - 1);
      if(fin < deb) return;
      deb = Math.max(deb, borne(g, deb, fin, F.gauche));
      fin = Math.min(fin, borne(g, deb, fin, F.droite + 1e-6) - 1);
      Zs = S.Z;
      // De la barre du print a celle qui prend le niveau, rogne au cadre.
      xs = function(v){
        return v.deb > fin || (v.fin >= 0 && v.fin < deb) ? null : [v.deb >= deb ? g.x(v.deb) : F.gauche, v.fin >= 0 && v.fin <= fin ? g.x(v.fin) : F.droite];
      };
    }
    var mini = +r.mini || 0, dec = (String(g.tick).split('.')[1] || '').length, T = [];
    for(var z = 0; z < Zs.length; z++){
      var Z = Zs[z];
      // Zones trop fines ou hors de l'echelle de prix : rien a projeter.
      if(Z.ticks < mini || g.y(Z.bas) < F.haut || g.y(Z.haut) > F.bas) continue;
      var yEtiq = null;
      for(var k = 0; k < Z.N.length; k++){
        var v = Z.N[k], X = !r['n' + v.q] || v.masque || (v.fin >= 0 && r.masquePris) ? null : xs(v);
        if(!X) continue;
        var y = g.y(v.p);
        if(y < F.haut || y > F.bas) continue;
        T.push([X[0], y], [X[1], y], [NaN, NaN]);
        // Etiquette au bout du trait ; deux niveaux a moins de 11 px ne portent que la premiere.
        if(r.etiq && (yEtiq === null || Math.abs(y - yEtiq) >= 11 * e)){
          g.texte(X[1] - 3 * e, y - 2 * e, 'SP ' + v.q + ' %  ' + v.p.toFixed(dec), {couleur:r.couleur, opacite:+r.op, taille:10, align:'right', base:'bottom'});
          yEtiq = y;
        }
      }
    }
    g.trait(T, {couleur:r.couleur, opacite:+r.op, epaisseur:+r.ep || 1, pointille:POINTILLE[r.style] || null});
  }
});

})();
