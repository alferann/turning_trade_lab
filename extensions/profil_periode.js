// Profil de volume par periode : le volume echange a chaque prix (bid + ask
// des niveaux de chaque barre) sur la seance du graphe, la seance US, Asie
// ou Europe, la semaine ISO ou le mois. Acheteurs et vendeurs empiles et
// attenues hors de l'aire de valeur, ou volume total colore par elle ; POC,
// VAH et VAL en lignes, leur prix ecrit a gauche.
//
// La periode en cours se colle au bord droit ou se pose sur ses barres. Les
// periodes precedentes se posent sur les leurs, adossees a leur premiere
// barre et tournees vers le futur, ou a leur cloture et tournees vers le
// passe. Quatre instances (A a D) pour superposer plusieurs profils.
//
// Le volume vient uniquement des niveaux des barres : une barre sans niveaux
// ne compte pas, et la legende dit quelle part des barres en manque.
(function(){

var ET = 'America/New_York';
// ponytail: minute ET de l'ouverture du graphe, 18:00 en ETH et 09:30 en RTH (ES, NQ).
var OUVERTURE = {eth:1080, rth:570};
// Memes defauts que hfq-sessions-monde.js : une seance court jusqu'a la suivante.
var DEFAUTS = [
  {id:'asie', h:18, m:0,  tz:ET},
  {id:'eu',   h:8,  m:0,  tz:'Europe/London'},
  {id:'us',   h:9,  m:30, tz:ET},
  {id:'fin',  h:16, m:0,  tz:ET}
];
// ponytail: minutes de seance de RTH (09:30 a 16:00 ET) sur un graphe ETH ouvert a 18:00 ET (ES, NQ).
var RTH = [930, 1320];
// ponytail: hauteur mini d'une rangee en mode auto ; les ticks se regroupent au zoom arriere.
var RANGEE_PX = 3;
// ponytail: budget du premier calcul par image ; les seances closes qui restent se lisent aux images suivantes.
var BUDGET_MS = 4;
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3], fins:[1,3], mixte:[8,3,2,3]};
// Filet des titres de sous-section, le panneau n'en ayant pas.
var FILET = ' ────────────────────';
// ponytail: `cout` part de 3 ms, une seance ETH d'une minute lue a froid, pour que la premiere lecture ne suive pas le balayage des barres ; ensuite le cout mesure de la derniere lecture.
var ETAT = {sig:'', gen:0, n:0, der:'', J:[], prev:null, H:{}, O:{}, cout:3};
// Seances closes lues pendant l'image en cours.
var LUES = 0;

var PERIODES = [['jour','Journalier (séance du graphe)'],['us','Séance US (RTH)'],['asie','Séance Asie'],['eu','Séance Europe'],['sem','Hebdomadaire (semaine ISO)'],['mois','Mensuel']];
var STYLES = [['plein','Plein'],['tirets','Tirets'],['points','Pointillés'],['fins','Pointillés fins'],['mixte','Tiret-point']];
var NOM = {jour:'Séance', us:'Séance US', asie:'Séance Asie', eu:'Séance Europe', sem:'Semaine', mois:'Mois'};
// Nom des niveaux sur le canevas : dPOC, wVAH, mVAL, POC RTH, VAL Asie...
var PREFIXE = {jour:'d', sem:'w', mois:'m'}, SUFFIXE = {us:'RTH', asie:'Asie', eu:'EU'};

// Anglais : nom, description, reglages, options et textes du canevas.
var FICHIER = 'profil_periode.js';
var DESC = {fr:'Profil de volume de la séance, d\'une séance US, Asie ou Europe, de la semaine ou du mois : acheteurs et vendeurs empilés, POC, VAH et VAL, périodes précédentes. Instance ',
            en:'Volume profile of the session, a US, Asian or European session, the week or the month: buyers and sellers stacked, POC, VAH and VAL, previous periods. Instance '};
var DESC_FIN = {fr:' sur quatre (A à D), pour superposer plusieurs profils.', en:' of four (A to D), to stack several profiles.'};
var EN = {
  'Journalier (séance du graphe)':'Daily (chart session)', 'Séance US (RTH)':'US session (RTH)', 'Séance Asie':'Asian session',
  'Séance Europe':'European session', 'Hebdomadaire (semaine ISO)':'Weekly (ISO week)', 'Séance US':'US session',
  'Périodes précédentes':'Previous periods', 'Période en cours':'Current period', 'Collée au bord droit':'Pinned to the right edge',
  'Sur sa période':'On its period', 'Profils posés sur leur période':'Profiles set on their period',
  'Depuis la première barre, vers la droite':'From the first bar, facing right', 'Depuis la clôture, vers la gauche':'From the close, facing left',
  'Calcul sur RTH seul (graphe ETH)':'Computed on RTH only (ETH chart)', 'Value Area %':'Value Area %',
  'Largeur au bord droit (% du graphe)':'Width at the right edge (% of chart)', 'Largeur sur la période (% de sa durée)':'Width on the period (% of its span)',
  'Largeur maximale (% du graphe)':'Maximum width (% of chart)', 'masqué':'hidden',
  'Ticks par rangée (0 = auto)':'Ticks per row (0 = auto)', 'Affichage du volume':'Volume display',
  'Acheteurs et vendeurs empilés':'Buyers and sellers stacked', 'Total, coloré par la Value Area':'Total, colored by the Value Area',
  'Couleur acheteurs':'Buyers color', 'Opacité acheteurs':'Buyers opacity', 'Couleur vendeurs':'Sellers color', 'Opacité vendeurs':'Sellers opacity',
  'Opacité relative hors Value Area':'Relative opacity outside the Value Area',
  'Couleur hors Value Area':'Color outside the Value Area', 'Opacité hors Value Area':'Opacity outside the Value Area',
  'Opacité Value Area':'Value Area opacity', 'Couleur rangée POC':'POC row color', 'Opacité rangée POC':'POC row opacity',
  'Style':'Style', 'Pointillés fins':'Fine dots', 'Tiret-point':'Dash-dot', 'Étiquettes à gauche et légende':'Left labels and caption',
  'partiel, depuis le':'partial, since', 'des barres sans niveaux':'of bars without levels',
  'Profil de période : barres sans date, profil de séance seulement':'Period profile: undated bars, session profile only',
  'Profil de période : aucune barre de la période ne porte de niveaux':'Period profile: no bar of the period carries levels',
  'Profil de période : aucune barre dans la fenêtre de séance':'Period profile: no bar in the session window'
};
EN['Histogramme' + FILET] = 'Histogram' + FILET;
EN['Ligne POC' + FILET] = 'POC line' + FILET;
EN['Lignes VAH et VAL' + FILET] = 'VAH and VAL lines' + FILET;
['A', 'B', 'C', 'D'].forEach(function(l){
  var fr = DESC.fr + l + DESC_FIN.fr, en = DESC.en + l + DESC_FIN.en, suffixe = ' (extensions/' + FICHIER + ')';
  EN['Profil de volume par période · ' + l] = 'Period Volume Profile · ' + l;
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
function mois(cle){ return String(cle).slice(0, 7); }
function aujourdhui(){ return new Date().toISOString().slice(0, 10); }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? (b._date || '') + ':' + b.m : ''; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}
// Prix d'un tick, avec les decimales du pas de cotation.
function prix(v, t){ return (v * t).toFixed((String(t).split('.')[1] || '').length); }

// Vrai si la date est le premier jour ouvre de sa semaine (lundi) ou de son mois.
// ponytail: les feries sont ignores ; une periode ouverte par un ferie passe pour partielle.
function premierOuvre(T, date){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if(!m) return false;
  var jour = function(k){ return new Date(Date.UTC(+m[1], +m[2] - 1, k)).getUTCDay(); };
  if(T === 'sem') return jour(+m[3]) === 1;
  for(var k = 1; k < +m[3]; k++) if(jour(k) % 6) return false;
  return true;
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

// Bornes [debut, fin) en minutes ET d'une seance pour une date : les
// sessions monde de TT (modifiables dans TT), sinon DEFAUTS.
function bornesET(anc, date){
  try{
    if(typeof HFQSessionsMonde !== 'undefined'){
      var B = HFQSessionsMonde.bornes(date);
      for(var i = 0; i < B.length; i++) if(B[i].id === anc) return [Math.round(B[i].debut / 60) % 1440, Math.round(B[i].fin / 60) % 1440];
    }
  }catch(_){}
  var k = 0;
  while(k < DEFAUTS.length - 1 && DEFAUTS[k].id !== anc) k++;
  var d = DEFAUTS[k], s = DEFAUTS[k + 1];
  return [versET(d.h * 60 + d.m, d.tz, date), versET(s.h * 60 + s.m, s.tz, date)];
}

// Bornes ET vers minutes de seance du graphe ; une fin avant le debut passe le minuit de seance.
function fenetreM(bornes, ouv){
  var a = (bornes[0] - ouv + 1440) % 1440, b = (bornes[1] - ouv + 1440) % 1440;
  if(b <= a) b += 1440;
  return [a, b];
}

// Fenetre [debut, fin) en minutes de seance de la seance k, ou null pour
// toutes ses barres.
function fenetre(C, g, r, J, k){
  var T = r.periode;
  if(SUFFIXE[T]){
    var d = J[k].date || aujourdhui();
    return C.fen[d] || (C.fen[d] = fenetreM(bornesET(T, d), OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080));
  }
  return r.rth && g.seance === 'eth' ? RTH : null;
}
function dans(f, m){ return !f || (m >= f[0] && m < f[1]) || (m + 1440 >= f[0] && m + 1440 < f[1]); }
// Vrai si la fenetre croise les minutes de la seance.
function touche(f, s){ return !f || (s.m0 < f[1] && s.m1 >= f[0]) || (s.m0 < f[1] - 1440 && s.m1 >= f[0] - 1440); }

// Seances du graphe, barre et minute de debut et de fin. Incremental : si le
// graphe a seulement grandi, seules les nouvelles barres sont lues ; s'il a
// raccourci (replay ramene en arriere), les seances au-dela de sa fin sont
// coupees. S'il a grandi mais que la derniere barre lue n'est plus a son
// index (barres inserees plus tot, comme l'historique en ticks qui se
// remplit), tout repart de zero. La lecture s'arrete passee l'echeance `fin` et reprend a l'appel
// suivant. `gen` change a chaque remise a zero ou coupe, et vide les caches
// des instances.
function seances(S, g, fin){
  var n = g.n | 0, b0 = n ? g.barre(0) : null, b, c;
  var sig = [g.sym, g.tf, g.seance, g.tick, b0 ? (b0._date || '') + ':' + b0.m : ''].join('|');
  if(sig !== S.sig || (S.n && n >= S.n && cleBarre(g.barre(S.n - 1)) !== S.der)){ S.sig = sig; S.gen++; S.n = 0; S.J = []; S.prev = null; S.H = {}; S.O = {}; }
  var J = S.J;
  if(n < S.n){
    while(J.length && J[J.length - 1].deb >= n) J.pop();
    S.prev = n ? g.barre(n - 1) : null;
    if(J.length && S.prev){ J[J.length - 1].fin = n - 1; J[J.length - 1].m1 = +S.prev.m; }
    for(c in S.H) if(+c.split(':')[0] >= J.length - 1) delete S.H[c];
    S.n = n; S.gen++; S.O = {};
  }
  var prev = S.prev;
  for(var i = S.n; i < n; i++){
    if(!(i & 2047) && i > S.n && maintenant() > fin) break;
    b = g.barre(i);
    if(!b) continue;
    if(!prev || (b._date != null ? b._date !== prev._date : +b.m < +prev.m)) J.push({date:b._date ? String(b._date).slice(0, 10) : '', deb:i, fin:i, m0:+b.m, m1:+b.m});
    c = J[J.length - 1]; c.fin = i; c.m1 = +b.m;
    prev = b;
  }
  S.n = i; S.prev = prev; S.der = cleBarre(prev);
  return J;
}

// Periodes du graphe, de la plus ancienne a la plus recente : une par
// seance, ou les seances consecutives d'une meme semaine ou d'un meme mois.
// Une seance sans minute dans la fenetre (Asie sur un graphe RTH) n'en
// fait pas partie.
function periodes(C, g, r, J){
  var T = r.periode, cleDe = T === 'sem' ? semaine : T === 'mois' ? mois : null, P = [], p = null;
  for(var k = 0; k < J.length; k++){
    if(!touche(fenetre(C, g, r, J, k), J[k])) continue;
    var cle = cleDe ? cleDe(J[k].date) : J[k].date;
    if(p && cleDe && cle === p.cle) p.k1 = k;
    else P.push(p = {k0:k, k1:k, cle:cle});
  }
  return P;
}

function vide(){ return {h:new Map(), sans:0, nb:0, deb:-1, fin:-1}; }

// Volume par tick des barres de la seance s dans la fenetre f : cle = prix /
// tick arrondi, valeur [bid, ask]. Une Map : des cles entieres vers 28 000
// et eparses rendent un objet deux fois plus lent.
function histo(g, s, f){
  var H = vide(), h = H.h, t = g.tick || 0.25;
  for(var i = s.deb; i <= s.fin; i++){
    var b = g.barre(i);
    if(!b || b._trou || !dans(f, +b.m)) continue;
    H.nb++;
    if(H.deb < 0) H.deb = i;
    H.fin = i;
    var L = g.niveaux(i);
    if(!L.n){ H.sans++; continue; }
    for(var k = 0; k < L.n; k++){
      var bi = L.bid(k), a = L.ask(k);
      if(bi + a > 0){
        var p = Math.round(L.prix(k) / t), e = h.get(p);
        if(!e) h.set(p, e = [0, 0]);
        e[0] += bi; e[1] += a;
      }
    }
  }
  return H;
}

function ajoute(A, B){
  B.h.forEach(function(v, p){ var e = A.h.get(p); if(!e) A.h.set(p, e = [0, 0]); e[0] += v[0]; e[1] += v[1]; });
  A.sans += B.sans; A.nb += B.nb;
  if(B.deb >= 0){ if(A.deb < 0) A.deb = B.deb; A.fin = B.fin; }
  return A;
}

// Histogramme de la seance k dans sa fenetre, partage par les instances.
// Seance close : en cache ; seance ouverte : relue quand `cleOuv` (sa
// derniere barre) change. undefined si la lecture deborderait le budget de
// l'image, estime sur le cout de la derniere seance lue.
function histoSeance(C, g, r, J, k, t0, cleOuv){
  var f = fenetre(C, g, r, J, k), cle = k + ':' + (f ? f[0] + '-' + f[1] : '*'), close = k < J.length - 1;
  var O = close ? ETAT.H[cle] : ETAT.O[cle] && ETAT.O[cle].cle === cleOuv ? ETAT.O[cle].H : null;
  if(O) return O;
  var t = maintenant();
  if(t - t0 > 0.5 && t - t0 + ETAT.cout > BUDGET_MS) return undefined;
  O = histo(g, J[k], f);
  ETAT.cout = maintenant() - t;
  if(close){ ETAT.H[cle] = O; LUES++; } else ETAT.O[cle] = {cle:cleOuv, H:O};
  return O;
}

// POC et aire de valeur sur les volumes V de ticks croissants : depuis le
// POC, on ajoute le tick voisin le plus fourni jusqu'a couvrir la part
// demandee. Ex aequo comme TT (hfq-va.js) : le POC le plus bas, puis le cote
// haut. Rend des indices de V.
function zoneValeur(V, part){
  var n = V.length, total = 0, ip = 0, k;
  for(k = 0; k < n; k++){ total += V[k]; if(V[k] > V[ip]) ip = k; }
  var a = ip, z = ip, acc = V[ip], cible = part * total;
  while(acc < cible && (a > 0 || z < n - 1)){
    var vb = a > 0 ? V[a - 1] : -1, vh = z < n - 1 ? V[z + 1] : -1;
    if(vh >= vb) acc += V[++z]; else acc += V[--a];
  }
  return {total:total, poc:ip, vah:z, val:a};
}

// Profil d'une periode : ticks croissants, bid et ask par tick, POC et aire
// de valeur en ticks ; null sans volume.
function profil(S, p, r, J){
  var T = Array.from(S.h.keys()).sort(function(a, b){ return a - b; }), n = T.length, k;
  if(!n) return null;
  var B = new Float64Array(n), A = new Float64Array(n), V = new Float64Array(n);
  for(k = 0; k < n; k++){ var e = S.h.get(T[k]); B[k] = e[0]; A[k] = e[1]; V[k] = e[0] + e[1]; }
  var Z = zoneValeur(V, r.vaPct / 100), P = r.periode, d = J[p.k0].date;
  return {ticks:T, bid:B, ask:A, total:Z.total, poc:T[Z.poc], vah:T[Z.vah], val:T[Z.val], deb:S.deb, fin:S.fin, sans:S.sans, nb:S.nb,
          nom:NOM[P], cle:P === 'sem' ? semaine(d).slice(5) : P === 'mois' ? mois(d) : d,
          // La periode n'est entiere que si le graphe la charge depuis son premier jour ouvre.
          partiel:(P === 'sem' || P === 'mois') && p.k0 === 0 && !premierOuvre(P, J[0].date) ? J[0].date : null};
}

// Profil d'une periode close, calcule une fois ; undefined tant que ses
// seances ne sont pas toutes lues.
function fermee(C, g, r, J, p, t0){
  var id = p.k0 + ':' + p.k1;
  if(id in C.R) return C.R[id];
  var S = vide();
  for(var k = p.k0; k <= p.k1; k++){
    var H = histoSeance(C, g, r, J, k, t0);
    if(!H) return undefined;
    ajoute(S, H);
  }
  return (C.R[id] = profil(S, p, r, J));
}

// Profils de la periode en cours (la derniere) et des `hist` precedentes
// visibles. Les seances closes se calculent une fois, au plus BUDGET_MS par
// image (rien n'est dessine avant la fin) ; la seance ouverte se relit quand
// la derniere barre bouge. Une periode precedente partielle ou a barres sans
// niveaux est omise ; la periode en cours l'est au dessin, legende gardee.
function calcul(C, g, r){
  var t0 = maintenant(), J = seances(ETAT, g, t0 + BUDGET_MS), n = g.n | 0;
  LUES = 0;
  if(ETAT.n < n){ redessiner(); return null; }
  if(!J.length) return null;
  var T = r.periode, der = J.length - 1, prec = [], R, p, k;
  if((T === 'sem' || T === 'mois') && !J[der].date) return {cour:null, prec:prec, raison:'Profil de période : barres sans date, profil de séance seulement'};
  var cfg = [ETAT.gen, T, !!r.rth, r.vaPct].join('|');
  if(C.cfg !== cfg){ C.cfg = cfg; C.fen = {}; C.R = {}; C.cleP = ''; C.somme = {cle:'', S:null}; C.cour = {cle:'', R:null}; }
  var cleP = J.length + ':' + J[der].m1;
  if(C.cleP !== cleP){ C.cleP = cleP; C.P = periodes(C, g, r, J); }
  var P = C.P;
  if(!P.length) return {cour:null, prec:prec, raison:'Profil de période : aucune barre dans la fenêtre de séance'};

  for(k = Math.max(0, P.length - 1 - (r.hist | 0)); k < P.length - 1; k++){
    p = P[k];
    if(J[p.k1].fin < g.premiere || J[p.k0].deb > g.derniere) continue;
    R = fermee(C, g, r, J, p, t0);
    if(R === undefined){ redessiner(); return null; }
    if(R && !R.partiel && !R.sans) prec.push(R);
  }

  p = P[P.length - 1];
  if(p.k1 < der) R = fermee(C, g, r, J, p, t0);
  else {
    var last = g.barre(n - 1), L = g.niveaux(n - 1);
    var cleOuv = [n, last && last.c, last && last.h, last && last.l, L.n, L.volume()].join('|'), cle = p.k0 + '|' + cleOuv;
    if(C.cour.cle !== cle){
      var cs = p.k0 + '|' + der, S;
      if(C.somme.cle !== cs){
        S = vide();
        for(k = p.k0; k < der; k++){
          var H = histoSeance(C, g, r, J, k, t0);
          if(!H){ redessiner(); return null; }
          ajoute(S, H);
        }
        C.somme = {cle:cs, S:S};
      }
      var O = histoSeance(C, g, r, J, der, t0, cleOuv);
      if(!O){ redessiner(); return null; }
      C.cour = {cle:cle, R:profil(ajoute(ajoute(vide(), C.somme.S), O), p, r, J)};
    }
    R = C.cour.R;
  }
  if(R === undefined){ redessiner(); return null; }
  // Calcul fini sur une image deja chargee : le dessin attend l'image suivante, servie par le cache.
  if(LUES && maintenant() - t0 > BUDGET_MS / 2){ redessiner(); return null; }
  return {cour:R, prec:prec, raison:R ? null : 'Profil de période : aucune barre de la période ne porte de niveaux'};
}

// Rangees de `pas` ticks d'un profil, alignees sur des multiples de `pas`
// pour ne pas bouger au defilement : [q, bid, ask], q croissant.
function rangees(R, pas){
  if(R.pas === pas) return R.rangees;
  var out = [], der = null;
  for(var k = 0; k < R.ticks.length; k++){
    var q = Math.floor(R.ticks[k] / pas);
    if(!der || der[0] !== q) out.push(der = [q, 0, 0]);
    der[1] += R.bid[k]; der[2] += R.ask[k];
  }
  R.pas = pas; R.rangees = out;
  return out;
}

// Rectangles de l'histogramme d'un profil, adosse a x0 et tourne vers la
// gauche (dir -1) ou la droite (dir 1), rangés par couleur dans Q ; la
// rangee la plus fournie mesure W. Empile : les acheteurs contre
// l'adossement, les vendeurs au bout, attenues hors aire de valeur, la
// rangee du POC cerclee.
function histogramme(Q, g, r, R, pas, x0, dir, W){
  var F = g.cadre, e = g.echelle || 1, t = g.tick || 0.25, rows = rangees(R, pas), max = 0, k;
  for(k = 0; k < rows.length; k++) max = Math.max(max, rows[k][1] + rows[k][2]);
  for(k = 0; k < rows.length; k++){
    var i0 = rows[k][0] * pas, i1 = i0 + pas - 1, ya = g.y((i1 + 0.5) * t), yb = g.y((i0 - 0.5) * t);
    var y0 = Math.min(ya, yb), h = Math.abs(yb - ya);
    if(y0 > F.bas || y0 + h < F.haut) continue;
    if(h > 3 * e){ y0 += 0.5 * e; h -= e; }
    var wv = W * rows[k][1] / max, wa = W * rows[k][2] / max, w = wa + wv, xw = dir < 0 ? x0 - w : x0;
    var poc = R.poc >= i0 && R.poc <= i1, va = i1 >= R.val && i0 <= R.vah;
    if(r.mode === 'empile'){
      (va ? Q.achat : Q.achatH).push(dir < 0 ? x0 - wa : x0, y0, wa, h);
      (va ? Q.vente : Q.venteH).push(dir < 0 ? x0 - w : x0 + wa, y0, wv, h);
      if(poc) Q.cadre.push(xw, y0, w, h);
    } else (poc ? Q.poc : va ? Q.va : Q.hors).push(xw, y0, w, h);
  }
}

// Un seul remplissage par couleur, pour tous les profils de l'image ; un
// contour d'epaisseur `trait` a la place s'il est donne.
function peindre(c, Q, couleur, op, trait){
  if(!Q.length || !(op > 0)) return;
  c.globalAlpha = Math.min(1, op);
  c.beginPath();
  for(var k = 0; k < Q.length; k += 4) c.rect(Q[k], Q[k + 1], Q[k + 2], Q[k + 3]);
  if(trait){ c.strokeStyle = couleur; c.lineWidth = trait; c.stroke(); }
  else { c.fillStyle = couleur; c.fill(); }
}

function dessine(C, rang, g, r){
  var X = calcul(C, g, r), F = g.cadre, e = g.echelle || 1, t = g.tick || 0.25, T = r.periode, k, R;
  if(!X) return;
  // Une ligne de texte par instance en haut du graphe, pour ne pas se chevaucher.
  var yTxt = F.haut + (12 + 13 * rang) * e;
  if(X.raison) g.texte(F.gauche + 8 * e, yTxt, tr(X.raison), {couleur:'#8a929c', taille:10});
  // Rien de dessine sur une periode en cours incomplete : seule la legende dit pourquoi.
  var masque = X.cour && (X.cour.partiel || X.cour.sans);
  var tous = X.cour && !masque ? X.prec.concat([X.cour]) : X.prec;
  if(masque) legende(g, r, X.cour, yTxt);
  if(!tous.length) return;

  // Rangees d'au moins RANGEE_PX en auto ; colonne lue sur la projection.
  R = tous[tous.length - 1];
  var hTick = Math.abs(g.y(R.poc * t) - g.y((R.poc + 1) * t));
  var pas = r.rangee >= 1 ? r.rangee | 0 : Math.max(1, Math.ceil(RANGEE_PX * e / Math.max(hTick, 1e-9)));
  var col = Math.abs(g.x(g.premiere + 1) - g.x(g.premiere));
  var Q = {hors:[], va:[], poc:[], achat:[], vente:[], achatH:[], venteH:[], cadre:[]}, LP = [], LV = [], x0, x1;
  var wMax = F.largeur * (+r.largeurMax || 100) / 100;
  for(k = 0; k < tous.length; k++){
    R = tous[k];
    var xa = g.x(R.deb) - col / 2, xb = g.x(R.fin) + col / 2, cour = R === X.cour;
    if(r.profil){
      if(cour && r.place === 'droite') histogramme(Q, g, r, R, pas, F.droite, -1, Math.min(wMax, F.largeur * r.largeur / 100));
      else if(r.sens === 'passe') histogramme(Q, g, r, R, pas, xb, -1, Math.min(wMax, (xb - xa) * r.largeurP / 100));
      else histogramme(Q, g, r, R, pas, xa, 1, Math.min(wMax, (xb - xa) * r.largeurP / 100));
    }
    // La periode en cours prolonge ses niveaux jusqu'au bord droit, les precedentes s'arretent a leur cloture.
    x0 = cour ? Math.max(F.gauche, xa) : xa; x1 = cour ? F.droite : xb;
    var yp = g.y(R.poc * t), yh = g.y(R.vah * t), yl = g.y(R.val * t);
    LP.push([x0, yp], [x1, yp], [NaN, NaN]);
    LV.push([x0, yh], [x1, yh], [NaN, NaN], [x0, yl], [x1, yl], [NaN, NaN]);
  }
  var c = g.ctx;
  if(r.mode === 'empile'){
    peindre(c, Q.achat, r.achatC, r.achatO); peindre(c, Q.vente, r.venteC, r.venteO);
    peindre(c, Q.achatH, r.achatC, r.achatO * r.horsVA); peindre(c, Q.venteH, r.venteC, r.venteO * r.horsVA);
    peindre(c, Q.cadre, r.pocC, r.pocO, e);
  }
  else { peindre(c, Q.hors, r.couleur, r.opac); peindre(c, Q.va, r.couleurVA, r.opacVA); peindre(c, Q.poc, r.pocC, r.pocO); }
  c.globalAlpha = 1;
  if(r.pocL) g.trait(LP, {couleur:r.pocLC, epaisseur:+r.pocLE || 1.5, pointille:POINTILLE[r.pocLT] || null, opacite:+r.pocLO});
  if(r.vaL) g.trait(LV, {couleur:r.vaLC, epaisseur:+r.vaLE || 1, pointille:POINTILLE[r.vaLT] || null, opacite:+r.vaLO});

  R = X.cour;
  if(!R || masque) return;
  // Prix des niveaux au-dessus de leur ligne, au bord gauche ou au debut de la periode.
  if(r.etiq){
    var nom = function(niv){ return (PREFIXE[T] || '') + niv + (SUFFIXE[T] ? ' ' + tr(SUFFIXE[T]) : ''); };
    var xl = x0 + 4 * e, niv = [['POC', R.poc, r.pocL, r.pocLC], ['VAH', R.vah, r.vaL, r.vaLC], ['VAL', R.val, r.vaL, r.vaLC]];
    for(k = 0; k < niv.length; k++) if(niv[k][2])
      g.texte(xl, g.y(niv[k][1] * t) - 2 * e, nom(niv[k][0]) + ' ' + prix(niv[k][1], t), {couleur:niv[k][3], taille:10, base:'bottom'});
  }
  if(r.etiq) legende(g, r, R, yTxt);
}

// Legende de la periode en cours, et pourquoi elle est masquee.
function legende(g, r, R, y){
  var e = g.echelle || 1, titre = tr(R.nom) + (R.cle ? ' ' + R.cle : ''), pq = [];
  if(R.partiel) pq.push(tr('partiel, depuis le') + ' ' + R.partiel);
  if(R.sans) pq.push(Math.round(100 * R.sans / R.nb) + ' % ' + tr('des barres sans niveaux'));
  if(pq.length) titre += ' · ' + tr('masqué') + ' : ' + pq.join(', ');
  g.texte(g.cadre.droite - 4 * e, y, titre, {couleur:'#8a929c', taille:10, align:'right'});
}

function reglages(periode){
  return [
    {k:'periode',  label:'Période', type:'select', defaut:periode, options:PERIODES},
    {k:'hist',     label:'Périodes précédentes', type:'number', defaut:0, min:0, max:60, pas:1},
    {k:'place',    label:'Période en cours', type:'select', defaut:'droite', options:[['droite','Collée au bord droit'],['periode','Sur sa période']]},
    {k:'sens',     label:'Profils posés sur leur période', type:'select', defaut:'futur', options:[['futur','Depuis la première barre, vers la droite'],['passe','Depuis la clôture, vers la gauche']]},
    {k:'rth',      label:'Calcul sur RTH seul (graphe ETH)', type:'check', defaut:false},
    {k:'vaPct',    label:'Value Area %', type:'number', defaut:70, min:50, max:95, pas:1},
    {k:'largeur',  label:'Largeur au bord droit (% du graphe)', type:'number', defaut:25, min:5, max:100, pas:1},
    {k:'largeurP', label:'Largeur sur la période (% de sa durée)', type:'number', defaut:60, min:5, max:100, pas:5},
    {k:'largeurMax', label:'Largeur maximale (% du graphe)', type:'number', defaut:100, min:5, max:100, pas:1},
    {k:'rangee',   label:'Ticks par rangée (0 = auto)', type:'number', defaut:0, min:0, max:100, pas:1},
    {k:'profil',   label:'Histogramme' + FILET, type:'check', defaut:true},
    {k:'mode',     label:'Affichage du volume', type:'select', defaut:'empile', options:[['empile','Acheteurs et vendeurs empilés'],['total','Total, coloré par la Value Area']]},
    {k:'achatC',   label:'Couleur acheteurs', type:'color', defaut:'#4bd48e'},
    {k:'achatO',   label:'Opacité acheteurs', type:'number', defaut:0.5, min:0, max:1, pas:0.05},
    {k:'venteC',   label:'Couleur vendeurs', type:'color', defaut:'#e0567f'},
    {k:'venteO',   label:'Opacité vendeurs', type:'number', defaut:0.5, min:0, max:1, pas:0.05},
    {k:'horsVA',   label:'Opacité relative hors Value Area', type:'number', defaut:0.4, min:0, max:1, pas:0.05},
    {k:'couleur',  label:'Couleur hors Value Area', type:'color', defaut:'#6b7785'},
    {k:'opac',     label:'Opacité hors Value Area', type:'number', defaut:0.5, min:0, max:1, pas:0.05},
    {k:'couleurVA', label:'Couleur Value Area', type:'color', defaut:'#3d8bd4'},
    {k:'opacVA',   label:'Opacité Value Area', type:'number', defaut:0.5, min:0, max:1, pas:0.05},
    {k:'pocC',     label:'Couleur rangée POC', type:'color', defaut:'#ffb347'},
    {k:'pocO',     label:'Opacité rangée POC', type:'number', defaut:0.6, min:0, max:1, pas:0.05},
    {k:'pocL',     label:'Ligne POC' + FILET, type:'check', defaut:true},
    {k:'pocLC',    label:'Couleur', type:'color', defaut:'#ffb347'},
    {k:'pocLT',    label:'Style', type:'select', defaut:'plein', options:STYLES},
    {k:'pocLE',    label:'Épaisseur', type:'number', defaut:1.5, min:0.5, max:5, pas:0.5},
    {k:'pocLO',    label:'Opacité', type:'number', defaut:0.9, min:0, max:1, pas:0.05},
    {k:'vaL',      label:'Lignes VAH et VAL' + FILET, type:'check', defaut:true},
    {k:'vaLC',     label:'Couleur', type:'color', defaut:'#3d8bd4'},
    {k:'vaLT',     label:'Style', type:'select', defaut:'tirets', options:STYLES},
    {k:'vaLE',     label:'Épaisseur', type:'number', defaut:1, min:0.5, max:5, pas:0.5},
    {k:'vaLO',     label:'Opacité', type:'number', defaut:0.9, min:0, max:1, pas:0.05},
    {k:'etiq',     label:'Étiquettes à gauche et légende', type:'check', defaut:true}
  ];
}

// TT refuse deux etudes de meme id et memorise les reglages par id : une
// declaration par instance, chacune avec ses caches de periodes.
function instance(lettre, rang, id, periode){
  var C = {cfg:''};
  HFQExt.etude({
    id:id,
    nom:'Profil de volume par période · ' + lettre,
    famille:'Profil',
    desc:DESC.fr + lettre + DESC_FIN.fr,
    graphes:['bougies','footprint'],
    reglages:reglages(periode),
    calcul:function(g, r){ return calcul(C, g, r); },
    outils:{zoneValeur:zoneValeur, premierOuvre:premierOuvre, semaine:semaine, bornesET:bornesET},
    dessine:function(g, r){ dessine(C, rang, g, r); }
  });
}

// L'instance A garde l'id de l'ancienne etude a periode unique, et ses reglages.
instance('A', 0, 'profil-periode', 'jour');
instance('B', 1, 'profil-periode-b', 'sem');
instance('C', 2, 'profil-periode-c', 'mois');
instance('D', 3, 'profil-periode-d', 'us');

})();
