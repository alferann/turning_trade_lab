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
(function(){

var ET = 'America/New_York', NSD = 6;
// ponytail: minute ET de l'ouverture du graphe, 18:00 en ETH et 09:30 en RTH (ES, NQ).
var OUVERTURE = {eth:1080, rth:570};

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

function aujourdhui(){ return new Date().toISOString().slice(0, 10); }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? (b._date || '') + ':' + b.m : ''; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

function cache(){ return {sig:'', id0:'', der:'', n:0, fen:{}, cle:[], sessAt:new Int32Array(0), V:new Float64Array(0), PV:new Float64Array(0), PV2:new Float64Array(0), vwap:new Float64Array(0), sd:new Float64Array(0)}; }

function agrandir(C, n){
  if(C.V.length >= n) return;
  var t = Math.max(n, C.V.length * 2), s = new Int32Array(t);
  s.set(C.sessAt); C.sessAt = s;
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
  var id0 = cleBarre(b0);
  var depuis = (C.sig === sig && C.id0 === id0 && n >= C.n && C.n > 0 && cleBarre(g.barre(C.n - 1)) === C.der) ? C.n - 1 : 0;
  if(!depuis) C.fen = {};
  agrandir(C, n);
  var ouv = OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080;
  var prev = depuis > 0 ? g.barre(depuis - 1) : null;
  var sess = depuis > 0 ? C.sessAt[depuis - 1] : 0;
  for(var i = depuis; i < n; i++){
    if(fin && !(i & 255) && i > depuis && maintenant() > fin) break;
    var b = g.barre(i);
    if(!b){ C.cle[i] = null; C.vwap[i] = NaN; C.sd[i] = NaN; C.sessAt[i] = sess; C.V[i] = 0; continue; }
    if(prev && (b._date != null ? String(b._date) !== String(prev._date) : +b.m < +prev.m)) sess++;
    C.sessAt[i] = sess;
    var date = b._date ? String(b._date).slice(0, 10) : '', cle;
    if(r.anc === 'jour') cle = 'j' + sess;
    else if(r.anc === 'sem') cle = date ? 's' + semaine(date) : 'j' + sess;
    else if(r.anc === 'mois') cle = date ? 'm' + date.slice(0, 7) : 'j' + sess;
    else {
      var F = C.fen[date] || (C.fen[date] = fenetreM(bornesET(r.anc, date || aujourdhui(), r), ouv));
      var m = +b.m, dans = (m >= F[0] && m < F[1]) || (m + 1440 >= F[0] && m + 1440 < F[1]);
      cle = dans ? 'j' + sess : null;
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
    var suite = i > 0 && cle && C.cle[i - 1] === cle;
    C.V[i] = (suite ? C.V[i - 1] : 0) + v;
    C.PV[i] = (suite ? C.PV[i - 1] : 0) + pv;
    C.PV2[i] = (suite ? C.PV2[i - 1] : 0) + pv2;
    C.cle[i] = cle;
    if(cle && C.V[i] > 0){
      var vw = C.PV[i] / C.V[i];
      C.vwap[i] = vw; C.sd[i] = Math.sqrt(Math.max(0, C.PV2[i] / C.V[i] - vw * vw));
    } else { C.vwap[i] = NaN; C.sd[i] = NaN; }
    prev = b;
  }
  C.n = i; C.sig = sig; C.id0 = id0; C.der = cleBarre(g.barre(i - 1));
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
    outils:{versET:versET, bornesET:bornesET, semaine:semaine},
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
