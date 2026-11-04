// Composites de volume : le profil de volume roulant des N dernieres seances,
// comme le « Volume composite » de TT, sur le Market Profile, les bougies et le
// footprint. Quatre instances (A a D), chacune avec son nombre de seances,
// collee au bord droit ou decalee vers la gauche, pour en poser plusieurs cote
// a cote : par defaut, B (14 seances) se colle a gauche de A (30 seances).
//
// Depuis le 2026-11-04 l'etude cumule elle-meme le volume au tick, depuis les
// jours D du Market Profile ou les niveaux des barres des bougies et du
// footprint, puis regroupe en rangees de `rangee` ticks (auto : la regle de TT,
// un point sur le Nasdaq, un tick ailleurs). Le constructeur natif, lui,
// elargit ses rangees selon l'etendue du profil (HFQContract.pasProfil), d'ou
// des composites de 14 et 30 seances a des pas differents. POC, VAH et VAL au
// tick. Masque, legende a l'appui, si le graphe tient moins de N seances.
(function(){

var STYLES = [['plein','Plein'],['tirets','Tirets'],['points','Pointillés'],['fins','Pointillés fins'],['mixte','Tiret-point']];
var POINTILLE = {plein:null, tirets:[6,4], points:[2,3], fins:[1,3], mixte:[8,3,2,3]};
// Filet des titres de sous-section, le panneau n'en ayant pas.
var FILET = ' ────────────────────';
// ponytail: legendes sous les quatre lignes de profil_periode.js, sans les compter.
var LIGNE0 = 4;

// Anglais : nom, description, reglages, options et textes du canevas.
var FICHIER = 'composites.js';
var DESC = {fr:'Profil de volume roulant des N dernières séances, comme le Volume composite de TT, cumulé au tick et regroupé par rangées, sur le Market Profile, les bougies et le footprint ; à poser côte à côte. Instance ',
            en:'Rolling volume profile of the last N sessions, like TT\'s Volume composite, summed per tick and grouped into rows, on the Market Profile, candles and footprint; to set side by side. Instance '};
var DESC_FIN = {fr:' sur quatre (A à D).', en:' of four (A to D).'};
var EN = {
  'Séances du composite':'Composite sessions', 'Largeur (% du graphe)':'Width (% of chart)',
  'Décalage depuis le bord droit (% du graphe)':'Offset from the right edge (% of chart)', 'Value Area %':'Value Area %', 'Ticks par rangée (0 = auto)':'Ticks per row (0 = auto)',
  'Affichage du volume':'Volume display',
  'Acheteurs et vendeurs empilés':'Buyers and sellers stacked', 'Total, coloré par la Value Area':'Total, colored by the Value Area',
  'Couleur acheteurs':'Buyers color', 'Opacité acheteurs':'Buyers opacity', 'Couleur vendeurs':'Sellers color', 'Opacité vendeurs':'Sellers opacity',
  'Opacité relative hors Value Area':'Relative opacity outside the Value Area',
  'Couleur hors Value Area':'Color outside the Value Area', 'Opacité hors Value Area':'Opacity outside the Value Area',
  'Couleur Value Area':'Value Area color', 'Opacité Value Area':'Value Area opacity', 'Couleur rangée POC':'POC row color', 'Opacité rangée POC':'POC row opacity',
  'Lignes depuis':'Lines from', 'Le bord gauche':'The left edge', 'Le profil seulement':'The profile only',
  'Style':'Style', 'Pointillés fins':'Fine dots', 'Tiret-point':'Dash-dot', 'Étiquettes':'Labels', 'Légende':'Legend',
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

// Date de seance d'une barre : `_date` des bougies, `_sd` du footprint.
function dateDe(b){ return b ? String(b._date || b._sd || '') : ''; }

// Cle de la seance de la derniere barre : sa date, ou, sans date, l'index de la
// barre ou les minutes repartent en arriere.
var SEANCE = {sym:'', n:-1, cle:''};
function seanceDe(g){
  var n = g.n | 0, b = n ? g.barre(n - 1) : null;
  if(!b) return '';
  if(dateDe(b)) return dateDe(b);
  if(SEANCE.n === n && SEANCE.sym === g.sym) return SEANCE.cle;
  var i = n - 1, m = +b.m, p;
  while(i > 0 && (p = g.barre(i - 1)) && +p.m <= m){ m = +p.m; i--; }
  SEANCE = {sym:g.sym, n:n, cle:'i' + i};
  return SEANCE.cle;
}

// Rangee en mode auto, la regle de Turning Trade : une rangee par point sur le
// Nasdaq (NQ, MNQ : 4 ticks de 0,25), un tick ailleurs (demande du 2026-11-04).
function pasAuto(sym, tick){
  var r = String(sym || '').toUpperCase().replace(/[FGHJKMNQUVXZ]\d{1,2}$/, '');
  return /^[MN]?NQ$/.test(r) ? Math.max(1, Math.round(1 / (+tick || 0.25))) : 1;
}

// Aire de valeur de TT : depuis le POC, on ajoute le voisin le plus fourni
// jusqu'a couvrir la part demandee ; ex aequo vers le haut, POC ex aequo le
// plus bas. Indices dans V.
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

// Volume par tick d'une seance : h = Map(index de tick -> [bid, ask]) ; cotes
// vrai si bid ou ask est renseigne, sinon tout est dans bid.
function ajoute(h, prix, bid, ask, t){
  var q = Math.round(prix / t), e = h.get(q);
  if(!e){ e = [0, 0]; h.set(q, e); }
  e[0] += bid; e[1] += ask;
}

// Les seances que le graphe tient, du plus ancien au plus recent, lues une fois
// par source et partagees par les instances : {cle, jours:[{date, h, cotes}]}.
// Market Profile : les jours D de la page (volRows [prix, total, bid, ask], ou
// rows [.., .., .., total, bid, ask]), globales de marketprofile_pro.html ;
// bougies et footprint : les niveaux des barres, par date de seance. La seance
// en cours est figee a son etat de la premiere lecture, comme dans le composite
// natif ; une seance de plus, ou un historique qui change, relit tout.
var JOURS = {cle:'', jours:null};
function jours(g){
  var t = g.tick || 0.25, cle, J = [], k, i;
  if(g.graphe === 'profil'){
    var D0 = null, vt = 0;
    try{ D0 = D; vt = mpVolTick(); }catch(_){ return null; }
    if(!D0 || !D0.length) return null;
    cle = ['mp', D0.length, D0[0].date, D0[D0.length - 1].date, vt].join('|');
    if(JOURS.cle === cle) return JOURS;
    t = vt || t;
    for(k = 0; k < D0.length; k++){
      var d = D0[k], rows = d.volRows || d.rows || [], c = d.volRows ? 1 : 3, h = new Map(), cotes = false;
      for(i = 0; i < rows.length; i++){
        var v = rows[i], bid = +v[c + 1] || 0, ask = +v[c + 2] || 0, tot = +v[c] || bid + ask;
        if(!isFinite(+v[0]) || !(tot > 0)) continue;
        if(bid > 0 || ask > 0) cotes = true; else bid = tot;
        ajoute(h, +v[0], bid, ask, t);
      }
      if(h.size) J.push({date:String(d.date || ''), h:h, cotes:cotes, t:t});
    }
  }
  else {
    var n = g.n | 0;
    if(!n) return null;
    var b0 = g.barre(0);
    cle = [g.graphe, g.sym, g.tf, g.seance, n > 1 ? seanceDe(g) : '', b0 ? dateDe(b0) + ':' + b0.m : ''].join('|');
    if(JOURS.cle === cle) return JOURS;
    var cur = null, prev = null;
    for(i = 0; i < n; i++){
      var b = g.barre(i);
      if(!b) continue;
      var date = dateDe(b);
      if(!cur || (date ? date !== cur.date : +b.m < +prev.m)){ cur = {date:date || 'i' + i, h:new Map(), cotes:true, t:t}; J.push(cur); }
      var lv = b.lv || [];
      for(k = 0; k < lv.length; k++) if((lv[k][1] || 0) + (lv[k][2] || 0) > 0) ajoute(cur.h, lv[k][0], lv[k][1] || 0, lv[k][2] || 0, t);
      prev = b;
    }
    for(k = J.length - 1; k >= 0; k--) if(!J[k].h.size) J.splice(k, 1);
  }
  JOURS = {cle:cle, jours:J};
  return JOURS;
}

// Profil des n derniers jours, au tick, puis rangees de `pas` ticks alignees
// sur des multiples de `pas` (elles ne bougent pas avec le defilement) : prix
// au centre de la rangee, volume, bid et ask par rangee ; POC, VAH et VAL
// restent au tick, quel que soit le regroupement.
function construire(J, n, part, pas){
  var jours = J.slice(-n), h = new Map(), cotes = false, t = jours[0].t, k, i;
  for(k = 0; k < jours.length; k++){
    cotes = cotes || jours[k].cotes;
    jours[k].h.forEach(function(e, q){ var s = h.get(q); if(!s){ s = [0, 0]; h.set(q, s); } s[0] += e[0]; s[1] += e[1]; });
  }
  var T = Array.from(h.keys()).sort(function(a, b){ return a - b; }), V = new Float64Array(T.length);
  for(k = 0; k < T.length; k++){ var e = h.get(T[k]); V[k] = e[0] + e[1]; }
  var Z = zoneValeur(V, part), R = new Map(), ordre = [];
  for(k = 0; k < T.length; k++){
    var q = Math.floor(T[k] / pas), r = R.get(q), e2 = h.get(T[k]);
    if(!r){ r = [0, 0]; R.set(q, r); ordre.push(q); }
    r[0] += e2[0]; r[1] += e2[1];
  }
  var m = ordre.length, prices = new Float64Array(m), vols = new Float64Array(m), bids = new Float64Array(m), asks = new Float64Array(m), max = 0;
  for(i = 0; i < m; i++){
    var rr = R.get(ordre[i]);
    prices[i] = (ordre[i] * pas + (pas - 1) / 2) * t; bids[i] = rr[0]; asks[i] = rr[1]; vols[i] = rr[0] + rr[1];
    if(vols[i] > max) max = vols[i];
  }
  return {P:{tick:pas * t, prices:prices, vols:vols, bids:bids, asks:asks, max:max, hasSides:cotes, poc:T[Z.poc] * t, vah:T[Z.vah] * t, val:T[Z.val] * t, total:Z.total},
          days:jours.length, dateFrom:jours[0].date, dateTo:jours[jours.length - 1].date};
}

// Composite de l'instance : {P, titre} ou {raison}. Construit une fois par
// seance et par reglage ; masque si le graphe tient moins de seances que
// demande.
// ponytail: la lecture des seances tourne en une image (quelques dizaines de ms pour 24 seances ES) ; l'etaler si l'accroc se voit.
function calcul(C, g, r){
  var S = jours(g);
  if(!S || !S.jours.length) return {raison:'Composite : profil de volume indisponible sur ce graphe'};
  var n = Math.max(5, Math.min(260, r.seances | 0)), pas = r.rangee >= 1 ? r.rangee | 0 : pasAuto(g.sym, S.jours[0].t);
  var nom = tr('Composite') + ' ' + n + ' ' + tr('séances');
  if(S.jours.length < n) return {raison:nom + ' · ' + tr('masqué') + ' : ' + S.jours.length + ' ' + tr('séances disponibles'), masque:true};
  var cle = S.cle + '|' + n + '|' + r.vaPct + '|' + pas;
  if(C.cle !== cle){ C.cle = cle; C.b = construire(S.jours, n, r.vaPct / 100, pas); }
  var B = C.b;
  return {P:B.P, titre:nom + ' · ' + tr('du') + ' ' + B.dateFrom + ' ' + tr('au') + ' ' + B.dateTo};
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
  if(X.raison){ if(r.legende) g.texte(F.droite - 4 * e, yTxt, X.raison, {couleur:'#8a929c', taille:10, align:'right'}); return; }
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
  // Prix des niveaux au-dessus de leur ligne, a gauche du profil ; legende en haut a droite.
  var xl = xR - W - 4 * e, n = r.seances | 0, niv = [['POC', P.poc, r.pocL, r.pocLC], ['VAH', P.vah, r.vaL && aVA, r.vaLC], ['VAL', P.val, r.vaL && aVA, r.vaLC]];
  if(r.etiq) for(k = 0; k < niv.length; k++) if(niv[k][2])
    g.texte(xl, g.y(niv[k][1]) - 2 * e, niv[k][0] + ' ' + n + ' ' + prix(niv[k][1], t), {couleur:niv[k][3], taille:10, align:'right', base:'bottom'});
  if(r.legende) g.texte(F.droite - 4 * e, yTxt, X.titre, {couleur:'#8a929c', taille:10, align:'right'});
}

function reglages(seances, decal){
  return [
    {k:'seances',  label:'Séances du composite', type:'number', defaut:seances, min:5, max:260, pas:1},
    {k:'largeur',  label:'Largeur (% du graphe)', type:'number', defaut:12, min:2, max:60, pas:1},
    {k:'decal',    label:'Décalage depuis le bord droit (% du graphe)', type:'number', defaut:decal, min:0, max:95, pas:1},
    {k:'vaPct',    label:'Value Area %', type:'number', defaut:70, min:50, max:95, pas:1},
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
    {k:'etiq',     label:'Étiquettes', type:'check', defaut:true},
    {k:'legende',  label:'Légende', type:'check', defaut:true}
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
    outils:{zoneValeur:zoneValeur, pasAuto:pasAuto, jours:jours},
    dessine:function(g, r){ dessine(C, rang, g, r); }
  });
}

instance('A', 0, 30);
instance('B', 1, 14);
instance('C', 2, 60);
instance('D', 3, 90);

})();
