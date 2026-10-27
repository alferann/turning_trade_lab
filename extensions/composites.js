// Composites de volume : le profil de volume roulant des N dernieres seances,
// tel que le construit le « Volume composite » de TT (HFQCompositeVP), sur le
// Market Profile, les bougies et le footprint. Quatre instances (A a D), chacune
// avec son nombre de seances, collee au bord droit ou decalee vers la gauche,
// pour en poser plusieurs cote a cote : par defaut, B (14 seances) se colle a
// gauche de A (30 seances).
//
// Market Profile : les jours que la page a charges (D) passent dans le
// constructeur du composite natif ; bougies et footprint : la fonction qui
// alimente leurs panneaux de profil. Memes rangees, POC, VAH et VAL que TT.
// Masque, legende a l'appui, si l'historique ne couvre pas les N seances.
(function(){

var STYLES = [['plein','Plein'],['tirets','Tirets'],['points','Pointillés'],['fins','Pointillés fins'],['mixte','Tiret-point']];
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3], fins:[1,3], mixte:[8,3,2,3]};
// Filet des titres de sous-section, le panneau n'en ayant pas.
var FILET = ' ────────────────────';
// ponytail: legendes sous les quatre lignes de profil_periode.js, sans les compter.
var LIGNE0 = 4;

// Anglais : nom, description, reglages, options et textes du canevas.
var FICHIER = 'composites.js';
var DESC = {fr:'Profil de volume roulant des N dernières séances, celui du Volume composite de TT, sur le Market Profile, les bougies et le footprint ; à poser côte à côte. Instance ',
            en:'Rolling volume profile of the last N sessions, the one behind TT\'s Volume composite, on the Market Profile, candles and footprint; to set side by side. Instance '};
var DESC_FIN = {fr:' sur quatre (A à D).', en:' of four (A to D).'};
var EN = {
  'Séances du composite':'Composite sessions', 'Largeur (% du graphe)':'Width (% of chart)',
  'Décalage depuis le bord droit (% du graphe)':'Offset from the right edge (% of chart)', 'Value Area %':'Value Area %',
  'Affichage du volume':'Volume display',
  'Acheteurs et vendeurs empilés':'Buyers and sellers stacked', 'Total, coloré par la Value Area':'Total, colored by the Value Area',
  'Couleur acheteurs':'Buyers color', 'Opacité acheteurs':'Buyers opacity', 'Couleur vendeurs':'Sellers color', 'Opacité vendeurs':'Sellers opacity',
  'Opacité relative hors Value Area':'Relative opacity outside the Value Area',
  'Couleur hors Value Area':'Color outside the Value Area', 'Opacité hors Value Area':'Opacity outside the Value Area',
  'Couleur Value Area':'Value Area color', 'Opacité Value Area':'Value Area opacity', 'Couleur rangée POC':'POC row color', 'Opacité rangée POC':'POC row opacity',
  'Lignes depuis':'Lines from', 'Le bord gauche':'The left edge', 'Le profil seulement':'The profile only',
  'Style':'Style', 'Pointillés fins':'Fine dots', 'Tiret-point':'Dash-dot', 'Étiquettes et légende':'Labels and caption',
  'Composite':'Composite', 'séances':'sessions', 'du':'from', 'au':'to', 'masqué':'hidden', 'séances disponibles':'sessions available',
  'Composite : profil de volume indisponible sur ce graphe':'Composite: volume profile unavailable on this chart'
};
EN['Histogramme' + FILET] = 'Histogram' + FILET;
EN['Ligne POC' + FILET] = 'POC line' + FILET;
EN['Lignes VAH et VAL' + FILET] = 'VAH and VAL lines' + FILET;
['A', 'B', 'C', 'D'].forEach(function(l){
  var fr = DESC.fr + l + DESC_FIN.fr, en = DESC.en + l + DESC_FIN.en, suffixe = ' (extensions/' + FICHIER + ')';
  EN['Composite de volume · ' + l] = 'Volume Composite · ' + l;
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

// Prix avec les decimales du pas de cotation.
function prix(v, t){ return (+v).toFixed((String(t).split('.')[1] || '').length); }

// Cle de la seance de la derniere barre : sa date, ou sur le footprint (sans
// dates) l'index de la barre ou les minutes repartent en arriere.
var SEANCE = {sym:'', n:-1, cle:''};
function seanceDe(g){
  var n = g.n | 0, b = n ? g.barre(n - 1) : null;
  if(!b) return '';
  if(b._date) return String(b._date);
  if(SEANCE.n === n && SEANCE.sym === g.sym) return SEANCE.cle;
  var i = n - 1, m = +b.m, p;
  while(i > 0 && (p = g.barre(i - 1)) && +p.m <= m){ m = +p.m; i--; }
  SEANCE = {sym:g.sym, n:n, cle:'i' + i};
  return SEANCE.cle;
}

// D'ou vient le composite : {cle, f(seances, vaPct)} ou null. Sur le Market
// Profile, D et mpVolTick sont des globales de marketprofile_pro.html ; la cle
// change quand un jour s'ajoute, comme celle du composite natif.
function source(g){
  var W = typeof window !== 'undefined' ? window : {}, VP = W.HFQCompositeVP;
  if(g.graphe === 'profil'){
    var J = null, vt = 0;
    try{ J = D; vt = mpVolTick(); }catch(_){ return null; }
    if(!VP || !J || !J.length) return null;
    return {cle:['mp', J.length, J[0].date, J[J.length - 1].date, vt].join('|'),
            f:function(n, va){ return VP.buildRollingFromMpDays(J, {tick:vt, days:n, vaPct:va}); }};
  }
  var fn = typeof W.caVppBundle === 'function' ? W.caVppBundle : typeof W.fpVppBundle === 'function' ? W.fpVppBundle : null;
  if(!fn) return null;
  return {cle:[g.graphe, g.sym, g.tf, g.seance, seanceDe(g)].join('|'), f:function(n, va){ return fn('rolling', {days:n, vaPct:va}); }};
}

// Composite de l'instance : {P, titre} ou {raison}. Construit une fois par
// seance et par reglage (le constructeur de TT coute environ 0,2 s pour 30
// seances) ; masque si TT a trouve moins de seances que demande.
// ponytail: la seance en cours est figee a son etat du premier calcul, comme dans le composite natif.
// ponytail: le constructeur tourne en une image (13 ms pour 5 seances au banc, 0,2 s pour 90) ; l'etaler si l'accroc se voit.
function calcul(C, g, r){
  var S = source(g);
  if(!S) return {raison:'Composite : profil de volume indisponible sur ce graphe'};
  var n = Math.max(5, Math.min(260, r.seances | 0)), cle = S.cle + '|' + n + '|' + r.vaPct;
  if(C.cle !== cle){
    var b = null;
    try{ b = S.f(n, r.vaPct); }catch(_){ b = null; }
    C.cle = cle; C.b = b;
  }
  var B = C.b, nom = tr('Composite') + ' ' + n + ' ' + tr('séances');
  if(!B || !B.profile) return {raison:nom + ' · ' + tr('masqué') + ' : 0 ' + tr('séances disponibles'), masque:true};
  if(B.days < n) return {raison:nom + ' · ' + tr('masqué') + ' : ' + B.days + ' ' + tr('séances disponibles'), masque:true};
  return {P:B.profile, titre:nom + ' · ' + tr('du') + ' ' + B.dateFrom + ' ' + tr('au') + ' ' + B.dateTo};
}

function peindre(c, Q, couleur, op, trait){
  if(!Q.length || !(op > 0)) return;
  c.globalAlpha = Math.min(1, op);
  c.beginPath();
  for(var k = 0; k < Q.length; k += 4) c.rect(Q[k], Q[k + 1], Q[k + 2], Q[k + 3]);
  if(trait){ c.strokeStyle = couleur; c.lineWidth = trait; c.stroke(); }
  else { c.fillStyle = couleur; c.fill(); }
}

// Rangees de TT centrees sur leur prix, collees au bord xR et tournees vers la
// gauche : acheteurs contre le bord, vendeurs au bout ; ou volume total colore
// par la Value Area.
function dessine(C, rang, g, r){
  var X = calcul(C, g, r), F = g.cadre, e = g.echelle || 1, c = g.ctx, t = g.tick || 0.25;
  var yTxt = F.haut + (12 + 13 * (LIGNE0 + rang)) * e;
  if(X.raison){ g.texte(F.droite - 4 * e, yTxt, X.raison, {couleur:'#8a929c', taille:10, align:'right'}); return; }
  var P = X.P, pas = P.tick || t, xR = F.droite - F.largeur * r.decal / 100, W = F.largeur * r.largeur / 100, k;
  var cotes = r.mode === 'empile' && P.hasSides && P.bids && P.asks, aVA = P.val != null && P.vah != null;
  var Q = {hors:[], va:[], poc:[], achat:[], vente:[], achatH:[], venteH:[], cadre:[]};
  if(r.profil && c) for(k = 0; k < P.prices.length; k++){
    var p = P.prices[k], ya = g.y(p + pas / 2), yb = g.y(p - pas / 2), y0 = Math.min(ya, yb), h = Math.abs(yb - ya);
    if(y0 > F.bas || y0 + h < F.haut) continue;
    if(h > 3 * e){ y0 += 0.5 * e; h -= e; }
    var va = aVA && p + pas / 2 > P.val && p - pas / 2 <= P.vah, poc = P.poc >= p - pas / 2 && P.poc < p + pas / 2;
    var w = W * P.vols[k] / P.max;
    if(cotes){
      var wa = W * P.asks[k] / P.max, wv = W * P.bids[k] / P.max;
      (va ? Q.achat : Q.achatH).push(xR - wa, y0, wa, h);
      (va ? Q.vente : Q.venteH).push(xR - wa - wv, y0, wv, h);
      if(poc) Q.cadre.push(xR - wa - wv, y0, wa + wv, h);
    }
    else (poc ? Q.poc : va ? Q.va : Q.hors).push(xR - w, y0, w, h);
  }
  if(c){
    if(cotes){
      peindre(c, Q.achat, r.achatC, r.achatO); peindre(c, Q.vente, r.venteC, r.venteO);
      peindre(c, Q.achatH, r.achatC, r.achatO * r.horsVA); peindre(c, Q.venteH, r.venteC, r.venteO * r.horsVA);
      peindre(c, Q.cadre, r.pocC, r.pocO, e);
    }
    else { peindre(c, Q.hors, r.couleur, r.opac); peindre(c, Q.va, r.couleurVA, r.opacVA); peindre(c, Q.poc, r.pocC, r.pocO); }
    c.globalAlpha = 1;
  }
  var x0 = r.lignes === 'gauche' ? F.gauche : xR - W, yp = g.y(P.poc), yh = g.y(P.vah), yl = g.y(P.val);
  if(r.pocL) g.trait([[x0, yp], [xR, yp]], {couleur:r.pocLC, epaisseur:+r.pocLE || 1.5, pointille:POINTILLE[r.pocLT] || null, opacite:+r.pocLO});
  if(r.vaL && aVA) g.trait([[x0, yh], [xR, yh], [NaN, NaN], [x0, yl], [xR, yl]], {couleur:r.vaLC, epaisseur:+r.vaLE || 1, pointille:POINTILLE[r.vaLT] || null, opacite:+r.vaLO});
  if(!r.etiq) return;
  // Prix des niveaux au-dessus de leur ligne, a gauche du profil ; legende en haut a droite.
  var xl = xR - W - 4 * e, n = r.seances | 0, niv = [['POC', P.poc, r.pocL, r.pocLC], ['VAH', P.vah, r.vaL && aVA, r.vaLC], ['VAL', P.val, r.vaL && aVA, r.vaLC]];
  for(k = 0; k < niv.length; k++) if(niv[k][2])
    g.texte(xl, g.y(niv[k][1]) - 2 * e, niv[k][0] + ' ' + n + ' ' + prix(niv[k][1], t), {couleur:niv[k][3], taille:10, align:'right', base:'bottom'});
  g.texte(F.droite - 4 * e, yTxt, X.titre, {couleur:'#8a929c', taille:10, align:'right'});
}

function reglages(seances, decal){
  return [
    {k:'seances',  label:'Séances du composite', type:'number', defaut:seances, min:5, max:260, pas:1},
    {k:'largeur',  label:'Largeur (% du graphe)', type:'number', defaut:12, min:2, max:60, pas:1},
    {k:'decal',    label:'Décalage depuis le bord droit (% du graphe)', type:'number', defaut:decal, min:0, max:95, pas:1},
    {k:'vaPct',    label:'Value Area %', type:'number', defaut:70, min:50, max:95, pas:1},
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
    {k:'lignes',   label:'Lignes depuis', type:'select', defaut:'profil', options:[['profil','Le profil seulement'],['gauche','Le bord gauche']]},
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
    {k:'etiq',     label:'Étiquettes et légende', type:'check', defaut:true}
  ];
}

// TT refuse deux etudes de meme id et memorise les reglages par id : une
// declaration par instance, chacune avec son cache. Les decalages par defaut
// collent chaque instance a gauche de la precedente (largeur 12 %).
function instance(lettre, rang, seances){
  var C = {cle:'', b:null};
  HFQExt.etude({
    id:'composites-' + lettre.toLowerCase(),
    nom:'Composite de volume · ' + lettre,
    famille:'Profil',
    desc:DESC.fr + lettre + DESC_FIN.fr,
    graphes:['profil','bougies','footprint'],
    reglages:reglages(seances, 12 * rang),
    calcul:function(g, r){ return calcul(C, g, r); },
    dessine:function(g, r){ dessine(C, rang, g, r); }
  });
}

instance('A', 0, 30);
instance('B', 1, 14);
instance('C', 2, 60);
instance('D', 3, 90);

})();
