// Bougies hors bande VWAP : cache toute bougie qui touche, ne serait-ce que
// d'une meche, la bande entre deux ecarts de la VWAP journaliere ou RTH
// (-1σ et +1σ par defaut ; deux bornes a 0, les bougies au contact de la
// VWAP), et notifie a chaque cloture de barre au-dela d'un ecart ±nσ choisi,
// VWAP comprise.
//
// HFQExt n'a aucun moyen de sauter une bougie : les etudes se dessinent par-
// dessus. Le masque repeint donc le fond du graphe (bgStyle de candles.html,
// degrade compris) sur le corps et la meche, puis retrace la VWAP et les deux
// bornes, que le fond vient de couper. Tout ce que TT et les etudes chargees
// avant celle-ci dessinent sur une bougie masquee est coupe avec elle.
//
// Meme VWAP et meme ecart-type que VWAP Pro (ancrages « Journalier » et
// « Seance US (RTH) »). Rien n'est masque ni notifie sur une periode que le
// graphe ne prend pas dans l'heure qui suit son debut, ni apres une barre de
// comblement.
(function(){

var OUVERTURE = {eth:1080, rth:570}, DUREE = {eth:1380, rth:390};
// ponytail: une periode commence dans les donnees si sa premiere barre tombe dans l'heure qui suit son debut (regle de vwap_pro.js), pas de complement par le fichier minute.
var DEBUT_MAX = 60;
// ponytail: budget du calcul a froid par image, la suite aux images suivantes (comme vwap_pro.js).
var BUDGET_MS = 4;
// ponytail: largeur du corps des bougies de TT (candles.html, max(1.2, colonne x 0.62)), a suivre si TT la change.
var CORPS = .62;
var NA = 6;
var FILET = ' ────────────────────';
var NOMS = {jour:'DVWAP', us:'VWAP RTH'};

// Anglais : nom, description, reglages et options tels que le panneau les
// affiche, et textes des notifications.
var FICHIER = 'bougies_vwap.js';
var DESC = 'Cache les bougies qui touchent la bande entre deux écarts-types de la VWAP journalière ou RTH, et notifie chaque clôture au-delà d\'un écart choisi.';
var DESC_EN = 'Hides the candles that touch the band between two standard deviations of the daily or RTH VWAP, and notifies every close beyond a chosen deviation.';
var EN = {
  'Bougies hors bande VWAP':'Candles outside VWAP band',
  'Ancrage':'Anchoring', 'Journalier (séance du graphe)':'Daily (chart session)', 'Séance US (RTH)':'US session (RTH)',
  'Source du prix':'Price source', 'Footprint, sinon (H+L+C)/3':'Footprint, else (H+L+C)/3', '(H+L+C)/3 × volume':'(H+L+C)/3 × volume', 'Clôture × volume':'Close × volume',
  'Borne haute (écarts-types, 0 = VWAP)':'Upper bound (standard deviations, 0 = VWAP)',
  'Borne basse (écarts-types, 0 = VWAP)':'Lower bound (standard deviations, 0 = VWAP)',
  'Couleur':'Color', 'Réarmement (ticks)':'Re-arm (ticks)', 'Multiplicateur (0 = VWAP)':'Multiplier (0 = VWAP)',
  'Clôture au-dessus de':'Close above', 'Clôture sous':'Close below', 'la VWAP':'the VWAP'
};
EN['Masquer les bougies dans la bande' + FILET] = 'Hide candles in the band' + FILET;
EN['Tracer la VWAP' + FILET] = 'Draw the VWAP' + FILET;
EN['Tracer les bornes' + FILET] = 'Draw the bounds' + FILET;
EN['Alertes à la clôture' + FILET] = 'Close alerts' + FILET;
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/' + FICHIER + ')'] = DESC_EN + ' (extensions/' + FICHIER + ')';
for(var k0 = 1; k0 <= NA; k0++) EN['Niveau ' + k0] = 'Level ' + k0;

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

// Fenetre RTH [debut, fin) en minutes ET : la session « us » des sessions
// monde de TT, sinon 09:30 a 16:00 ET, comme vwap_pro.js.
function bornesUS(date){
  try{
    if(typeof HFQSessionsMonde !== 'undefined'){
      var B = HFQSessionsMonde.bornes(date);
      for(var i = 0; i < B.length; i++) if(B[i].id === 'us') return [Math.round(B[i].debut / 60) % 1440, Math.round(B[i].fin / 60) % 1440];
    }
  }catch(_){}
  return [570, 960];
}
// Bornes ET vers minutes de seance du graphe ; une fin avant le debut passe le minuit de seance.
function fenetreM(bornes, ouv){
  var a = (bornes[0] - ouv + 1440) % 1440, b = (bornes[1] - ouv + 1440) % 1440;
  if(b <= a) b += 1440;
  return [a, b];
}
function dansF(F, m){ return (m >= F[0] && m < F[1]) || (m + 1440 >= F[0] && m + 1440 < F[1]); }
// Minutes entre le debut de la periode et la minute m : depuis l'ouverture
// (jour) ou le debut de la fenetre F ; une fenetre qui enjambe l'ouverture a
// commence dans la seance precedente si le marche y traitait.
function ecart(F, m, dur){ return !F ? m : m >= F[0] ? m - F[0] : F[0] >= dur ? m : Infinity; }

function aujourdhui(){ return new Date().toISOString().slice(0, 10); }
// Date de seance d'une barre : `_date` des bougies, sinon `_sd` du footprint.
function dateDe(b){ return b ? String(b._date || b._sd || '').slice(0, 10) : ''; }
// Cle d'une barre, pour reconnaitre la derniere lue a son index.
function cleBarre(b){ return b ? dateDe(b) + ':' + b.m : ''; }
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

var C = {sig:'', id0:'', der:'', n:0, fen:{}, cle:[], sessAt:new Int32Array(0), ok:new Uint8Array(0), V:new Float64Array(0), PV:new Float64Array(0), PV2:new Float64Array(0), vwap:new Float64Array(0), sd:new Float64Array(0), al:null};
function agrandir(n){
  if(C.V.length >= n) return;
  var t = Math.max(n, C.V.length * 2), s = new Int32Array(t), o = new Uint8Array(t);
  s.set(C.sessAt); C.sessAt = s;
  o.set(C.ok); C.ok = o;
  ['V','PV','PV2','vwap','sd'].forEach(function(k){ var a = new Float64Array(t); a.set(C[k]); C[k] = a; });
}

// Sommes cumulees de la periode, barre par barre, comme calcul de
// vwap_pro.js. Incremental : si le graphe a seulement grandi, seules la
// derniere barre connue et les nouvelles sont relues ; si elle n'est plus a son
// index (barres inserees plus tot), tout repart de zero, alertes comprises.
// Passee l'echeance `fin`, la lecture s'arrete et reprend a l'appel suivant.
function calcul(g, r, fin){
  var n = g.n | 0, sig = [g.sym, g.tf, g.seance, r.anc, r.src].join('|'), id0 = cleBarre(n ? g.barre(0) : null);
  var depuis = (C.sig === sig && C.id0 === id0 && n >= C.n && C.n > 0 && cleBarre(g.barre(C.n - 1)) === C.der) ? C.n - 1 : 0;
  if(!depuis){ C.fen = {}; C.al = null; }
  agrandir(n);
  var ouv = OUVERTURE[g.seance] != null ? OUVERTURE[g.seance] : 1080, dur = DUREE[g.seance] || DUREE.eth;
  var prev = depuis > 0 ? g.barre(depuis - 1) : null, sess = depuis > 0 ? C.sessAt[depuis - 1] : 0;
  for(var i = depuis; i < n; i++){
    if(fin && !(i & 255) && i > depuis && maintenant() > fin) break;
    var b = g.barre(i);
    if(!b){ C.cle[i] = null; C.vwap[i] = NaN; C.sd[i] = NaN; C.sessAt[i] = sess; C.V[i] = 0; C.ok[i] = 0; continue; }
    var date = dateDe(b), cle, F = null;
    if(prev && (date ? date !== dateDe(prev) : +b.m < +prev.m)) sess++;
    C.sessAt[i] = sess;
    if(r.anc === 'us'){
      F = C.fen[date] || (C.fen[date] = fenetreM(bornesUS(date || aujourdhui()), ouv));
      cle = dansF(F, +b.m) ? 'j' + sess : null;
    } else cle = 'j' + sess;
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
    // Periode chargee en entier jusqu'ici : entamee dans l'heure, sans barre de comblement.
    var ok = !!cle && !b._trou;
    if(ok) ok = suite ? C.ok[i - 1] === 1 : ecart(F, +b.m, dur) < DEBUT_MAX;
    C.ok[i] = ok ? 1 : 0;
    if(ok && C.V[i] > 0){
      var vw = C.PV[i] / C.V[i];
      C.vwap[i] = vw; C.sd[i] = Math.sqrt(Math.max(0, C.PV2[i] / C.V[i] - vw * vw));
    } else { C.vwap[i] = NaN; C.sd[i] = NaN; }
    prev = b;
  }
  C.n = i; C.sig = sig; C.id0 = id0; C.der = cleBarre(g.barre(i - 1));
  return C;
}

// Niveaux d'alerte : chaque multiplicateur coche, des deux cotes de la VWAP
// (s = +1 au-dessus, -1 dessous) ; 0 est la VWAP, franchie dans les deux sens.
function niveaux(r){
  var vus = {}, N = [];
  for(var k = 1; k <= NA; k++){
    var m = +r['a' + k];
    if(!r['a' + k + 'On'] || !(m >= 0) || vus[m]) continue;
    vus[m] = 1;
    N.push({m:m, s:1}, {m:m, s:-1});
  }
  return N;
}

function pousser(titre, texte){
  try{
    if(typeof Notification === 'undefined') return;
    var envoyer = function(){ try{ new Notification(titre, {body:texte}); }catch(_){} };
    if(Notification.permission === 'granted') envoyer();
    else if(Notification.permission !== 'denied') Notification.requestPermission().then(function(p){ if(p === 'granted') envoyer(); });
  }catch(_){}
}

// Alertes sur les barres closes, chacune lue une fois. Un niveau sonne quand
// une cloture passe au-dela (vers l'exterieur, ou des deux cotes pour la
// VWAP), puis se rearme quand une cloture revient d'au moins `rearme` ticks de
// l'autre cote. Debut de periode ou donnee manquante : tout est desarme, la
// premiere cloture d'une periode n'a rien franchi. Les barres deja la au
// premier passage (et apres une remise a zero) ne sonnent pas, ni celles
// qu'un saut de replay enjambe.
function alertes(g, r){
  var n = g.n | 0, N = niveaux(r), tick = +g.tick || 0.25, sig = N.map(function(x){ return x.m; }).join() + '|' + r.rearme;
  var A = C.al;
  if(!A || A.sig !== sig){
    // Premier passage : depuis le debut de la periode de la derniere barre close, sans sonner.
    var i0 = n - 2;
    while(i0 > 0 && C.ok[i0 - 1] && C.cle[i0 - 1] === C.cle[n - 2]) i0--;
    A = C.al = {sig:sig, i:Math.max(0, i0), cle:null, arme:[], muet:true};
  }
  var d = (String(g.tick).split('.')[1] || '').length, recul = Math.max(0, +r.rearme || 0) * tick;
  for(; A.i <= n - 2; A.i++){
    var i = A.i, ok = C.ok[i] && isFinite(C.vwap[i]);
    if(!ok || C.cle[i] !== A.cle){ A.arme = []; A.cle = ok ? C.cle[i] : null; }
    if(!A.cle) continue;
    var c = +g.barre(i).c;
    for(var j = 0; j < N.length; j++){
      var e = N[j].s * (c - (C.vwap[i] + N[j].s * N[j].m * C.sd[i]));
      if(A.arme[j] && e > 0){
        A.arme[j] = false;
        if(!A.muet && i >= n - 3){
          var lib = N[j].m ? (N[j].s > 0 ? '+' : '−') + N[j].m + 'σ' : tr('la VWAP');
          pousser((g.sym ? g.sym + ' · ' : '') + tr(NOMS[r.anc] || 'VWAP'), tr(N[j].s > 0 ? 'Clôture au-dessus de' : 'Clôture sous') + ' ' + lib + ' : ' + c.toFixed(d));
        }
      } else if(!A.arme[j] && e <= -recul) A.arme[j] = true;
    }
  }
  A.muet = false;
}

// Une polyligne par trace, coupee hors periode et a chaque changement de periode.
function ligne(g, deb, fin, mult){
  var P = [];
  for(var i = deb; i <= fin; i++){
    if(!isFinite(C.vwap[i]) || (i > deb && C.cle[i] !== C.cle[i - 1])) P.push(null);
    if(isFinite(C.vwap[i])) P.push([g.x(i), g.y(C.vwap[i] + mult * C.sd[i])]);
  }
  return P;
}

var reglages = [
  {k:'anc', label:'Ancrage', type:'select', defaut:'jour', options:[['jour','Journalier (séance du graphe)'],['us','Séance US (RTH)']]},
  {k:'src', label:'Source du prix', type:'select', defaut:'auto', options:[['auto','Footprint, sinon (H+L+C)/3'],['hlc3','(H+L+C)/3 × volume'],['close','Clôture × volume']]},
  {k:'masque', label:'Masquer les bougies dans la bande' + FILET, type:'check', defaut:true},
  {k:'haut', label:'Borne haute (écarts-types, 0 = VWAP)', type:'number', defaut:1, min:-6, max:6, pas:0.1},
  {k:'bas', label:'Borne basse (écarts-types, 0 = VWAP)', type:'number', defaut:-1, min:-6, max:6, pas:0.1},
  {k:'vwapOn', label:'Tracer la VWAP' + FILET, type:'check', defaut:true},
  {k:'vwapC', label:'Couleur', type:'color', defaut:'#ffb347'},
  {k:'bornesOn', label:'Tracer les bornes' + FILET, type:'check', defaut:true},
  {k:'bornesC', label:'Couleur', type:'color', defaut:'#5aa9e6'},
  {k:'alertes', label:'Alertes à la clôture' + FILET, type:'check', defaut:true},
  {k:'rearme', label:'Réarmement (ticks)', type:'number', defaut:2, min:0, max:100, pas:1}
];
var MULTS = [1, 2, 3, 0, 1.5, 2.5];
for(var k1 = 1; k1 <= NA; k1++){
  reglages.push({k:'a' + k1 + 'On', label:'Niveau ' + k1, type:'check', defaut:k1 <= 3});
  reglages.push({k:'a' + k1, label:'Multiplicateur (0 = VWAP)', type:'number', defaut:MULTS[k1 - 1], min:0, max:10, pas:0.1});
}

HFQExt.etude({
  id:'bougies-vwap',
  nom:'Bougies hors bande VWAP',
  famille:'VWAP',
  desc:DESC,
  graphes:['bougies'],
  reglages:reglages,
  calcul:function(g, r){ return calcul(g, r); },
  dessine:function(g, r){
    calcul(g, r, maintenant() + BUDGET_MS);
    if(C.n < (g.n | 0)){ redessiner(); return; }
    if(r.alertes && g.n > 1) alertes(g, r);
    var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, C.n - 1), i;
    if(fin < deb) return;
    var lo = Math.min(+r.haut || 0, +r.bas || 0), hi = Math.max(+r.haut || 0, +r.bas || 0);
    if(r.masque){
      // Corps et meche sous un rectangle de fond, d'un pixel plus large et deux plus haut (bordure, anticrenelage).
      var demi = Math.max(1.2, Math.abs(g.x(deb + 1) - g.x(deb)) * CORPS) / 2 + 1, c = g.ctx, S = null, vide = true;
      c.save();
      try{ if(typeof bgStyle === 'function' && typeof size === 'function'){ S = size(); c.fillStyle = bgStyle(c, S.w, S.h); } else c.fillStyle = '#000'; }catch(_){ c.fillStyle = '#000'; }
      c.beginPath();
      for(i = deb; i <= fin; i++){
        var b = g.barre(i), vw = C.vwap[i];
        if(!b || !isFinite(vw) || b.l > vw + hi * C.sd[i] || b.h < vw + lo * C.sd[i]) continue;
        var x = g.x(i), y0 = g.y(b.h) - 2, y1 = g.y(b.l) + 2;
        c.rect(x - demi, Math.min(y0, y1), 2 * demi, Math.abs(y1 - y0));
        vide = false;
      }
      if(!vide) c.fill();
      c.restore();
    }
    if(r.bornesOn){
      var st = {couleur:r.bornesC, epaisseur:1, pointille:[6, 4]};
      g.trait(ligne(g, deb, fin, hi), st);
      if(lo !== hi) g.trait(ligne(g, deb, fin, lo), st);
    }
    if(r.vwapOn) g.trait(ligne(g, deb, fin, 0), {couleur:r.vwapC, epaisseur:1.5});
  }
});

})();
