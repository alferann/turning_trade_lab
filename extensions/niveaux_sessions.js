// Hauts et bas des sessions precedentes : le haut et le bas de la derniere
// session close de chaque session du monde de TT (Tokyo, Londres, New York,
// cloture), prolonges depuis la barre de l'extreme jusqu'a la premiere meche
// qui les touche, la premiere cloture au-dela ou le bord droit. Bornes, noms
// et couleurs viennent du panneau Sessions du monde de TT, qui trace deja le
// haut et le bas de chaque session sur sa propre bande : l'etude prend le
// relais une fois la session close. Notification au premier toucher ou a la
// premiere cloture au-dela, au choix.
//
// Une barre appartient a la session qui contient son milieu, comme sur les
// bandes de TT. La session de la derniere barre est en cours : elle ne passe
// en session close qu'a l'arrivee d'une barre de la session suivante.
//
// Rien n'est tire de donnees manquantes : une session prise en cours, coupee
// avant sa fin, trouee ou suivie d'une occurrence absente (seance coupee ou
// manquante, jour ouvre sans barre) n'est pas tracee.
(function(){

var ET = 'America/New_York';
// ponytail: minute ET de l'ouverture du graphe, 18:00 en ETH et 09:30 en RTH (ES, NQ).
var OUVERTURE = {eth:1080, rth:570};
// ponytail: duree de la seance du graphe en minutes, 23 h en ETH et 6 h 30 en RTH (ES, NQ) ; au-dela, la pause.
var DUREE = {eth:1380, rth:390};
// Memes defauts que hfq-sessions-monde.js, que le footprint ne charge pas.
var DEFAUTS = [
  {id:'asie', nom:'Tokyo',    h:18, m:0,  tz:ET,              col:'#4bd48e'},
  {id:'eu',   nom:'Londres',  h:8,  m:0,  tz:'Europe/London', col:'#5cb0ff'},
  {id:'us',   nom:'New York', h:9,  m:30, tz:ET,              col:'#e0e6ec'},
  {id:'fin',  nom:'Clôture',  h:16, m:0,  tz:ET,              col:'#b98bff'}
];
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3]};
// ponytail: budget du premier passage par image (60 ms pour 115 000 barres d'une minute) ; la suite aux images suivantes.
var BUDGET_MS = 4;
// `n` barres closes lues, `vu` taille du graphe au dernier passage, `j` index
// de seance du graphe de la derniere barre close, `cour` la session en cours,
// `D` la derniere session close de chaque id, `pret` l'historique rattrape.
var ETAT = {sig:'', n:0, vu:0, j:0, prev:null, ip:-1, F:{}, cour:null, D:{}, pret:false, neufs:[]};

// Anglais : nom, description, reglages, options et textes du canevas.
var DESC = 'Haut et bas de la dernière session close de Tokyo, Londres, New York et de la clôture, selon les sessions du monde de TT, prolongés jusqu\'au premier toucher, à la première clôture au-delà ou au bord droit, notification au choix.';
var DESC_EN = 'High and low of the last closed Tokyo, London, New York and close session, from TT\'s world sessions, extended to the first touch, the first close beyond or the right edge, optional notification.';
var EN = {
  'Hauts et bas des sessions précédentes':'Previous Session Highs and Lows',
  'Prolonger jusqu\'à':'Extend until', 'Première mèche qui touche':'First wick that touches', 'Première clôture au-delà':'First close beyond',
  'Bord droit':'Right edge', 'Notification':'Notification', 'Au premier toucher':'On the first touch',
  'À la première clôture au-delà':'On the first close beyond', 'Session de Tokyo':'Tokyo session', 'Session de Londres':'London session',
  'Session de New York':'New York session', 'Session de clôture':'Close session', 'Style':'Style',
  'Niveau touché':'Level touched', 'Clôture au-delà du niveau':'Close beyond the level',
  'Position des étiquettes':'Label position', 'À gauche (début du trait)':'Left (start of the line)', 'À droite (fin du trait)':'Right (end of the line)'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/niveaux_sessions.js)'] = DESC_EN + ' (extensions/niveaux_sessions.js)';

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

// Une session modifiee dans TT reclasse toutes les barres.
try{
  if(typeof HFQSessionsMonde !== 'undefined' && HFQSessionsMonde.suivre) HFQSessionsMonde.suivre(function(){
    ETAT.sig = '';
    redessiner();
  });
}catch(_){}

function aujourdhui(){ return new Date().toISOString().slice(0, 10); }
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
// Jours ouvres strictement entre deux dates de seance : une seance manque entre elles.
function ouvresEntre(a, b){
  var d = Date.parse(String(a).slice(0, 10)), f = Date.parse(String(b).slice(0, 10)), n = 0;
  if(!(d < f)) return 0;
  for(d += 864e5; d < f; d += 864e5) if(ouvre(d)) n++;
  return n;
}
// Trou de donnees, en minutes : plus de 10 minutes sans barre au-dela d'une
// barre, le seuil des marques « sans donnee » de TT (HFQLiveSeed.trouEntre).
// ponytail: graphes en ticks, volume ou range, sans duree de barre : une heure, qu'une barre lente d'Asie peut approcher.
function tolere(g){ return typeof g.tf === 'number' ? Math.max(1, g.tf) + 10 : 60; }
// Minute de seance sans la pause : la queue d'une session ouverte la veille
// reprend ou la seance du graphe s'arretait.
function minute(x, dur){ return x < 1440 ? Math.min(x, dur) : x - 1440 + dur; }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? (b._date || '') + ':' + b.m : ''; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

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

// Sessions d'une date, en minutes de seance du graphe [a, b) : celles de TT,
// sinon DEFAUTS. `table()` et non `bornes()` : une session decochee dans TT
// (« Compter cette session ») compte quand meme, seules les cases de l'etude
// choisissent ce qui s'affiche. Chacune court jusqu'a la suivante ; une fin
// avant le debut passe le minuit de seance (b > 1440).
function fenetres(date, ouv){
  var L = null;
  try{
    if(typeof HFQSessionsMonde !== 'undefined') L = HFQSessionsMonde.table().map(function(s){ return {id:s.id, nom:s.nom, col:s.col, d:HFQSessionsMonde.debutET(s, date) / 60}; });
  }catch(_){ L = null; }
  if(!L) L = DEFAUTS.map(function(s){ return {id:s.id, nom:s.nom, col:s.col, d:versET(s.h * 60 + s.m, s.tz, date)}; });
  L.sort(function(a, b){ return a.d - b.d; });
  L.forEach(function(s, k){ s.f = L[(k + 1) % L.length].d; });
  return L.map(function(s){
    var a = (s.d - ouv + 1440) % 1440, b = (s.f - ouv + 1440) % 1440;
    return {id:s.id, nom:s.nom, col:s.col, a:a, b:b <= a ? b + 1440 : b};
  });
}

function niveau(s){ return {s:s, p:s > 0 ? -Infinity : Infinity, i:-1, m:-1, c:-1}; }

// Session tracee : chargee en entier (`ok`) et derniere de son id, aucune
// occurrence manquante depuis. `o` numerote les sessions dans l'ordre du temps
// (jour ouvre fois nombre de sessions plus rang), la suivante du meme id porte
// o + K : la depasser sans l'avoir vue fermer, c'est qu'elle manque.
function montre(S, o){ return !!o && o.ok && !(S.cour && o.o + S.K < S.cour.o); }

// Premiere meche qui touche le niveau et premiere cloture au-dela (`m` et
// `c`, index de barre). La cloture de la barre en cours n'est pas acquise.
function touche(S, o, v, b, i, vive){
  if(v.m < 0 && v.s * ((v.s > 0 ? b.h : b.l) - v.p) >= 0){ v.m = i; if(S.pret) S.neufs.push({o:o, v:v, type:'meche', i:i}); }
  if(v.c < 0 && !vive && v.s * (b.c - v.p) > 0){ v.c = i; if(S.pret) S.neufs.push({o:o, v:v, type:'cloture', i:i}); }
}

// Classe une barre dans sa session, note ses touches sur les sessions closes
// puis etend la session en cours. Une session se reconnait a son id et a la
// seance du graphe ou elle s'ouvre (`j`, moins un dans la queue d'une session
// ouverte la veille). Relire la derniere barre, qui grossit encore, ne
// change rien de ce qui est deja note. Une session est complete (`ok`) si sa
// premiere barre suit son debut, sa derniere precede sa fin et deux barres ne
// s'ecartent pas de plus de P.tol minutes, sans barre de comblement.
function lit(S, b, i, j, vive, P){
  var date = b._date ? String(b._date).slice(0, 10) : aujourdhui();
  var F = S.F[date] || (S.F[date] = fenetres(date, P.ouv).sort(function(x, y){ return x.a - y.a; }));
  var m = +b.m + P.demi, s = null, q = 0, rg = -1;
  for(var k = 0; k < F.length && !s; k++){
    if(m >= F[k].a && m < F[k].b) s = F[k];
    else if(m + 1440 >= F[k].a && m + 1440 < F[k].b){ s = F[k]; q = 1; }
    rg = k;
  }
  if(!s) return;
  var cle = s.id + ':' + (j - q);
  if(!S.cour || S.cour.cle !== cle){
    if(S.cour && S.cour.H.i >= 0){
      if(S.cour.b - S.cour.t > P.tol) S.cour.ok = false;
      S.D[S.cour.id] = S.cour;
    }
    S.cour = {id:s.id, cle:cle, nom:s.nom, col:s.col, H:niveau(1), L:niveau(-1),
      o:(j - q) * F.length + rg, a:minute(s.a, P.dur), b:minute(s.b, P.dur), t:-1, ok:true};
    S.K = F.length;
  }
  var c = S.cour;
  if(b._trou){ c.ok = false; return; }
  for(var id in S.D){ touche(S, S.D[id], S.D[id].H, b, i, vive); touche(S, S.D[id], S.D[id].L, b, i, vive); }
  // Les barres tombent avant la pause : seule la queue d'une session ouverte la veille passe par minute().
  var t = q ? m + P.dur : m;
  if(t - (c.t < 0 ? c.a : c.t) > P.tol) c.ok = false;
  c.t = t;
  if(b.h > c.H.p){ c.H.p = b.h; c.H.i = i; }
  if(b.l < c.L.p){ c.L.p = b.l; c.L.i = i; }
}

// Incremental : les barres closes ne se lisent qu'une fois, la derniere se
// relit a chaque passage. Un graphe qui raccourcit (replay ramene en arriere),
// une autre serie ou une derniere barre lue qui n'est plus a son index (barres
// inserees plus tot, comme l'historique en ticks qui se remplit) repart de
// zero, sans notifier l'historique, dont la lecture s'etale sur plusieurs
// images au-dela de BUDGET_MS. `j` compte les jours ouvres : un jour sans
// seance en saute un.
function calcul(g, r){
  var S = ETAT, n = g.n | 0, b0 = n ? g.barre(0) : null, b;
  var sig = [g.sym, g.tf, g.seance, g.tick, cleBarre(b0)].join('|');
  if(sig !== S.sig || n < S.vu || (S.prev && cleBarre(g.barre(S.ip)) !== cleBarre(S.prev))){ S.sig = sig; S.n = 0; S.j = 0; S.prev = null; S.ip = -1; S.F = {}; S.cour = null; S.D = {}; S.pret = false; S.neufs = []; }
  S.vu = n;
  // Milieu de la barre sur les unites de temps en minutes, comme les bandes de TT.
  var P = {ouv:OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080, demi:typeof g.tf === 'number' ? g.tf / 2 : 0,
    dur:DUREE[g.seance] || 1380, tol:tolere(g)};
  for(var i = S.n, t0 = maintenant(); i < n; i++){
    if(!(i & 255) && i > S.n && i < n - 1 && maintenant() - t0 > BUDGET_MS){ S.n = i; redessiner(); return S; }
    if(!(b = g.barre(i))) continue;
    var j = S.j + (!S.prev ? 0 : b._date != null ? (b._date !== S.prev._date ? 1 + ouvresEntre(S.prev._date, b._date) : 0) : +b.m < +S.prev.m ? 1 : 0);
    lit(S, b, i, j, i === n - 1, P);
    S.j = j; S.prev = b; S.ip = i;
  }
  S.n = Math.max(S.n, n - 1); S.pret = true;
  return S;
}

function pousser(titre, texte){
  try{
    if(typeof Notification === 'undefined') return;
    var envoyer = function(){ try{ new Notification(titre, {body:texte}); }catch(_){} };
    if(Notification.permission === 'granted') envoyer();
    else if(Notification.permission !== 'denied') Notification.requestPermission().then(function(p){ if(p === 'granted') envoyer(); });
  }catch(_){}
}

// Une notification par niveau et par type de touche, sur les deux dernieres
// barres seulement : un saut de replay ne sonne pas pour ce qu'il enjambe.
function notifier(S, g, r){
  var N = S.neufs, d = (String(g.tick).split('.')[1] || '').length;
  S.neufs = [];
  N.forEach(function(a){
    if(r.alerte !== a.type || !r[a.o.id] || !montre(S, a.o) || a.i < (g.n | 0) - 2) return;
    pousser((g.sym ? g.sym + ' · ' : '') + tr(a.o.nom) + (a.v.s > 0 ? ' H' : ' L'),
      tr(a.type === 'meche' ? 'Niveau touché' : 'Clôture au-delà du niveau') + ' : ' + a.v.p.toFixed(d));
  });
}

HFQExt.etude({
  id:'niveaux-sessions',
  nom:'Hauts et bas des sessions précédentes',
  famille:'Prix',
  desc:DESC,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'jusqua', label:'Prolonger jusqu\'à', type:'select', defaut:'meche', options:[['meche','Première mèche qui touche'],['cloture','Première clôture au-delà'],['bord','Bord droit']]},
    {k:'alerte', label:'Notification', type:'select', defaut:'non', options:[['non','Aucune'],['meche','Au premier toucher'],['cloture','À la première clôture au-delà']]},
    {k:'asie', label:'Session de Tokyo', type:'check', defaut:true},
    {k:'eu', label:'Session de Londres', type:'check', defaut:true},
    {k:'us', label:'Session de New York', type:'check', defaut:true},
    {k:'fin', label:'Session de clôture', type:'check', defaut:true},
    {k:'style', label:'Style', type:'select', defaut:'tirets', options:[['plein','Plein'],['tirets','Tirets'],['points','Pointillés']]},
    {k:'ep', label:'Épaisseur', type:'number', defaut:1, min:0.5, max:4, pas:0.5},
    {k:'op', label:'Opacité', type:'number', defaut:0.85, min:0.05, max:1, pas:0.05},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true},
    {k:'etiqPos', label:'Position des étiquettes', type:'select', defaut:'gauche', options:[['gauche','À gauche (début du trait)'],['droite','À droite (fin du trait)']]}
  ],
  calcul:calcul,
  outils:{fenetres:fenetres, montre:montre},
  dessine:function(g, r){
    var S = calcul(g, r), F = g.cadre, e = g.echelle || 1;
    if(!S.pret) return;
    notifier(S, g, r);
    var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, (g.n | 0) - 1);
    if(fin < deb) return;
    for(var id in S.D){
      var o = S.D[id];
      if(!r[id] || !montre(S, o)) continue;
      [o.H, o.L].forEach(function(v){
        var t = r.jusqua === 'bord' ? -1 : r.jusqua === 'cloture' ? v.c : v.m;
        if(v.i > fin || (t >= 0 && t < deb)) return;
        var x0 = g.x(Math.max(v.i, deb)), x1 = t >= 0 ? g.x(t) : F.droite, y = g.y(v.p);
        g.trait([[x0, y], [x1, y]], {couleur:o.col, opacite:+r.op, epaisseur:+r.ep || 1, pointille:POINTILLE[r.style] || null});
        // A gauche, l'etiquette suit le debut du trait, ou le bord gauche quand il commence hors du cadre.
        var gauche = r.etiqPos !== 'droite';
        if(r.etiq) g.texte(gauche ? Math.max(x0, F.gauche) + 3 * e : Math.min(x1, F.droite) - 3 * e, y + v.s * -2 * e, tr(o.nom) + (v.s > 0 ? ' H' : ' L'),
          {couleur:o.col, opacite:+r.op, taille:10, align:gauche ? 'left' : 'right', base:v.s > 0 ? 'bottom' : 'top'});
      });
    }
  }
});

})();
