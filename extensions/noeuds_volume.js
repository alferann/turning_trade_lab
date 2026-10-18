// Noeuds du profil de volume : HVN, LVN, ledges et shelves detectes sur le
// profil que dessinent les panneaux de profil de volume de TT (SVP seance,
// CVP fenetre visible, CMP composite N seances), traces en zones sur le graphe.
//
// Le profil vient de la fonction qui alimente ces panneaux (caVppBundle sur
// les bougies, fpVppBundle sur le footprint) : memes rangees, meme pas que ce
// que TT affiche. Les seuils se comptent en rangees, parce que TT regroupe les
// ticks pour qu'un profil tienne en 320 rangees environ.
//
// HVN : sommet du profil lisse dont la proeminence depasse une part du POC.
// LVN : creux dont les deux murs montent a un multiple du creux. Ledge :
// rupture nette, le volume moyen de quelques rangees d'un cote de la limite
// vaut un multiple de celui de l'autre cote. Shelf : palier plat adosse a un
// ledge, du cote epais.
(function(){

// ponytail: seuils fixes en part du volume du POC : profondeur mini d'un LVN,
// volume mini du cote epais d'un ledge et d'un shelf. A regler si le bruit gene.
var LVN_PROF = 0.10, EPAIS = 0.25;
// ponytail: un profil de seance ou visible se recalcule a chaque barre, et au
// plus toutes les 300 ms quand seule la barre en cours bouge. Le composite
// (0,6 s pour 90 seances dans le constructeur de TT) une fois par seance du
// graphe ; sur le footprint, qui ne date pas ses barres, une fois par graphe.
var VIF_MS = 300;
// Vrai si l'image precedente a recalcule un profil. TT suspend une etude
// au-dela de 8 ms sur trois images d'affilee ; son constructeur de profil
// prend 5 a 7 ms sur une seance d'ES, bien plus sur une fenetre visible tres
// dezoomee. Apres une image froide, la suivante se sert du cache.
var FROIDE = false;
var COURT = {session:'SVP', visible:'CVP', rolling:'CMP'};
var FILET = ' ────────────────────';
var CACHE = {};

// Anglais : nom, description, reglages, options et textes du canevas.
var DESC = 'HVN, LVN, ledges et shelves détectés sur les panneaux de profil de volume du graphe (séance, fenêtre visible, composite), tracés en zones.';
var DESC_EN = 'HVN, LVN, ledges and shelves detected on the chart\'s volume profile panels (session, visible window, composite), drawn as zones.';
var EN = {
  'Nœuds du profil de volume':'Volume profile nodes', 'Profil analysé':'Profile analyzed',
  'Panneaux de profil ouverts':'Open profile panels', 'Séance (SVP)':'Session (SVP)',
  'Fenêtre visible (CVP)':'Visible window (CVP)', 'Composite N séances (CMP)':'Composite N sessions (CMP)',
  'Lissage (rangées)':'Smoothing (rows)', 'Opacité des zones':'Zone opacity',
  'Proéminence mini (% du POC)':'Minimum prominence (% of POC)', 'Murs mini (× le creux)':'Minimum walls (× the trough)',
  'Rapport mini côté épais / côté mince':'Minimum thick side / thin side ratio', 'Rangées comparées de chaque côté':'Rows compared on each side',
  'Hauteur mini (rangées)':'Minimum height (rows)', 'Écart toléré sur le palier (%)':'Tolerated spread on the plateau (%)',
  'Ledge haut':'Upper ledge', 'Ledge bas':'Lower ledge',
  'Nœuds VP : aucun panneau de profil ouvert':'VP nodes: no profile panel open',
  'Nœuds VP : profil de volume indisponible sur ce graphe':'VP nodes: volume profile unavailable on this chart'
};
EN['HVN : nœuds de volume élevé' + FILET] = 'HVN: high volume nodes' + FILET;
EN['LVN : nœuds de volume faible' + FILET] = 'LVN: low volume nodes' + FILET;
EN['Ledges : ruptures nettes' + FILET] = 'Ledges: sharp breaks' + FILET;
EN['Shelves : paliers adossés à un ledge' + FILET] = 'Shelves: plateaus backed by a ledge' + FILET;
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/noeuds_volume.js)'] = DESC_EN + ' (extensions/noeuds_volume.js)';

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

// Moyenne glissante triangulaire sur L rangees de chaque cote.
function lisser(v, L){
  var n = v.length, s = new Array(n);
  for(var i = 0; i < n; i++){
    var a = 0, w = 0;
    for(var k = -L; k <= L; k++){
      var j = i + k;
      if(j < 0 || j >= n) continue;
      a += (L + 1 - Math.abs(k)) * v[j];
      w += L + 1 - Math.abs(k);
    }
    s[i] = a / w;
  }
  return s;
}

// Noeuds d'un profil TT {prices, vols, tick}, prix croissants. Les prix sans
// volume manquent au profil : on les remet a zero pour garder un pas regulier.
function detecter(P, r){
  var out = {hvn:[], lvn:[], ledge:[], shelf:[]};
  var t = +P.tick, src = P.prices || [], i, j;
  if(!(t > 0) || src.length < 5) return out;
  var n = Math.round((src[src.length - 1] - src[0]) / t) + 1, x = new Array(n), v = new Array(n);
  for(i = 0; i < n; i++){ x[i] = src[0] + i * t; v[i] = 0; }
  for(i = 0; i < src.length; i++) v[Math.round((src[i] - src[0]) / t)] += +P.vols[i] || 0;
  var L = Math.max(0, r.lissage | 0), s = lisser(v, L), mx = 0, vmx = 0;
  for(i = 0; i < n; i++){ if(s[i] > mx) mx = s[i]; if(v[i] > vmx) vmx = v[i]; }
  if(!(mx > 0)) return out;
  var at = function(k){ return k < 0 || k >= n ? 0 : s[k]; };
  var pic = function(k){ return s[k] > at(k - 1) && s[k] >= at(k + 1); };
  var creux = function(k){ return k > 0 && k < n - 1 && s[k] < s[k - 1] && s[k] <= s[k + 1]; };
  var zone = function(type, k, a, b){ return {type:type, prix:x[k], bas:x[a] - t / 2, haut:x[b] + t / 2}; };
  var C = [], a, b;

  for(i = 0; i < n; i++){
    if(pic(i)){
      // Proeminence : hauteur au-dessus du plus haut des deux cols qui menent
      // a un sommet plus haut ; le bord du profil compte pour zero.
      var cg = s[i], cd = s[i];
      for(j = i - 1; j >= 0 && s[j] <= s[i]; j--) cg = Math.min(cg, s[j]);
      if(j < 0) cg = 0;
      for(j = i + 1; j < n && s[j] <= s[i]; j++) cd = Math.min(cd, s[j]);
      if(j >= n) cd = 0;
      var prom = s[i] - Math.max(cg, cd);
      if(prom >= r.hvnProm / 100 * mx) C.push({i:i, hvn:true, seuil:s[i] - prom / 2});
    } else if(creux(i)){
      // Murs : le plus haut de chaque cote avant de retomber sous le creux.
      var mg = s[i], md = s[i];
      for(j = i - 1; j >= 0 && s[j] >= s[i]; j--) mg = Math.max(mg, s[j]);
      for(j = i + 1; j < n && s[j] >= s[i]; j++) md = Math.max(md, s[j]);
      var mur = Math.min(mg, md);
      if(mur >= r.lvnMur * s[i] && mur - s[i] >= LVN_PROF * mx) C.push({i:i, hvn:false, seuil:s[i] + (mur - s[i]) / 2});
    }
  }

  // Zones : jusqu'a mi-proeminence (mi-profondeur pour un LVN), a travers
  // les creux et bosses mineurs, sans atteindre un noeud retenu de l'autre
  // type ni passer le col (la crete) qui separe deux noeuds de meme type.
  for(var c = 0; c < C.length; c++){
    var o = C[c], lim = [0, n - 1];
    for(var d = -1; d <= 1; d += 2){
      var w = C[c + d];
      if(!w) continue;
      var bord = w.i;
      if(w.hvn === o.hvn) for(bord = o.i + d, j = bord; j !== w.i; j += d) if(o.hvn ? s[j] < s[bord] : s[j] > s[bord]) bord = j;
      lim[(d + 1) / 2] = bord - d;
    }
    var dedans = function(k){ return o.hvn ? s[k] >= o.seuil : s[k] <= o.seuil; };
    for(a = o.i; a > lim[0] && dedans(a - 1); a--);
    for(b = o.i; b < lim[1] && dedans(b + 1); b++);
    out[o.hvn ? 'hvn' : 'lvn'].push(zone(o.hvn ? 'hvn' : 'lvn', o.i, a, b));
  }

  // Ledges sur le volume brut, que le lissage emousserait : limite entre les
  // rangees i et i+1, k rangees de chaque cote, on garde le meilleur rapport
  // a k rangees pres.
  var k = Math.max(1, r.ledgeK | 0), q = [], dessous = [];
  for(i = k - 1; i <= n - k - 1; i++){
    var A = 0, B = 0;
    for(j = 0; j < k; j++){ A += v[i - j]; B += v[i + 1 + j]; }
    q[i] = Math.max(A, B) >= EPAIS * vmx * k ? Math.max(A, B) / Math.max(Math.min(A, B), 1) : 0;
    dessous[i] = A > B;
  }
  for(i = k - 1; i <= n - k - 1; i++){
    if(!(q[i] >= r.ledgeRatio)) continue;
    var meilleur = true;
    for(j = Math.max(k - 1, i - k); j <= Math.min(n - k - 1, i + k); j++) if(q[j] > q[i] || (q[j] === q[i] && j < i)) meilleur = false;
    if(!meilleur) continue;
    out.ledge.push({type:'ledge', prix:x[i] + t / 2, dessous:dessous[i]});

    // Shelf : palier plat cote epais. Les L premieres rangees, melangees au
    // cote mince par le lissage, ne jugent pas la planeite mais en font partie.
    var sens = dessous[i] ? -1 : 1, pied = dessous[i] ? i : i + 1, deb = pied + sens * L;
    if(deb < 0 || deb >= n) continue;
    var lo = s[deb], hi = s[deb], som = s[deb], nb = 1, fin = deb;
    for(j = deb + sens; j >= 0 && j < n; j += sens){
      var l2 = Math.min(lo, s[j]), h2 = Math.max(hi, s[j]);
      if(h2 - l2 > r.shelfTol / 100 * (som + s[j]) / (nb + 1)) break;
      lo = l2; hi = h2; som += s[j]; nb++; fin = j;
    }
    if(Math.abs(fin - pied) + 1 < r.shelfMin || som / nb < EPAIS * mx) continue;
    var z = zone('shelf', pied, Math.min(pied, fin), Math.max(pied, fin)), fondu = false;
    // Un palier borde de deux ledges se trouve deux fois : on fond.
    for(j = 0; j < out.shelf.length; j++){
      var deja = out.shelf[j];
      if(z.bas < deja.haut && z.haut > deja.bas){ deja.bas = Math.min(deja.bas, z.bas); deja.haut = Math.max(deja.haut, z.haut); fondu = true; }
    }
    if(!fondu) out.shelf.push(z);
  }
  return out;
}

// Panneaux de profil du graphe : la liste complete quand TT l'expose (elle
// porte le nombre de seances du composite), sinon la disposition publique.
function panneaux(){
  var V = typeof window !== 'undefined' ? window.HFQVPPanels : null, L = null;
  try{ L = V && V._dev && V._dev.panes ? V._dev.panes() : V && V.layout ? (V.layout() || {}).panes : null; }catch(_){ L = null; }
  return Array.isArray(L) ? L : [];
}

function fournisseur(){
  var W = typeof window !== 'undefined' ? window : {};
  return typeof W.caVppBundle === 'function' ? W.caVppBundle : typeof W.fpVppBundle === 'function' ? W.fpVppBundle : null;
}

// Portees a analyser : celles des panneaux ouverts, ou celle du reglage meme
// sans panneau. Deux panneaux de meme portee (le preset par defaut de TT en
// ouvre deux sur la seance) donnent le meme profil : un seul calcul.
function portees(r){
  var P = panneaux(), out = [], vu = {};
  for(var i = 0; i < P.length; i++){
    var p = P[i];
    if(!p || !COURT[p.scope] || (r.source === 'tous' ? p.on === false : p.scope !== r.source)) continue;
    var days = p.scope === 'rolling' ? (+p.days || 90) : 0, cle = p.scope + days;
    if(vu[cle]) continue;
    vu[cle] = 1;
    out.push({scope:p.scope, days:days, cle:cle});
  }
  // ponytail: composite sans panneau sur 90 seances, le defaut de TT.
  if(r.source !== 'tous' && !out.length) out.push({scope:r.source, days:r.source === 'rolling' ? 90 : 0, cle:r.source + (r.source === 'rolling' ? 90 : 0)});
  return out;
}

var DETECTION = ['lissage', 'hvnProm', 'lvnMur', 'ledgeRatio', 'ledgeK', 'shelfMin', 'shelfTol'];

function profil(g, por, fn, r, froide){
  var n = g.n | 0, last = n ? g.barre(n - 1) : null, base = [g.sym, g.tf, g.seance].join('|');
  var fixe = por.scope === 'rolling' ? last && last._date || '' : n + (por.scope === 'visible' ? ':' + g.premiere + ':' + g.derniere : '');
  var vif = last ? [last.c, last.v, g.niveaux(n - 1).n].join('|') : '';
  var C = CACHE[por.cle], t = Date.now();
  var perime = C && (C.fixe !== fixe || (C.vif !== vif && por.scope !== 'rolling' && t - C.t >= VIF_MS));
  if(!C || C.base !== base || (perime && !froide)){
    var b = null;
    try{ b = fn(por.scope, {days:por.days || 90}); }catch(_){ b = null; }
    C = CACHE[por.cle] = {base:base, fixe:fixe, vif:vif, t:t, P:b && b.profile || null, cleR:'', N:null};
    FROIDE = true;
  }
  var cleR = DETECTION.map(function(k){ return r[k]; }).join('|');
  if(C.cleR !== cleR){ C.cleR = cleR; C.N = C.P ? detecter(C.P, r) : null; }
  return C.N;
}

// Liste des profils suivis et de leurs noeuds, ou la raison de l'absence.
function calcul(g, r){
  var fn = fournisseur();
  if(!fn) return {raison:'Nœuds VP : profil de volume indisponible sur ce graphe', profils:[]};
  var S = portees(r), out = [], froide = FROIDE;
  FROIDE = false;
  if(!S.length) return {raison:'Nœuds VP : aucun panneau de profil ouvert', profils:[]};
  for(var i = 0; i < S.length; i++){
    var N = profil(g, S[i], fn, r, froide);
    if(N) out.push({nom:COURT[S[i].scope] + (S[i].days ? ' ' + S[i].days : ''), noeuds:N});
  }
  return {raison:null, profils:out};
}

function sousSection(k, label, reglages, couleur){
  return [{k:k, label:label + FILET, type:'check', defaut:true}].concat(reglages, [{k:k + 'C', label:'Couleur', type:'color', defaut:couleur}]);
}

var def = {
  id:'noeuds-volume',
  nom:'Nœuds du profil de volume',
  famille:'Profil',
  desc:DESC,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'source', label:'Profil analysé', type:'select', defaut:'tous', options:[['tous','Panneaux de profil ouverts'],['session','Séance (SVP)'],['visible','Fenêtre visible (CVP)'],['rolling','Composite N séances (CMP)']]},
    {k:'lissage', label:'Lissage (rangées)', type:'number', defaut:2, min:0, max:8, pas:1},
    {k:'opac', label:'Opacité des zones', type:'number', defaut:0.1, min:0, max:0.5, pas:0.02},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true}
  ].concat(
    sousSection('hvn', 'HVN : nœuds de volume élevé', [{k:'hvnProm', label:'Proéminence mini (% du POC)', type:'number', defaut:15, min:1, max:100, pas:1}], '#ff8c0a'),
    sousSection('lvn', 'LVN : nœuds de volume faible', [{k:'lvnMur', label:'Murs mini (× le creux)', type:'number', defaut:2, min:1.2, max:20, pas:0.1}], '#9a6fd0'),
    sousSection('ledge', 'Ledges : ruptures nettes', [
      {k:'ledgeRatio', label:'Rapport mini côté épais / côté mince', type:'number', defaut:2, min:1.2, max:10, pas:0.1},
      {k:'ledgeK', label:'Rangées comparées de chaque côté', type:'number', defaut:3, min:1, max:12, pas:1}], '#7fb0d8'),
    sousSection('shelf', 'Shelves : paliers adossés à un ledge', [
      {k:'shelfMin', label:'Hauteur mini (rangées)', type:'number', defaut:4, min:2, max:40, pas:1},
      {k:'shelfTol', label:'Écart toléré sur le palier (%)', type:'number', defaut:25, min:5, max:60, pas:1}], '#4bd48e')),
  calcul:calcul,
  outils:{detecter:detecter, lisser:lisser},
  dessine:function(g, r){
    var R = calcul(g, r), F = g.cadre, e = g.echelle || 1, etiq = [];
    if(R.raison){ g.texte(F.gauche + 8 * e, F.haut + 14 * e, tr(R.raison), {couleur:'#8a929c', taille:10}); return; }
    var suffixe = R.profils.length > 1;
    for(var p = 0; p < R.profils.length; p++){
      var N = R.profils[p].noeuds, nom = suffixe ? ' · ' + R.profils[p].nom : '';
      // Des zones larges aux traits fins, pour que les ledges restent au-dessus.
      var types = ['shelf', 'hvn', 'lvn', 'ledge'];
      for(var t = 0; t < types.length; t++){
        var T = types[t], L = N[T], col = r[T + 'C'];
        if(!r[T]) continue;
        for(var i = 0; i < L.length; i++){
          var z = L[i], y = g.y(z.prix);
          if(T === 'ledge'){
            if(y < F.haut || y > F.bas) continue;
            g.ligne(z.prix, {couleur:col, epaisseur:1.5, opacite:0.9});
            etiq.push({y:y, s:tr(z.dessous ? 'Ledge haut' : 'Ledge bas') + nom, col:col});
            continue;
          }
          var y0 = g.y(z.haut), y1 = g.y(z.bas);
          if(Math.max(y0, y1) < F.haut || Math.min(y0, y1) > F.bas) continue;
          if(r.opac > 0) g.zone(z.bas, z.haut, {couleur:col, opacite:r.opac});
          if(T !== 'shelf') g.ligne(z.prix, {couleur:col, opacite:0.6, pointille:T === 'lvn' ? [4, 3] : null});
          etiq.push({y:T === 'shelf' ? (y0 + y1) / 2 : y, s:(T === 'shelf' ? 'Shelf' : T.toUpperCase()) + nom, col:col});
        }
      }
    }
    if(!r.etiq) return;
    // Etiquettes au bord droit ; une etiquette trop proche de la precedente saute.
    etiq.sort(function(a, b){ return a.y - b.y; });
    for(var k = 0, dernier = -Infinity; k < etiq.length; k++){
      if(etiq[k].y < F.haut || etiq[k].y > F.bas || etiq[k].y - dernier < 11 * e) continue;
      dernier = etiq[k].y;
      g.texte(F.droite - 4 * e, etiq[k].y, etiq[k].s, {couleur:etiq[k].col, taille:10, align:'right'});
    }
  }
};

HFQExt.etude(def);

})();
