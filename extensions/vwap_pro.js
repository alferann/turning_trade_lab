// VWAP Pro : un VWAP ancre au choix sur la seance US, Asie ou Europe, la
// journee (la seance du graphe), la semaine ISO ou le mois, avec jusqu'a six
// paliers d'ecart-type libres (multiplicateur, couleur, epaisseur, style et
// opacite de la bande interieure pour chacun) et des themes de couleurs.
// Six instances identiques (A a F) pour superposer plusieurs ancrages.
// Reglages en sous-sections : une case a cocher par trait (VWAP, σ1 a σ6)
// fait office de titre, le panneau de TT n'en ayant pas.
//
// Les heures de seance viennent des « sessions monde » de TT (HFQSessionsMonde,
// modifiables dans TT) ou, a defaut, des memes valeurs par defaut ; chaque
// instance peut les forcer, dans le fuseau de son choix. Le VWAP se calcule
// sur le volume par prix du footprint quand la barre en a, sinon sur le
// volume de la barre a son prix typique.
//
// Rien n'est trace sur des donnees manquantes. La premiere periode du graphe,
// quand il ne la prend pas a son debut (un graphe en ticks remonte a deux
// semaines environ et commence ou il veut dans la seance), est completee par
// les barres d'une minute que TT sert aux bougies ; si elles n'y remontent pas
// non plus, la periode est masquee plutot que tracee depuis la premiere barre
// chargee. Plus loin, une periode entamee en retard est masquee, et une periode
// qui perd des donnees (barres de comblement d'un jour manquant, seance
// tronquee ou absente dans une semaine ou un mois) est masquee a partir de la.
(function(){

var ET = 'America/New_York', NSD = 6;
// ponytail: minute ET de l'ouverture du graphe, 18:00 en ETH et 09:30 en RTH (ES, NQ).
var OUVERTURE = {eth:1080, rth:570};
// ponytail: duree de la seance du graphe en minutes, 23 h en ETH et 6 h 30 en RTH (ES, NQ).
var DUREE = {eth:1380, rth:390};
// Ancrages sur une fenetre de seance du monde.
var SEANCES = {us:1, asie:1, eu:1};

// Memes defauts que hfq-sessions-monde.js : une seance court jusqu'a la suivante.
var DEFAUTS = [
  {id:'asie', h:18, m:0,  tz:ET},
  {id:'eu',   h:8,  m:0,  tz:'Europe/London'},
  {id:'us',   h:9,  m:30, tz:ET},
  {id:'fin',  h:16, m:0,  tz:ET}
];

var THEMES = {
  tt:    {vwap:'#ffb347', sd:['#5aa9e6','#b184e0','#e0567f','#4bd48e','#4fd6e0','#ffd166']},
  neon:  {vwap:'#ffffff', sd:['#00f0ff','#ff00e5','#39ff14','#ffe600','#ff6a00','#ff0040']},
  ocean: {vwap:'#e6f7ff', sd:['#8ee6ff','#4fc3f7','#2b9bd9','#1976d2','#3f51b5','#7e57c2']},
  feu:   {vwap:'#fff3d6', sd:['#ffe082','#ffb300','#ff8f00','#f4511e','#d32f2f','#8e24aa']},
  pastel:{vwap:'#f8f8f2', sd:['#a8e6cf','#dcedc1','#ffd3b6','#ffaaa5','#ff8b94','#c7ceea']},
  mono:  {vwap:'#ffffff', sd:['#d0d4da','#aab0b8','#848c96','#5f6873','#4a525c','#3a414a']}
};
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3], fins:[1,3], mixte:[8,3,2,3]};
// ponytail: budget du calcul a froid par image (demarrage, reglage, symbole) ; la suite aux images suivantes.
var BUDGET_MS = 4;
// ponytail: au zoom arriere, un point tous les PX_POINT pixels ; VWAP et bandes sont assez lisses pour que l'oeil n'y voie rien.
var PX_POINT = 2;
// ponytail: une periode commence dans les donnees si sa premiere barre tombe dans l'heure qui suit son debut (ouverture de la seance, de la fenetre, ou du premier jour ouvre de la semaine ou du mois).
var DEBUT_MAX = 60;
// ponytail: une seance close va jusqu'a sa fin si sa derniere barre tombe a moins de 4 h de la fin de la seance du graphe, cloture anticipee d'un jour ferie comprise (regle de pivots.js et confluence.js).
var FIN_MAX = 240;
var ZERO = {V:0, PV:0, PV2:0};
var NOMS ={jour:'DVWAP', sem:'wVWAP', mois:'mVWAP', us:'VWAP RTH', asie:'VWAP Asie', eu:'VWAP EU'};

var ANCRES = [['jour','Journalier (séance du graphe)'],['us','Séance US (RTH)'],['asie','Séance Asie'],['eu','Séance Europe'],['sem','Hebdomadaire (semaine ISO)'],['mois','Mensuel']];
var STYLES = [['plein','Plein'],['tirets','Tirets'],['points','Pointillés'],['fins','Pointillés fins'],['mixte','Tiret-point']];
var FUSEAUX = [[ET,'New York'],['America/Chicago','Chicago'],['Europe/London','Londres'],['Europe/Paris','Paris'],['Europe/Berlin','Francfort'],['Asia/Tokyo','Tokyo'],['Asia/Hong_Kong','Hong Kong'],['Asia/Singapore','Singapour'],['Australia/Sydney','Sydney'],['UTC','UTC']];
// Filet des titres de sous-section. Le panneau met les libelles en capitales
// sauf ceux des cases a cocher : un σ ailleurs s'afficherait Σ.
var FILET = ' ────────────────────';
var HEURES = [['auto','Auto (sessions de TT)']];
for(var mn = 0; mn < 1440; mn += 15) HEURES.push([String(mn), (mn / 60 < 10 ? '0' : '') + (mn / 60 | 0) + ':' + (mn % 60 ? mn % 60 : '00')]);

// Anglais : nom, description, reglages et options tels que le panneau les affiche.
var FICHIER = 'vwap_pro.js';
var DESC = {fr:'VWAP ancré (séance US, Asie, Europe, jour, semaine, mois), jusqu\'à six écarts-types libres, remplissage bande par bande, thèmes. Instance ',
            en:'Anchored VWAP (US, Asian, European session, day, week, month), up to six free standard deviations, band-by-band fill, themes. Instance '};
var DESC_FIN = {fr:' sur six (A à F), pour superposer plusieurs ancrages.', en:' of six (A to F), to stack several anchors.'};
var EN = {
  'Ancrage':'Anchoring', 'Journalier (séance du graphe)':'Daily (chart session)', 'Séance US (RTH)':'US session (RTH)',
  'Séance Asie':'Asian session', 'Séance Europe':'European session', 'Hebdomadaire (semaine ISO)':'Weekly (ISO week)', 'Mensuel':'Monthly',
  'Séance : début (auto = sessions de TT)':'Session: start (auto = TT sessions)', 'Séance : fin (auto = sessions de TT)':'Session: end (auto = TT sessions)',
  'Séance : fuseau des heures saisies':'Session: time zone of the hours entered', 'Auto (sessions de TT)':'Auto (TT sessions)',
  'Londres':'London', 'Francfort':'Frankfurt', 'Singapour':'Singapore',
  'Source du prix':'Price source', 'Footprint, sinon (H+L+C)/3':'Footprint, else (H+L+C)/3', '(H+L+C)/3 × volume':'(H+L+C)/3 × volume', 'Clôture × volume':'Close × volume',
  'Historique':'History', 'Toutes les périodes chargées':'All loaded periods', 'Période en cours seule':'Current period only',
  'Thème de couleurs':'Color theme', 'Perso (couleurs ci-dessous)':'Custom (colors below)', 'Néon':'Neon', 'Océan':'Ocean', 'Feu':'Fire', 'Pastel':'Pastel', 'Monochrome':'Monochrome',
  'Étiquettes de prix':'Price labels', 'VWAP seul':'VWAP only', 'VWAP et bandes':'VWAP and bands', 'Aucune':'None',
  'Couleur (thème Perso)':'Color (Custom theme)', 'Épaisseur':'Thickness', 'Style':'Style', 'Multiplicateur':'Multiplier',
  'Opacité de la bande intérieure (0 = aucune)':'Inner band opacity (0 = none)',
  'Plein':'Solid', 'Tirets':'Dashed', 'Pointillés':'Dotted', 'Pointillés fins':'Fine dots', 'Tiret-point':'Dash-dot',
  'VWAP Asie':'VWAP Asia'
};
['A', 'B', 'C', 'D', 'E', 'F'].forEach(function(l){
  var fr = DESC.fr + l + DESC_FIN.fr, en = DESC.en + l + DESC_FIN.en, suffixe = ' (extensions/' + FICHIER + ')';
  EN[fr] = en; EN[fr + suffixe] = en + suffixe;
});

// Le panneau d'etudes s'ouvre dans la fenetre du terminal, au-dessus des
// graphes : le dictionnaire s'enregistre dans chaque fenetre parente.
function anglais(D){
  var w = typeof window !== 'undefined' ? window : null;
  for(var n = 0; w && n < 8; n++){
    try{ if(w.HFQI18n) w.HFQI18n.dict('en', D); }catch(_){}
    try{ w = w.parent !== w ? w.parent : null; }catch(_){ w = null; }
  }
}
// Textes du canevas, que HFQI18n ne voit pas.
function tr(s){ return typeof HFQI18n !== 'undefined' && HFQI18n.t ? HFQI18n.t(s) : s; }
anglais(EN);

var DECAL = {};
// Decalage d'un fuseau par rapport a UTC, en minutes, a midi UTC de la date.
function decalage(tz, date){
  var cle = tz + '|' + date;
  if(DECAL[cle] != null) return DECAL[cle];
  var d = new Date(date + 'T12:00:00Z'), v;
  try{
    var p = new Intl.DateTimeFormat('en-US', {timeZone:tz, hourCycle:'h23', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}).formatToParts(d), o = {};
    for(var i = 0; i < p.length; i++) o[p[i].type] = p[i].value;
    v = Math.round((Date.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute) - d.getTime()) / 60000);
  }catch(_){ v = tz === ET ? -300 : 0; }
  DECAL[cle] = v;
  return v;
}

// Minute de la journee New York d'une heure locale (minutes) dans un fuseau.
function versET(min, tz, date){
  return ((min - decalage(tz, date) + decalage(ET, date)) % 1440 + 1440) % 1440;
}

// Bornes [debut, fin) en minutes ET d'une seance pour une date : les heures
// forcees de l'instance d'abord, sinon les sessions monde de TT, sinon DEFAUTS.
function bornesET(anc, date, r){
  var deb = r.deb !== 'auto' ? versET(+r.deb, r.tz, date) : null;
  var fin = r.fin !== 'auto' ? versET(+r.fin, r.tz, date) : null;
  if(deb === null || fin === null){
    var tt = null;
    try{
      if(typeof HFQSessionsMonde !== 'undefined'){
        var B = HFQSessionsMonde.bornes(date);
        for(var i = 0; i < B.length; i++) if(B[i].id === anc) tt = B[i];
      }
    }catch(_){}
    if(tt){
      if(deb === null) deb = Math.round(tt.debut / 60) % 1440;
      if(fin === null) fin = Math.round(tt.fin / 60) % 1440;
    } else {
      var k = 0;
      while(k < DEFAUTS.length - 1 && DEFAUTS[k].id !== anc) k++;
      var d = DEFAUTS[k], s = DEFAUTS[k + 1];
      if(deb === null) deb = versET(d.h * 60 + d.m, d.tz, date);
      if(fin === null) fin = versET(s.h * 60 + s.m, s.tz, date);
    }
  }
  return [deb, fin];
}

// Bornes ET vers minutes de seance du graphe ; une fin avant le debut passe le minuit de seance.
function fenetreM(bornes, ouv){
  var a = (bornes[0] - ouv + 1440) % 1440, b = (bornes[1] - ouv + 1440) % 1440;
  if(b <= a) b += 1440;
  return [a, b];
}
function dansF(F, m){ return (m >= F[0] && m < F[1]) || (m + 1440 >= F[0] && m + 1440 < F[1]); }

// Minutes entre le debut de l'ancrage et la minute m d'une seance du graphe
// datee `date` : depuis l'ouverture (jour, et semaine ou mois a son premier
// jour ouvre, Infinity un autre jour), depuis le debut de la fenetre F (us,
// asie, eu). Une fenetre qui enjambe l'ouverture du graphe a commence dans la
// seance precedente : Infinity si le marche y traitait, sinon depuis l'ouverture.
function ecart(anc, F, date, m, dur){
  if(F) return m >= F[0] ? m - F[0] : F[0] >= dur ? m : Infinity;
  return (anc === 'sem' || anc === 'mois') && date && !premierOuvre(anc, date) ? Infinity : m;
}

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

// Cle de la semaine ISO ou du mois d'une date de seance.
function periode(anc, date){ return anc === 'sem' ? 's' + semaine(date) : 'm' + date.slice(0, 7); }

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

// Fin de seance en minutes depuis l'ouverture : la cloture normale `dur`, ou
// 13:00 ET les jours de seance ecourtee du CME (type `reduit` de
// HFQSessions.feriesUS : Labor Day, Thanksgiving...), minute 1140 sur ETH,
// 210 sur RTH (2026-11-04 : le Labor Day fini a 12:59 ET passait pour une
// seance incomplete et masquait septembre).
// ponytail: 13:00 ET pour tous les jours ecourtes ; les veilles de fete qui
// ferment a 13:15 restent dans la marge de 4 h.
var REDUITS = {};
function finSeance(date, dur){
  var an = String(date).slice(0, 4);
  if(!REDUITS[an]){
    REDUITS[an] = {};
    try{ HFQSessions.feriesUS(+an).forEach(function(f){ if(f.type === 'reduit') REDUITS[an][f.date] = 1; }); }catch(_){}
  }
  return REDUITS[an][String(date).slice(0, 10)] ? Math.min(dur, dur <= 390 ? 210 : 1140) : dur;
}

// Vrai si la date est le premier jour ouvre de sa semaine ou de son mois.
function premierOuvre(anc, date){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if(!m) return false;
  var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = anc === 'sem' ? t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5 : Date.UTC(+m[1], +m[2] - 1, 1);
  for(; d < t; d += 864e5) if(ouvre(d)) return false;
  return true;
}

// Jours ouvres strictement entre deux dates AAAA-MM-JJ : autant de seances manquantes.
function manquent(a, b){
  var n = 0;
  for(var d = Date.parse(a) + 864e5, f = Date.parse(b); d < f; d += 864e5) if(ouvre(d)) n++;
  return n;
}

// Barres d'une minute que TT sert aux bougies (vingt-quatre seances
// glissantes), lues une fois par fichier et partagees par les six instances,
// completees pour les jours que le fichier ne tient plus par l'archive minute
// par jour que le hub sert en gzip (_hist/profile_<ROOT>_<date>.json.gz, depuis
// fin aout 2026) : `depuis` est le premier jour dont la periode a besoin
// (2026-11-04 : le mois precedent n'est jamais entier dans le fichier). Un
// graphe en ticks ne remonte qu'a deux semaines environ : elles completent la
// seance, la fenetre, la semaine ou le mois de sa premiere barre.
var MINUTES = {};
function racine(sym){ return String(sym || '').toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, ''); }
function iso(ms){ return new Date(ms).toISOString().slice(0, 10); }
// Minute depuis 18:00 ET d'un horodatage unix en secondes, heure d'ete comprise.
var FMT = null;
function minuteET(t){
  if(!FMT) FMT = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', hour12:false, hour:'2-digit', minute:'2-digit'});
  var h = 0, mi = 0;
  FMT.formatToParts(new Date(t * 1000)).forEach(function(x){ if(x.type === 'hour') h = +x.value % 24; else if(x.type === 'minute') mi = +x.value; });
  return (h >= 18 ? h - 18 : h + 6) * 60 + mi;
}
// Date de seance (AAAA-MM-JJ) d'un horodatage unix en secondes : la seance
// ouverte a 18:00 ET porte la date du lendemain.
var FMTJ = null;
function dateSeanceET(t){
  if(!FMTJ) FMTJ = new Intl.DateTimeFormat('en-US', {timeZone:'America/New_York', year:'numeric', month:'2-digit', day:'2-digit'});
  var y = '', mo = '', d = '';
  FMTJ.formatToParts(new Date((t + 6 * 3600) * 1000)).forEach(function(x){ if(x.type === 'year') y = x.value; else if(x.type === 'month') mo = x.value; else if(x.type === 'day') d = x.value; });
  return y + '-' + mo + '-' + d;
}
// Fichier de l'archive, lu une fois et partage par les instances : {pret, j, puis}, j le
// JSON ou null s'il manque, puis les suites a appeler a l'arrivee. Chaque
// fichier est un jour calendaire UTC (00:00Z a 24:00Z), pas une seance
// (2026-11-04) : la seance d'une date commence la veille a 18:00 ET, dans le
// fichier de la veille, et le fichier d'une date finit par les premieres
// heures de la seance suivante.
var FICHIERS = {};
function fichier(sym, date){
  var k = racine(sym) + '|' + date, F = FICHIERS[k];
  if(F) return F;
  F = FICHIERS[k] = {pret:false, j:null, puis:[]};
  var fini = function(){ F.pret = true; var L = F.puis; F.puis = []; for(var i = 0; i < L.length; i++) L[i](); };
  try{
    fetch('/_hist/profile_' + racine(sym) + '_' + date + '.json.gz', {cache:'no-cache'})
      .then(function(rep){ if(!rep.ok) throw new Error('absent'); return rep.arrayBuffer(); })
      .then(function(buf){ return new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).json(); })
      .then(function(j){ F.j = j; fini(); }, fini);
  }catch(_){ fini(); }
  return F;
}
// Barres de la seance `date` parmi celles des fichiers J, par date de seance,
// au format des seances du fichier minute ({date, bars:[{m, o, h, l, c, v,
// lv}]}) ; null si un fichier manque ou est incomplet.
function convertir(J, date){
  var bars = [];
  for(var n = 0; n < J.length; n++){
    var j = J[n];
    if(!j || !Array.isArray(j.bars) || j.complete === false) return null;
    for(var i = 0; i < j.bars.length; i++){
      var b = j.bars[i], L, lv, q;
      if(dateSeanceET(+b.t) !== date) continue;
      L = b.ladder || []; lv = [];
      for(q = 0; q < L.length; q++) lv.push([+L[q][0], +L[q][1] || 0, +L[q][2] || 0]);
      bars.push({m:minuteET(+b.t), o:+b.o, h:+b.h, l:+b.l, c:+b.c, v:+b.v || 0, lv:lv});
    }
  }
  return bars.length ? {date:date, bars:bars} : null;
}
// Seance d'une date assemblee depuis les fichiers de la veille et du jour.
function jourHist(M, sym, date){
  var J = M.H[date] = {pret:false, s:null};
  var A = fichier(sym, iso(Date.parse(date) - 864e5)), B = fichier(sym, date);
  var fini = function(){ if(!A.pret || !B.pret) return; J.s = convertir([A.j, B.j], date); J.pret = true; };
  if(A.pret && B.pret){ fini(); return; }
  var puis = function(){ if(J.pret) return; fini(); if(J.pret){ M.gen++; M.tout = null; redessiner(); } };
  if(!A.pret) A.puis.push(puis);
  if(!B.pret) B.puis.push(puis);
}
// Premier jour calendaire de la semaine ISO ou du mois d'une date.
function premierJour(anc, date){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if(!m) return date;
  var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  return iso(anc === 'sem' ? t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5 : Date.UTC(+m[1], +m[2] - 1, 1));
}
function minutes(g, depuis){
  var f;
  try{ f = HFQSymGuard.histFile(g.seance === 'rth' ? '_footprint' : '_footprint_eth', g.sym); }catch(_){ return null; }
  var M = MINUTES[f];
  if(!M){
    M = MINUTES[f] = {pret:false, lu:false, S:[], H:{}, gen:0, tout:null, sessions:function(){ return tout(this); }};
    var fini = function(){ M.lu = true; M.gen++; M.tout = null; redessiner(); };
    try{
      fetch(f, {cache:'no-cache'}).then(function(rep){ return rep.json(); })
        .then(function(j){ if(j && Array.isArray(j.sessions)) M.S = j.sessions; fini(); }, fini);
    }catch(_){ M.lu = true; }
  }
  // Les jours ouvres de `depuis` au premier du fichier, dans l'archive par jour.
  if(M.lu && depuis){
    var premier = M.S.length ? String(M.S[0].date || '').slice(0, 10) : aujourdhui(), t = Date.parse(depuis);
    for(var d = t; isFinite(t) && iso(d) < premier && d < t + 45 * 864e5; d += 864e5) if(ouvre(d) && !M.H[iso(d)]) jourHist(M, g.sym, iso(d));
  }
  var pret = M.lu;
  for(var k in M.H) if(!M.H[k].pret) pret = false;
  M.pret = pret;
  return M;
}
// Seances du fichier, precedees des jours de l'archive lus, par date.
function tout(M){
  if(M.tout) return M.tout;
  var L = [], k;
  for(k in M.H) if(M.H[k].s) L.push(M.H[k].s);
  L.sort(function(a, b){ return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  return M.tout = L.concat(M.S);
}

// Ajoute a A les sommes d'une barre du fichier minute, comme calcul le fait d'une barre du graphe.
function sommes(A, b, src){
  var lv = b.lv || [], w = 0, p, v, k;
  for(k = 0; k < lv.length; k++){
    v = (lv[k][1] || 0) + (lv[k][2] || 0); w += v;
    if(src === 'auto'){ p = lv[k][0]; A.V += v; A.PV += p * v; A.PV2 += p * p * v; }
  }
  if(src === 'auto') return;
  p = src === 'close' ? b.c : (b.h + b.l + b.c) / 3;
  A.V += w; A.PV += p * w; A.PV2 += p * p * w;
}

// Premiere periode du graphe quand il ne la prend pas a son debut (graphe en
// ticks) : {cle, ok, V, PV, PV2}, les sommes des barres d'une minute du fichier
// qui precedent sa premiere barre, dans la fenetre de l'ancrage. ok faux, et la
// periode masquee, tant que le fichier n'est pas lu ou si ces barres ne la
// couvrent pas : debut de la periode absent, seance entamee en retard ou
// tronquee, plus d'un jour ouvre sans seance (le fichier n'a pas de barres de
// comblement), derniere barre plus d'une heure avant la premiere du graphe.
// null s'il n'y a rien a completer, ou rien pour le faire : un graphe en
// minutes est tire de ce fichier, une barre sans date n'a pas de periode ;
// calcul y masque la periode.
function amorce(C, g, r, b0, sig){
  if(!b0 || !dateDe(b0) || typeof g.tf === 'number') return null;
  var anc = r.anc, date0 = dateDe(b0), m0 = +b0.m, dur = DUREE[g.seance] || DUREE.eth, cal = anc === 'sem' || anc === 'mois';
  var F = SEANCES[anc] ? fenetreM(bornesET(anc, date0, r), OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080) : null;
  if((F && !dansF(F, m0)) || ecart(anc, F, date0, m0, dur) < DEBUT_MAX) return null;
  var M = minutes(g, cal ? premierJour(anc, date0) : date0), k = sig + '|' + (M ? M.pret + ':' + M.gen : '-');
  if(C.amo && C.amo.k === k) return C.amo.A;
  // La seance de la premiere barre ne vient du fichier que si le graphe ne la prend pas dans l'heure.
  var A = {cle:cal ? periode(anc, date0) : 'j0', ok:false, V:0, PV:0, PV2:0}, besoin = ecart(anc, F, '', m0, dur) >= DEBUT_MAX;
  var S = M && M.pret ? M.sessions() : [], debut = !cal, ok = true, vu = false, prec = null;
  for(var i = 0; i < S.length; i++){
    var d = String(S[i].date || '').slice(0, 10), B = S[i].bars || [];
    if(!B.length || d > date0 || (!cal && d !== date0)) continue;
    // Une seance d'avant la periode : son debut est dans le fichier.
    if(cal && periode(anc, d) !== A.cle){ debut = true; prec = d; continue; }
    if(prec && manquent(prec, d) > 0) ok = false;
    if(!vu){ vu = true; debut = debut || premierOuvre(anc, d); }
    var fin = d < date0 ? Infinity : m0, e0 = null, e1 = null;
    for(var j = 0; j < B.length; j++){
      var m = +B[j].m;
      if(m + 1 > fin || (F && !dansF(F, m))) continue;
      if(e0 === null) e0 = m;
      e1 = m;
      sommes(A, B[j], r.src);
    }
    // Chaque seance entamee dans l'heure ; une veille jusqu'a sa fin, le jour meme jusqu'a l'heure qui precede la premiere barre du graphe.
    if(d < date0 || besoin) ok = ok && e0 !== null && ecart(anc, F, '', e0, dur) < DEBUT_MAX && (d < date0 ? e1 >= finSeance(d, dur) - FIN_MAX : e1 + 1 >= m0 - DEBUT_MAX);
    prec = d;
  }
  A.ok = debut && ok && prec !== null && (prec === date0 || (!besoin && !manquent(prec, date0)));
  C.amo = {k:k, A:A};
  return A;
}

function aujourdhui(){ return new Date().toISOString().slice(0, 10); }
// Date de seance AAAA-MM-JJ d'une barre : `_date` des bougies, sinon `_sd`,
// que le footprint pose sur ses barres (2026-11-03 : sans elle, l'hebdo et le
// mensuel y repartaient a chaque seance et les fenetres se lisaient a la date du jour).
function dateDe(b){ return b ? String(b._date || b._sd || '').slice(0, 10) : ''; }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? dateDe(b) + ':' + b.m : ''; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

function cache(){ return {sig:'', id0:'', der:'', n:0, fen:{}, cle:[], sessAt:new Int32Array(0), ok:new Uint8Array(0), V:new Float64Array(0), PV:new Float64Array(0), PV2:new Float64Array(0), vwap:new Float64Array(0), sd:new Float64Array(0)}; }

function agrandir(C, n){
  if(C.V.length >= n) return;
  var t = Math.max(n, C.V.length * 2), s = new Int32Array(t), o = new Uint8Array(t);
  s.set(C.sessAt); C.sessAt = s;
  o.set(C.ok); C.ok = o;
  ['V','PV','PV2','vwap','sd'].forEach(function(k){ var a = new Float64Array(t); a.set(C[k]); C[k] = a; });
}

// Sommes cumulees par ancrage, barre par barre. Incremental : si le graphe a
// seulement grandi depuis le dernier appel, seules la derniere barre connue
// (qui a pu grossir) et les nouvelles sont recalculees. Si cette barre n'est
// plus a son index (barres inserees plus tot, comme l'historique en ticks qui
// se remplit), tout repart de zero. Passee l'echeance `fin`, la lecture
// s'arrete et C.n dit jusqu'ou elle est allee : l'appel suivant reprend la,
// par le meme chemin incremental.
function calcul(C, g, r, fin){
  var n = g.n | 0, b0 = n ? g.barre(0) : null;
  var sig = [g.sym, g.tf, g.seance, r.anc, r.deb, r.fin, r.tz, r.src].join('|');
  var id0 = cleBarre(b0), A = amorce(C, g, r, b0, sig + '|' + id0);
  var depuis = (C.sig === sig && C.id0 === id0 && C.A === A && n >= C.n && C.n > 0 && cleBarre(g.barre(C.n - 1)) === C.der) ? C.n - 1 : 0;
  if(!depuis) C.fen = {};
  agrandir(C, n);
  var ouv = OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080, dur = DUREE[g.seance] || DUREE.eth;
  var prev = depuis > 0 ? g.barre(depuis - 1) : null;
  var sess = depuis > 0 ? C.sessAt[depuis - 1] : 0;
  for(var i = depuis; i < n; i++){
    if(fin && !(i & 255) && i > depuis && maintenant() > fin) break;
    var b = g.barre(i);
    if(!b){ C.cle[i] = null; C.vwap[i] = NaN; C.sd[i] = NaN; C.sessAt[i] = sess; C.V[i] = 0; C.ok[i] = 0; continue; }
    var date = dateDe(b), cle, F = null;
    if(prev && (date ? date !== dateDe(prev) : +b.m < +prev.m)) sess++;
    C.sessAt[i] = sess;
    if(r.anc === 'jour') cle = 'j' + sess;
    else if(r.anc === 'sem' || r.anc === 'mois') cle = date ? periode(r.anc, date) : 'j' + sess;
    else {
      F = C.fen[date] || (C.fen[date] = fenetreM(bornesET(r.anc, date || aujourdhui(), r), ouv));
      cle = dansF(F, +b.m) ? 'j' + sess : null;
    }
    var v = 0, pv = 0, pv2 = 0, p, w;
    if(cle && !b._trou){
      var L = r.src === 'auto' ? g.niveaux(i) : null;
      if(L && L.n){
        for(var k = 0; k < L.n; k++){ p = L.prix(k); w = L.bid(k) + L.ask(k); if(w > 0){ v += w; pv += p * w; pv2 += p * p * w; } }
      } else {
        p = r.src === 'close' ? b.c : (b.h + b.l + b.c) / 3; w = +b.v || 0;
        v = w; pv = p * w; pv2 = p * p * w;
      }
    }
    var suite = i > 0 && cle && C.cle[i - 1] === cle, A0 = !suite && A && cle === A.cle ? A : ZERO;
    C.V[i] = (suite ? C.V[i - 1] : A0.V) + v;
    C.PV[i] = (suite ? C.PV[i - 1] : A0.PV) + pv;
    C.PV2[i] = (suite ? C.PV2[i - 1] : A0.PV2) + pv2;
    C.cle[i] = cle;
    // Periode chargee en entier jusqu'ici : entamee dans l'heure (ou completee
    // par le fichier minute), sans barre de comblement ; dans une semaine ou un
    // mois, chaque seance entamee dans l'heure, la precedente allee jusqu'a sa
    // fin, sans jour ouvre manquant entre elles. Sinon masquee jusqu'a la suivante.
    // ponytail: seule la premiere periode du graphe se complete par le fichier minute ; plus loin, une seance entamee en retard (jour partiel d'un graphe en ticks) est masquee, et un trou au milieu d'une seance sans barre de comblement passe inapercu.
    var ok = !!cle && !b._trou;
    if(ok && !suite) ok = ecart(r.anc, F, date, +b.m, dur) < DEBUT_MAX || (A0 === A && A.ok);
    else if(ok) ok = C.ok[i - 1] === 1 && (C.sessAt[i - 1] === sess || (+prev.m >= finSeance(dateDe(prev), dur) - FIN_MAX && +b.m < DEBUT_MAX && !manquent(dateDe(prev), date)));
    C.ok[i] = ok ? 1 : 0;
    if(ok && C.V[i] > 0){
      var vw = C.PV[i] / C.V[i];
      C.vwap[i] = vw; C.sd[i] = Math.sqrt(Math.max(0, C.PV2[i] / C.V[i] - vw * vw));
    } else { C.vwap[i] = NaN; C.sd[i] = NaN; }
    prev = b;
  }
  C.n = i; C.sig = sig; C.id0 = id0; C.A = A; C.der = cleBarre(g.barre(i - 1));
  return C;
}

// Premier index de [deb, fin] dont l'abscisse atteint x, fin + 1 sinon : g.x
// croit avec l'index. Le footprint passe tout l'historique dans
// premiere..derniere, pas seulement les barres a l'ecran.
function borne(g, deb, fin, x){
  while(deb <= fin){ var m = (deb + fin) >> 1; if(g.x(m) < x) deb = m + 1; else fin = m - 1; }
  return deb;
}

// Remplit entre deux polylignes de meme longueur, un polygone par tronçon continu.
function remplir(g, A, B, col, op){
  var c = g.ctx, n = A.length, i = 0, k;
  if(!c || !(op > 0)) return;
  c.save(); c.fillStyle = col; c.globalAlpha = Math.min(1, op);
  while(i < n){
    while(i < n && !(A[i] && B[i])) i++;
    var j = i;
    while(j < n && A[j] && B[j]) j++;
    if(j - i >= 2){
      c.beginPath(); c.moveTo(A[i][0], A[i][1]);
      for(k = i + 1; k < j; k++) c.lineTo(A[k][0], A[k][1]);
      for(k = j - 1; k >= i; k--) c.lineTo(B[k][0], B[k][1]);
      c.closePath(); c.fill();
    }
    i = j;
  }
  c.restore();
}

function reglages(d){
  var R = [
    {k:'anc',   label:'Ancrage', type:'select', defaut:d.anc, options:ANCRES},
    {k:'deb',   label:'Séance : début (auto = sessions de TT)', type:'select', defaut:'auto', options:HEURES},
    {k:'fin',   label:'Séance : fin (auto = sessions de TT)', type:'select', defaut:'auto', options:HEURES},
    {k:'tz',    label:'Séance : fuseau des heures saisies', type:'select', defaut:ET, options:FUSEAUX},
    {k:'src',   label:'Source du prix', type:'select', defaut:'auto', options:[['auto','Footprint, sinon (H+L+C)/3'],['hlc3','(H+L+C)/3 × volume'],['close','Clôture × volume']]},
    {k:'hist',  label:'Historique', type:'select', defaut:'tout', options:[['tout','Toutes les périodes chargées'],['cour','Période en cours seule']]},
    {k:'theme', label:'Thème de couleurs', type:'select', defaut:d.theme, options:[['perso','Perso (couleurs ci-dessous)'],['tt','Turning Trade'],['neon','Néon'],['ocean','Océan'],['feu','Feu'],['pastel','Pastel'],['mono','Monochrome']]},
    {k:'etiq',  label:'Étiquettes de prix', type:'select', defaut:'vwap', options:[['vwap','VWAP seul'],['tous','VWAP et bandes'],['off','Aucune']]},
    {k:'vwapOn', label:'VWAP' + FILET, type:'check', defaut:true},
    {k:'vwapC', label:'Couleur (thème Perso)', type:'color', defaut:THEMES.tt.vwap},
    {k:'vwapE', label:'Épaisseur', type:'number', defaut:1.5, min:0.5, max:5, pas:0.5},
    {k:'vwapT', label:'Style', type:'select', defaut:'plein', options:STYLES}
  ];
  // La bande interieure d'un palier va du palier de multiplicateur juste
  // inferieur (ou du VWAP) jusqu'a lui, des deux cotes.
  var sd = [1, 2, 3, 4, 5, 6], op = [0.08, 0.05, 0.03, 0, 0, 0];
  for(var k = 1; k <= NSD; k++){
    R.push({k:'on' + k, label:'σ' + k + FILET, type:'check', defaut:k <= 3});
    R.push({k:'sd' + k, label:'Multiplicateur', type:'number', defaut:sd[k - 1], min:0, max:10, pas:0.1});
    R.push({k:'c' + k,  label:'Couleur (thème Perso)', type:'color', defaut:THEMES.tt.sd[k - 1]});
    R.push({k:'e' + k,  label:'Épaisseur', type:'number', defaut:1, min:0.5, max:5, pas:0.5});
    R.push({k:'t' + k,  label:'Style', type:'select', defaut:'tirets', options:STYLES});
    R.push({k:'f' + k,  label:'Opacité de la bande intérieure (0 = aucune)', type:'number', defaut:op[k - 1], min:0, max:0.6, pas:0.01});
  }
  return R;
}

function instance(lettre, d){
  var C = cache();
  var def = {
    id:'vwap-pro-' + lettre.toLowerCase(),
    nom:'VWAP Pro · ' + lettre,
    famille:'VWAP',
    desc:DESC.fr + lettre + DESC_FIN.fr,
    graphes:['bougies','footprint'],
    reglages:reglages(d),
    calcul:function(g, r){ return calcul(C, g, r); },
    outils:{versET:versET, bornesET:bornesET, semaine:semaine, finSeance:finSeance},
    dessine:function(g, r){
      // Rien n'est dessine tant que le calcul a froid n'a pas rattrape le graphe.
      calcul(C, g, r, maintenant() + BUDGET_MS);
      if(C.n < (g.n | 0)){ redessiner(); return; }
      var n = C.n, deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, n - 1), i, j, k;
      // Une barre de part et d'autre du cadre, pour que les traits en sortent.
      deb = Math.max(deb, borne(g, deb, fin, g.cadre.gauche) - 1);
      fin = Math.min(fin, borne(g, deb, fin, g.cadre.droite));
      if(fin < deb) return;
      var seule = null;
      if(r.hist === 'cour') for(i = n - 1; i >= 0 && !seule; i--) seule = C.cle[i];
      var trace = function(i){ return isFinite(C.vwap[i]) && !(seule && C.cle[i] !== seule); };
      // Barres par point, sur des multiples du pas pour que les points ne bougent pas au defilement.
      var pas = Math.max(1, Math.floor(PX_POINT * (g.echelle || 1) / Math.max(Math.abs(g.x(deb + 1) - g.x(deb)), 1e-9)));
      var paliers = [];
      for(k = 1; k <= NSD; k++){ var mult = +r['sd' + k]; if(r['on' + k] && mult > 0) paliers.push({k:k, mult:mult}); }
      paliers.sort(function(a, b){ return a.mult - b.mult; });
      var th = THEMES[r.theme], colV = th ? th.vwap : r.vwapC;
      var couleur = function(k){ return th ? th.sd[k - 1] : r['c' + k]; };
      var P0 = [], Hs = [], Bs = [], dernier = -1;
      for(j = 0; j < paliers.length; j++){ Hs.push([]); Bs.push([]); }
      for(i = deb; i <= fin; i++){
        var vw = C.vwap[i];
        if(!trace(i)){
          P0.push(null);
          for(j = 0; j < paliers.length; j++){ Hs[j].push(null); Bs[j].push(null); }
          continue;
        }
        // Les deux bouts de chaque troncon et de chaque periode restent, et la derniere barre.
        if(i % pas && i < fin && trace(i - 1) && trace(i + 1) && C.cle[i - 1] === C.cle[i] && C.cle[i + 1] === C.cle[i]) continue;
        var x = g.x(i), sd = C.sd[i];
        P0.push([x, g.y(vw)]);
        for(j = 0; j < paliers.length; j++){ var e = paliers[j].mult * sd; Hs[j].push([x, g.y(vw + e)]); Bs[j].push([x, g.y(vw - e)]); }
        dernier = i;
      }
      for(j = 0; j < paliers.length; j++){
        var op = +r['f' + paliers[j].k], col = couleur(paliers[j].k);
        remplir(g, j ? Hs[j - 1] : P0, Hs[j], col, op);
        remplir(g, j ? Bs[j - 1] : P0, Bs[j], col, op);
      }
      for(j = 0; j < paliers.length; j++){
        k = paliers[j].k;
        var st = {couleur:couleur(k), epaisseur:+r['e' + k] || 1, pointille:POINTILLE[r['t' + k]] || null};
        g.trait(Hs[j], st); g.trait(Bs[j], st);
      }
      if(r.vwapOn) g.trait(P0, {couleur:colV, epaisseur:+r.vwapE || 1.5, pointille:POINTILLE[r.vwapT] || null});
      if(r.etiq !== 'off' && dernier >= 0){
        var v0 = C.vwap[dernier], s0 = C.sd[dernier];
        if(r.vwapOn) g.etiquette(v0, {couleur:colV, texte:tr(NOMS[r.anc] || 'VWAP'), sansTrait:true});
        if(r.etiq === 'tous') for(j = 0; j < paliers.length; j++){
          var e2 = paliers[j].mult * s0, c2 = couleur(paliers[j].k), txt = paliers[j].mult + 'σ';
          g.etiquette(v0 + e2, {couleur:c2, texte:'+' + txt, sansTrait:true});
          g.etiquette(v0 - e2, {couleur:c2, texte:'−' + txt, sansTrait:true});
        }
      }
    }
  };
  HFQExt.etude(def);
}

instance('A', {anc:'jour', theme:'perso'});
instance('B', {anc:'us',   theme:'neon'});
instance('C', {anc:'sem',  theme:'ocean'});
instance('D', {anc:'mois', theme:'feu'});
instance('E', {anc:'eu',   theme:'pastel'});
instance('F', {anc:'asie', theme:'mono'});

})();
