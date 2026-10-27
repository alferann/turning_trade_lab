// Divergences CVD : UE / UA / DE / DA, sur le prix et dans un volet CVD.
// Deux etudes, un seul calcul partage et mis en cache. Les reglages de
// detection, les filtres et les couleurs vivent sur l'etude « prix » ;
// le volet CVD les relit via HFQExt.etudes() et ne garde que l'affichage.
//
// Un pivot prix n'est retenu que si un pivot CVD de meme sens tombe a
// `tol` barres pres (les deux moteurs d'accord). Chaque pivot B est compare
// a tous les pivots retenus avant lui dans l'ecart max, pas seulement au
// precedent : une divergence enjambe souvent un sommet intermediaire. La
// ligne relie les pivots prix sur le graphe et les pivots CVD dans le volet.
// Etats : formation (B pas encore pivot, « ? »), attente (pointille), confirmee
// (le prix a casse l'extreme oppose du segment, trait plein), cassee (le prix a
// redepasse B avant, pointille attenue « x »). Une zone de pre-tir se peint au
// niveau du dernier pivot retenu quand le prix y revient et que le CVD diverge
// deja. Les nouveaux signaux de la seance passent par HFQNotify.
(function(){

// ponytail: 09:30 ET en minutes de seance sur un graphe ETH ouvert a 18:00 (ES, NQ).
// A exposer en reglage si un produit avec un autre RTH arrive.
var RTH_M = 930;

// Anglais : noms, descriptions, reglages, options, textes du canevas et des
// notifications. Les descriptions portent aussi le suffixe que le panneau ajoute.
var DESC_PRIX = 'UE/UA/DE/DA entre pivots du prix qui ont un pivot CVD à côté, zones de pré-tir, alertes. Porte les réglages de détection du volet CVD.';
var DESC_CVD = 'Chandeliers de delta cumulé, mèches lues sur la tape de la séance, axes nus, mêmes divergences que l\'étude prix (réglages de détection lus là-bas).';
var EN = {
  'Divergences CVD · prix':'CVD Divergences · price', 'Divergences CVD · volet CVD':'CVD Divergences · CVD pane',
  'Ancrage CVD':'CVD anchor', 'ETH / séance du graphe':'ETH / chart session', 'Comparer sur':'Compare on', 'Mèche':'Wick', 'Clôture':'Close',
  'Confirmation':'Confirmation', 'Dès la clôture (pointillé)':'From the close (dashed)', 'Pivot confirmé seul':'Confirmed pivot only',
  'Invalider si dépassement':'Invalidate if crossed', 'Tolérance prix ↔ CVD (barres)':'Price ↔ CVD tolerance (bars)',
  'Pivot CVD exigé (1-3)':'Required CVD pivot (1-3)', 'Pivot court (barres)':'Short pivot (bars)',
  'Agrégation moyen':'Medium aggregation', 'Agrégation long':'Long aggregation', 'Écart max (barres)':'Max gap (bars)',
  'Amplitude mini si prix différents (ticks)':'Min amplitude if prices differ (ticks)', 'Écart CVD mini (contrats, 0 = off)':'Min CVD gap (contracts, 0 = off)',
  'Force relative mini (0-1, 0 = off)':'Min relative strength (0-1, 0 = off)', 'Zones de pré-tir':'Pre-shot zones',
  'Pré-tir : distance au pivot (ticks)':'Pre-shot: distance to pivot (ticks)',
  'Niveau court':'Short level', 'Niveau moyen':'Medium level', 'Niveau long':'Long level',
  'UE  épuisement haussier':'UE  uptrend exhaustion', 'UA  absorption de l\'achat':'UA  uptrend absorption',
  'DE  épuisement baissier':'DE  downtrend exhaustion', 'DA  absorption de la vente':'DA  downtrend absorption',
  'Montrer les cassées (✗)':'Show broken ones (✗)', 'Couleur UE':'UE color', 'Couleur UA':'UA color', 'Couleur DE':'DE color', 'Couleur DA':'DA color',
  'Écart marqueur → texte (px)':'Marker → text gap (px)', 'Étiquettes':'Labels', 'Taille du texte':'Text size', 'Texte en gras':'Bold text',
  'Point au pivot B':'Dot at pivot B', 'Rayon du point (px)':'Dot radius (px)', 'Triangle au pivot B':'Triangle at pivot B',
  'Taille du triangle':'Triangle size', 'Écart pivot → triangle (px)':'Pivot → triangle gap (px)',
  'Notifier les formations (?)':'Notify forming ones (?)', 'Notifier les confirmées':'Notify confirmed ones',
  'Style du CVD':'CVD style', 'Chandeliers':'Candles', 'Mèches (tape de la séance)':'Wicks (session tape)', 'Ligne':'Line', 'Axe des ordonnées':'Y axis', 'Côté de l\'axe':'Axis side',
  'Droite':'Right', 'Gauche':'Left', 'Axe zéro':'Zero line', 'Étiquette zéro':'Zero label', 'Couleur des axes':'Axis color',
  'Bougie CVD haussière':'CVD up candle', 'Bougie CVD baissière':'CVD down candle', 'Ligne CVD':'CVD line',
  'pré-tir':'pre-shot', 'Divergence CVD':'CVD divergence', 'en formation à':'forming at', 'confirmée à':'confirmed at',
  'Divergences CVD : ce graphe ne sert aucun delta par barre':'CVD Divergences: this chart serves no per-bar delta',
  'CVD : aucun delta par barre sur ce graphe':'CVD: no per-bar delta on this chart'
};
EN[DESC_PRIX] = 'UE/UA/DE/DA between price pivots that have a CVD pivot nearby, pre-shot zones, alerts. Holds the detection settings of the CVD pane.';
EN[DESC_CVD] = 'Cumulative delta candles, wicks read from the session tape, bare axes, same divergences as the price study (detection settings read there).';
[DESC_PRIX, DESC_CVD].forEach(function(d){ EN[d + ' (extensions/cvd_div.js)'] = EN[d] + ' (extensions/cvd_div.js)'; });

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

var DETECTION = [
  {k:'anc',label:'Ancrage CVD',type:'select',defaut:'rth',options:[['rth','RTH (09:30 NY)'],['eth','ETH / séance du graphe']]},
  {k:'cmp',label:'Comparer sur',type:'select',defaut:'meche',options:[['meche','Mèche'],['close','Clôture']]},
  {k:'conf',label:'Confirmation',type:'select',defaut:'cloture',options:[['cloture','Dès la clôture (pointillé)'],['pivot','Pivot confirmé seul']]},
  {k:'inval',label:'Invalider si dépassement',type:'check',defaut:true},
  {k:'tol',label:'Tolérance prix ↔ CVD (barres)',type:'number',defaut:2,min:0,max:10,pas:1},
  {k:'exig',label:'Pivot CVD exigé (1-3)',type:'number',defaut:1,min:1,max:3,pas:1},
  {k:'p1',label:'Pivot court (barres)',type:'number',defaut:3,min:1,max:50,pas:1},
  {k:'k2',label:'Agrégation moyen',type:'number',defaut:2,min:1,max:10,pas:1},
  {k:'k3',label:'Agrégation long',type:'number',defaut:2,min:1,max:10,pas:1},
  {k:'dmax',label:'Écart max (barres)',type:'number',defaut:120,min:5,max:1000,pas:5},
  {k:'minT',label:'Amplitude mini si prix différents (ticks)',type:'number',defaut:0,min:0,max:200,pas:1},
  {k:'minD',label:'Écart CVD mini (contrats, 0 = off)',type:'number',defaut:0,min:0,max:100000,pas:10},
  {k:'minF',label:'Force relative mini (0-1, 0 = off)',type:'number',defaut:0,min:0,max:1,pas:0.05},
  {k:'pre',label:'Zones de pré-tir',type:'check',defaut:true},
  {k:'preZ',label:'Pré-tir : distance au pivot (ticks)',type:'number',defaut:8,min:1,max:200,pas:1}
];
var FILTRES = [
  {k:'n1',label:'Niveau court',type:'check',defaut:true},
  {k:'n2',label:'Niveau moyen',type:'check',defaut:true},
  {k:'n3',label:'Niveau long',type:'check',defaut:true},
  {k:'ue',label:'UE  épuisement haussier',type:'check',defaut:true},
  {k:'ua',label:'UA  absorption de l\'achat',type:'check',defaut:true},
  {k:'de',label:'DE  épuisement baissier',type:'check',defaut:true},
  {k:'da',label:'DA  absorption de la vente',type:'check',defaut:true},
  {k:'voirCassees',label:'Montrer les cassées (✗)',type:'check',defaut:true},
  {k:'cUE',label:'Couleur UE',type:'color',defaut:'#e0567f'},
  {k:'cUA',label:'Couleur UA',type:'color',defaut:'#b48cff'},
  {k:'cDE',label:'Couleur DE',type:'color',defaut:'#19d67a'},
  {k:'cDA',label:'Couleur DA',type:'color',defaut:'#4fd6e0'}
];
var TEXTE = [
  {k:'txtOff',label:'Écart marqueur → texte (px)',type:'number',defaut:12,min:0,max:60,pas:1},
  {k:'etiq',label:'Étiquettes',type:'check',defaut:true},
  {k:'fsize',label:'Taille du texte',type:'number',defaut:11,min:6,max:28,pas:1},
  {k:'gras',label:'Texte en gras',type:'check',defaut:true}
];
var POINT = [
  {k:'point',label:'Point au pivot B',type:'check',defaut:true},
  {k:'pointR',label:'Rayon du point (px)',type:'number',defaut:3,min:1,max:10,pas:0.5}
];
var TRIANGLE = [
  {k:'tri',label:'Triangle au pivot B',type:'check',defaut:true},
  {k:'triT',label:'Taille du triangle',type:'number',defaut:5,min:2,max:14,pas:1},
  {k:'triOff',label:'Écart pivot → triangle (px)',type:'number',defaut:10,min:0,max:60,pas:1}
];
var ALERTES = [
  {k:'alForm',label:'Notifier les formations (?)',type:'check',defaut:true},
  {k:'alConf',label:'Notifier les confirmées',type:'check',defaut:true}
];
var PARTAGES = DETECTION.concat(FILTRES);
var DEFAUTS = {};
PARTAGES.forEach(function(d){ DEFAUTS[d.k] = d.defaut; });

// Pivots a L barres, sans regarder de l'autre cote d'une remise a zero du CVD.
// Deux pivots a moins de L barres l'un de l'autre ont forcement la meme valeur,
// c'est un plateau : seule sa derniere barre reste.
function piv1(v, sk, L, sens){
  var out = [], n = v.length;
  for(var j = L; j < n - L; j++){
    var x = v[j], ok = true;
    for(var k = j - L; k <= j + L; k++){
      if(k === j || sk[k] !== sk[j]) continue;
      if(sens > 0 ? v[k] > x : v[k] < x){ ok = false; break; }
    }
    if(ok){
      if(out.length && j - out[out.length - 1] <= L) out[out.length - 1] = j;
      else out.push(j);
    }
  }
  return out;
}

// Pivots de niveau superieur : un pivot qui domine K pivots de chaque cote.
function pivN(p, v, sk, K, sens){
  var out = [];
  for(var a = K; a < p.length - K; a++){
    var x = v[p[a]], ok = true;
    for(var b = a - K; b <= a + K; b++){
      if(b === a || sk[p[b]] !== sk[p[a]]) continue;
      if(sens > 0 ? v[p[b]] > x : v[p[b]] < x){ ok = false; break; }
    }
    if(ok) out.push(p[a]);
  }
  return out;
}

// Le pivot CVD le plus proche de j a `tol` barres pres, meme seance ; -1 sinon.
function proche(q, j, tol, sk){
  var lo = 0, hi = q.length;
  while(lo < hi){ var m = (lo + hi) >> 1; if(q[m] < j - tol) lo = m + 1; else hi = m; }
  var best = -1;
  for(var i = lo; i < q.length && q[i] <= j + tol; i++){
    if(sk[q[i]] !== sk[j]) continue;
    if(best < 0 || Math.abs(q[i] - j) < Math.abs(best - j)) best = q[i];
  }
  return best;
}

// Les pivots prix qui ont un pivot CVD a cote : [{p, q}].
function retenir(p, q, tol, sk){
  var out = [];
  for(var i = 0; i < p.length; i++){
    var k = proche(q, p[i], tol, sk);
    if(k >= 0) out.push({p:p[i], q:k});
  }
  return out;
}

function libre(v, A, B, sens){
  var ref = sens > 0 ? Math.max(v[A], v[B]) : Math.min(v[A], v[B]);
  for(var k = A + 1; k < B; k++){
    if(sens > 0 ? v[k] > ref : v[k] < ref) return false;
  }
  return true;
}

// Force relative : l'ecart CVD rapporte a l'amplitude du CVD sur le segment.
function force(cv, qa, qb){
  var mx = -Infinity, mn = Infinity;
  for(var k = qa; k <= qb; k++){ if(cv[k] > mx) mx = cv[k]; if(cv[k] < mn) mn = cv[k]; }
  return mx > mn ? Math.abs(cv[qb] - cv[qa]) / (mx - mn) : 0;
}

function candidat(v, sens, deb, n){
  if(deb >= n - 1) return -1;
  var best = -1;
  for(var j = deb + 1; j < n; j++){
    if(best < 0 || (sens > 0 ? v[j] > v[best] : v[j] < v[best])) best = j;
  }
  return best;
}

// La divergence entre les pivots A et B, ou null.
function paire(S, r, A, B, qa, qb, sens, niv, prov){
  var v = sens > 0 ? S.hi : S.lo, cv = S.cv, sk = S.sk, k;
  if(B <= A || qb <= qa || sk[A] !== sk[B]) return null;
  if(S.idx[B] - S.idx[A] > r.dmax || B - A <= r.p1) return null;
  var vA = v[A], vB = v[B], cA = cv[qa], cB = cv[qb];
  if(cA === cB || Math.abs(cB - cA) < r.minD) return null;
  if(vA !== vB && Math.abs(vB - vA) < S.seuil) return null;
  if(r.inval && (!libre(v, A, B, sens) || !libre(cv, qa, qb, sens))) return null;
  if(r.minF > 0 && force(cv, qa, qb) < r.minF) return null;
  var t = null;
  if(sens > 0){
    if(cB < cA && vB >= vA) t = 'UE';
    else if(cB > cA && vB <= vA) t = 'UA';
  } else {
    if(cB > cA && vB <= vA) t = 'DE';
    else if(cB < cA && vB >= vA) t = 'DA';
  }
  if(!t) return null;
  // Etat : apres B, le premier evenement l'emporte. Le prix casse l'extreme
  // oppose du segment A..B : confirmee. Le prix redepasse B : cassee. Sinon : attente.
  var etat = 'formation', fin = B;
  if(!prov){
    var w = sens > 0 ? S.lo : S.hi, ref = sens > 0 ? Infinity : -Infinity;
    for(k = A; k <= B; k++){ if(sens > 0 ? w[k] < ref : w[k] > ref) ref = w[k]; }
    etat = 'attente'; fin = S.n - 1;
    for(k = B + 1; k < S.n && sk[k] === sk[B] && S.idx[k] - S.idx[B] <= r.dmax; k++){
      if(sens > 0 ? v[k] > vB : v[k] < vB){ etat = 'cassee'; fin = k; break; }
      if(sens > 0 ? w[k] < ref : w[k] > ref){ etat = 'confirmee'; fin = k; break; }
    }
  }
  return {t:t, n:niv + 1, a:A, b:B, qa:qa, qb:qb, pa:vA, pb:vB, dc:cB - cA, up:(sens > 0 ? 1 : 0), etat:etat, fin:fin};
}

// La meilleure divergence qui finit en B parmi les pivots retenus H[0..fin-1] :
// pas seulement le precedent, tous ceux de l'ecart max, `libre` ecartant les
// lignes qui traversent un extreme intermediaire. Une seule par B et par sens.
// ponytail: « meilleure » = plus grand ecart CVD ; a affiner si deux types se disputent un B.
function meilleur(S, r, H, fin, B, qb, sens, niv, prov){
  var best = null;
  for(var a = fin - 1; a >= 0; a--){
    var A = H[a].p;
    if(S.sk[A] !== S.sk[B] || S.idx[B] - S.idx[A] > r.dmax) break;
    var s = paire(S, r, A, B, H[a].q, qb, sens, niv, prov);
    if(s && (!best || Math.abs(s.dc) > Math.abs(best.dc))) best = s;
  }
  return best;
}

// Pre-tir : le prix revient au niveau du dernier pivot retenu de la seance et le
// CVD diverge deja. Le type annonce depend du cote ou se trouve le CVD.
function preTir(S, r, H, sens, sig){
  if(!r.pre || !H.length) return null;
  var last = S.n - 1, A = H[H.length - 1].p, qa = H[H.length - 1].q, cv = S.cv;
  var v = sens > 0 ? S.hi : S.lo;
  if(S.sk[A] !== S.sk[last] || last - A <= r.p1) return null;
  if(Math.abs(v[last] - v[A]) > r.preZ * S.tick) return null;
  if(r.inval && (!libre(v, A, last, sens) || !libre(cv, qa, last, sens))) return null;
  var cA = cv[qa], cB = cv[last];
  if(cA === cB || Math.abs(cB - cA) < r.minD) return null;
  if(r.minF > 0 && force(cv, qa, last) < r.minF) return null;
  for(var i = 0; i < sig.length; i++){
    if(sig[i].etat === 'formation' && sig[i].up === (sens > 0 ? 1 : 0)) return null;
  }
  return {t:(sens > 0 ? (cB < cA ? 'UE' : 'UA') : (cB > cA ? 'DE' : 'DA')), a:A, niv:v[A], up:(sens > 0 ? 1 : 0)};
}

// Premier index de [deb, fin] dont l'abscisse atteint x, fin + 1 sinon : g.x
// croit avec l'index.
function borne(g, deb, fin, x){
  while(deb <= fin){ var m = (deb + fin) >> 1; if(g.x(m) < x) deb = m + 1; else fin = m - 1; }
  return deb;
}
// Barres a l'ecran, une de part et d'autre du cadre. Le footprint passe tout
// l'historique dans premiere..derniere, pas seulement les barres a l'ecran.
function vue(g){
  var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, (g.n | 0) - 1);
  deb = Math.max(deb, borne(g, deb, fin, g.cadre.gauche) - 1);
  return [deb, Math.min(fin, borne(g, deb, fin, g.cadre.droite))];
}

function calc(g, r){
  var V = vue(g), i0 = Math.max(0, V[0] - 300), i1 = V[1];
  if(!(i1 > i0)) return null;
  var idx = [], hi = [], lo = [], cv = [], dl = [], sk = [], mn = [];
  var cum = 0, cle = null, aDelta = false;
  var aNiv = (typeof g.niveaux === 'function');
  var rth = (r.anc === 'rth' && g.seance === 'eth');
  for(var i = i0; i <= i1; i++){
    var b = g.barre(i);
    if(!b) continue;
    var c = String(b._date || '') + ((rth && +b.m >= RTH_M) ? 'R' : '');
    if(c !== cle){ cum = 0; cle = c; }
    var d = 0;
    if(aNiv){
      var L = g.niveaux(i);
      if(L && L.n){ d = L.deltaTotal() || 0; if(d !== 0) aDelta = true; }
    }
    cum += d;
    idx.push(i);
    hi.push(r.cmp === 'close' ? b.c : b.h);
    lo.push(r.cmp === 'close' ? b.c : b.l);
    cv.push(cum);
    dl.push(d);
    sk.push(c);
    mn.push(+b.m);
  }
  var n = idx.length;
  if(n < 10) return null;

  var S = {idx:idx, hi:hi, lo:lo, cv:cv, dl:dl, sk:sk, n:n, tick:(g.tick || 0), seuil:r.minT * (g.tick || 0)};

  var ph = [piv1(hi, sk, r.p1, 1)], pl = [piv1(lo, sk, r.p1, -1)];
  ph.push(pivN(ph[0], hi, sk, r.k2, 1));  pl.push(pivN(pl[0], lo, sk, r.k2, -1));
  ph.push(pivN(ph[1], hi, sk, r.k3, 1));  pl.push(pivN(pl[1], lo, sk, r.k3, -1));

  var qh = [piv1(cv, sk, r.p1, 1)], ql = [piv1(cv, sk, r.p1, -1)];
  qh.push(pivN(qh[0], cv, sk, r.k2, 1));  ql.push(pivN(ql[0], cv, sk, r.k2, -1));
  qh.push(pivN(qh[1], cv, sk, r.k3, 1));  ql.push(pivN(ql[1], cv, sk, r.k3, -1));

  var ex = Math.min(3, Math.max(1, r.exig)) - 1, tol = Math.max(0, r.tol | 0);
  var sig = [], niv, a, s, H, Lw, H0 = [], L0 = [], d1, cp, cc;
  for(niv = 0; niv < 3; niv++){
    H  = retenir(ph[niv], qh[ex], tol, sk);
    Lw = retenir(pl[niv], ql[ex], tol, sk);
    if(niv === 0){ H0 = H; L0 = Lw; }
    for(a = 1; a < H.length; a++){  s = meilleur(S, r, H,  a, H[a].p,  H[a].q,  1,  niv, false); if(s) sig.push(s); }
    for(a = 1; a < Lw.length; a++){ s = meilleur(S, r, Lw, a, Lw[a].p, Lw[a].q, -1, niv, false); if(s) sig.push(s); }

    // En formation : l'extreme encore trop recent pour etre un pivot, prix et CVD d'accord.
    if(r.conf === 'cloture'){
      if(H.length){
        d1 = H[H.length-1].p;
        cp = candidat(hi, 1, d1, n); cc = candidat(cv, 1, d1, n);
        if(cp >= n - r.p1 && cc >= 0 && Math.abs(cp - cc) <= tol){ s = meilleur(S, r, H, H.length, cp, cc, 1, niv, true); if(s) sig.push(s); }
      }
      if(Lw.length){
        d1 = Lw[Lw.length-1].p;
        cp = candidat(lo, -1, d1, n); cc = candidat(cv, -1, d1, n);
        if(cp >= n - r.p1 && cc >= 0 && Math.abs(cp - cc) <= tol){ s = meilleur(S, r, Lw, Lw.length, cp, cc, -1, niv, true); if(s) sig.push(s); }
      }
    }
  }
  // Une meme paire A..B trouvee a plusieurs niveaux ne se dessine qu'au plus haut.
  var vu = {}, uniq = [];
  for(a = 0; a < sig.length; a++){
    var k = sig[a].t + ':' + sig[a].a + ':' + sig[a].b;
    if(vu[k] != null) uniq[vu[k]] = sig[a]; else { vu[k] = uniq.length; uniq.push(sig[a]); }
  }
  var pre = [], z;
  if((z = preTir(S, r, H0,  1, uniq))) pre.push(z);
  if((z = preTir(S, r, L0, -1, uniq))) pre.push(z);
  return {idx:idx, cv:cv, dl:dl, sk:sk, mn:mn, sig:uniq, pre:pre, aDelta:aDelta};
}

// Meches du volet : extremes du delta cumule pendant la barre, que seule la
// tape ordonne (g.prints, temps en secondes depuis l'ouverture comme `m`).
// TT ne la sert que pour la seance affichee. Une barre n'a de meche que si sa
// tape redonne exactement le delta de ses niveaux : barre hors tape, tape
// commencee en cours de barre ou trou de flux, le corps reste seul.
// Par barre, la plage de prints [a+1..b] et le chemin deja lu : la barre en
// formation ne relit que ses nouveaux prints. Le premier passage sur une seance
// chargee (480 000 prints sur ES) depasse 8 ms : l'image s'arrete a 5 ms depuis
// `t0`, debut de dessine, calcul partage compris (2 a 4 ms par tick sur une
// seance entiere), la suite a l'image suivante, demandee par HFQExt.redessiner().
var MECHES = {cle:'', m:new Map()}, BUDGET_MS = 5;
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function meches(g, S, d0, t0){
  var P = g.prints, out = {};
  if(!P || !P.n || typeof P.avant !== 'function') return out;
  var cle = [g.sym, g.seance, g.tf].join('|');
  if(cle !== MECHES.cle){ MECHES.cle = cle; MECHES.m = new Map(); }
  var jourDe = function(k){ return S.sk[k].replace(/R$/, ''); };
  var avant = function(m){ return P.avant((Math.ceil(m * 6000) - 0.5) / 100); };
  var der = g.barre(g.n - 1), jour = String((der && der._date) || ''), n = S.idx.length;
  var suiv = g.barre(S.idx[n - 1] + 1), reste = false;
  for(var k = d0; k < n && !reste; k++){
    if(jourDe(k) !== jour) continue;
    var fin = (k + 1 < n) ? (jourDe(k + 1) === jour ? S.mn[k + 1] : null)
            : (suiv && String(suiv._date || '') === jour ? +suiv.m : null);
    var a = avant(S.mn[k]), b = (fin == null) ? P.n - 1 : avant(fin);
    var e = MECHES.m.get(S.idx[k]);
    if(!e || e.a !== a || e.b > b){ e = {a:a, b:a, run:0, h:0, l:0}; MECHES.m.set(S.idx[k], e); }
    for(var j = e.b + 1; j <= b; j++){
      e.run += P.achat(j) ? P.taille(j) : -P.taille(j);
      if(e.run > e.h) e.h = e.run; else if(e.run < e.l) e.l = e.run;
      if(!(j & 4095) && maintenant() - t0 > BUDGET_MS){ reste = j < b; break; }
    }
    e.b = Math.min(j, b);
    if(!reste && e.b > e.a && e.run === S.dl[k]) out[k] = e;
  }
  if(reste){
    try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
  }
  return out;
}

// Un calcul par image, partage par les deux etudes : la cle change avec la
// fenetre, la derniere barre (prix et delta) et les reglages de detection.
var CACHE = {cle:'', S:null};
function cleDe(g, r){
  var V = vue(g), b = g.barre(V[1]) || {};
  var L = (typeof g.niveaux === 'function') ? g.niveaux(V[1]) : null;
  return [g.sym, g.tf, g.seance, g.n, V[0], V[1], b.c, b.h, b.l, (L && L.n) ? L.deltaTotal() : 0,
          DETECTION.map(function(d){ return r[d.k]; }).join('|')].join('|');
}
function calcCache(g, r){
  var k = cleDe(g, r);
  if(k !== CACHE.cle){ CACHE.cle = k; CACHE.S = calc(g, r); }
  return CACHE.S;
}

// Les reglages partages tels que l'etude prix les tient, meme si elle est
// masquee. HFQExt.etudes(), la liste du panneau, ne lit que les reglages
// demandes (1 ms) ; inventaire() relit ceux de toutes les etudes chargees
// (20 a 30 ms avec 24 etudes), ce qui suspendait le volet.
function partages(){
  try{
    var L = HFQExt.etudes(), out = {}, i, k;
    for(i = 0; i < L.length; i++) if(L[i].id === 'ext:cvddiv-prix'){
      for(k = 0; k < L[i].params.length; k++) out[L[i].params[k].k] = L[i].params[k].get();
      return out;
    }
  }catch(_){}
  return DEFAUTS;
}

// Notifications : une fois par signal, pour la seance en cours seulement. La
// premiere image ne fait qu'amorcer la memoire, l'historique ne sonne pas.
var NOTIF = {vu:{}, amorce:false};
function notifier(g, S, r, P){
  var recent = S.idx[S.n - 1] - 2 * P.p1, nouveaux = [], i, s, cle;
  for(i = 0; i < S.sig.length; i++){
    s = S.sig[i];
    if(s.etat !== 'formation' && s.etat !== 'confirmee') continue;
    cle = s.t + ':' + S.idx[s.a] + ':' + S.idx[s.b] + ':' + s.etat;
    if(NOTIF.vu[cle]) continue;
    NOTIF.vu[cle] = 1;
    if(!NOTIF.amorce || S.idx[s.fin] < recent) continue;
    if(s.etat === 'formation' ? !r.alForm : !r.alConf) continue;
    nouveaux.push(s);
  }
  NOTIF.amorce = true;
  for(i = 0; i < nouveaux.length; i++){
    s = nouveaux[i];
    var m = {titre:tr('Divergence CVD'), niveau:'info',
      texte:(g.sym || '') + ' · ' + s.t + s.n + ' ' + tr(s.etat === 'formation' ? 'en formation à' : 'confirmée à') +
            ' ' + s.pb + ' · CVD ' + Math.round(S.cv[s.qa]) + ' → ' + Math.round(S.cv[s.qb])};
    pousser(m);
  }
}

// HFQNotify s'il existe un jour ; sinon les notifications de bureau, le canal
// que le calendrier eco de la maison utilise deja (Mako sous Hyprland).
function pousser(m){
  try{
    if(window.HFQNotify){ HFQNotify.push(m); return; }
    if(typeof Notification === 'undefined') return;
    var envoyer = function(){ try{ new Notification(m.titre, {body:m.texte}); }catch(_){} };
    if(Notification.permission === 'granted') envoyer();
    else if(Notification.permission !== 'denied') Notification.requestPermission().then(function(p){ if(p === 'granted') envoyer(); });
  }catch(_){}
}

function triangle(g, x, y, up, col, plein, taille, off, dessiner){
  var e = g.echelle || 1, t = taille * e, h = taille * 1.4 * e;
  var yp = y + (up ? -off * e : off * e);
  var yb = up ? yp - h : yp + h;
  var c = g.ctx;
  if(dessiner && c){
    c.save();
    c.beginPath();
    c.moveTo(x, yp);
    c.lineTo(x - t, yb);
    c.lineTo(x + t, yb);
    c.closePath();
    if(plein){ c.fillStyle = col; c.fill(); }
    else { c.strokeStyle = col; c.lineWidth = 1.3 * e; c.stroke(); }
    c.restore();
  }
  return dessiner ? yb : yp;
}

function point(g, x, y, up, col, plein, rayon, dessiner){
  var e = g.echelle || 1, c = g.ctx;
  if(dessiner && c){
    c.save();
    c.beginPath();
    c.arc(x, y, rayon * e, 0, Math.PI * 2);
    if(plein){ c.fillStyle = col; c.fill(); }
    else { c.strokeStyle = col; c.lineWidth = 1.3 * e; c.stroke(); }
    c.restore();
  }
  return dessiner ? y + (up ? -rayon * e : rayon * e) : y;
}

function label(g, x, y, s, col, taille, gras, align){
  var e = g.echelle || 1, c = g.ctx;
  if(!c){ g.texte(x, y, s, {taille:taille, align:(align || 'center'), couleur:col}); return; }
  c.save();
  c.font = (gras ? 'bold ' : '') + Math.round(taille * e) + 'px system-ui, -apple-system, Segoe UI, sans-serif';
  c.textAlign = align || 'center';
  c.textBaseline = 'middle';
  c.fillStyle = col;
  c.fillText(s, x, y);
  c.restore();
}

var COULEURS = function(P){ return {UE:P.cUE, UA:P.cUA, DE:P.cDE, DA:P.cDA}; };

// Trace les signaux ; `pt(s)` donne les deux extremites dans le repere du volet,
// `marque(x, y, up, col, plein)` pose le marqueur en B et rend le y libre pour le texte.
function dessinerSignaux(g, S, P, r, pt, marque){
  var on = {UE:P.ue, UA:P.ua, DE:P.de, DA:P.da};
  var cols = COULEURS(P);
  var nOn = [P.n1, P.n2, P.n3];
  var ep  = [1.2, 2, 3];
  var op  = [0.55, 0.8, 1];
  var e = g.echelle || 1;
  for(var i = 0; i < S.sig.length; i++){
    var s = S.sig[i];
    if(!on[s.t] || !nOn[s.n - 1]) continue;
    var cassee = s.etat === 'cassee', plein = s.etat === 'confirmee';
    if(cassee && !P.voirCassees) continue;
    var col = cols[s.t], q = pt(s);
    var o = {couleur:col, epaisseur:ep[s.n-1], opacite:op[s.n-1] * (cassee ? 0.5 : plein ? 1 : 0.75)};
    if(!plein) o.pointille = true;
    g.trait([q[0], q[1]], o);
    var base = marque(q[1][0], q[1][1], s.up, col, plein);
    if(r.etiq){
      label(g, q[1][0], base + (s.up ? -r.txtOff * e : r.txtOff * e),
        s.t + s.n + (s.etat === 'formation' ? '?' : '') + (cassee ? ' ✗' : ''), col, r.fsize, r.gras);
    }
  }
}

// Zones de pre-tir, sur le prix : une bande du niveau du pivot vers le cote
// d'ou le prix arrive, du pivot au bord droit, avec le type annonce.
function dessinerPreTir(g, S, P, r){
  var cols = COULEURS(P), F = g.cadre, c = g.ctx, e = g.echelle || 1;
  for(var i = 0; i < S.pre.length; i++){
    var z = S.pre[i], col = cols[z.t];
    var x0 = g.x(S.idx[z.a]), y1 = g.y(z.niv), y2 = g.y(z.niv + (z.up ? -1 : 1) * P.preZ * S.tick);
    if(c){
      c.save();
      c.fillStyle = col;
      c.globalAlpha = 0.12;
      c.fillRect(x0, Math.min(y1, y2), F.droite - x0, Math.abs(y2 - y1));
      c.globalAlpha = 0.7;
      c.strokeStyle = col;
      c.lineWidth = 1 * e;
      if(c.setLineDash) c.setLineDash([3 * e, 3 * e]);
      c.beginPath();
      c.moveTo(x0, y1);
      c.lineTo(F.droite, y1);
      c.stroke();
      c.restore();
    }
    if(r.etiq) label(g, F.droite - 6 * e, y1 + (z.up ? -8 : 8) * e, z.t + ' ' + tr('pré-tir'), col, r.fsize, r.gras, 'right');
  }
}

HFQExt.etude({
  id:'cvddiv-prix',
  nom:'Divergences CVD · prix',
  famille:'Flux',
  desc:DESC_PRIX,
  graphes:['bougies','footprint'],
  reglages:PARTAGES.concat(POINT, TEXTE, ALERTES),
  dessine:function(g, r){
    var S = calcCache(g, r);
    if(!S) return;
    if(!S.aDelta){
      g.texte(g.cadre.gauche + 8, g.cadre.haut + 14,
        tr('Divergences CVD : ce graphe ne sert aucun delta par barre'),
        {taille:11, align:'left', couleur:'#e0567f'});
      return;
    }
    dessinerPreTir(g, S, r, r);
    dessinerSignaux(g, S, r, r, function(s){
      return [[g.x(S.idx[s.a]), g.y(s.pa)], [g.x(S.idx[s.b]), g.y(s.pb)]];
    }, function(x, y, up, col, plein){
      return point(g, x, y, up, col, plein, r.pointR, r.point);
    });
    notifier(g, S, r, r);
  }
});

HFQExt.etude({
  id:'cvddiv-cvd',
  nom:'Divergences CVD · volet CVD',
  famille:'Flux',
  desc:DESC_CVD,
  graphes:['bougies','footprint'],
  sousGraphe:{hauteur:0.24, auto:true, lignes:[[0,'#555']]},
  reglages:[
    {k:'style',label:'Style du CVD',type:'select',defaut:'bougies',options:[['bougies','Chandeliers'],['ligne','Ligne']]},
    {k:'meches',label:'Mèches (tape de la séance)',type:'check',defaut:true},
    {k:'ordo',label:'Axe des ordonnées',type:'check',defaut:true},
    {k:'ordoCote',label:'Côté de l\'axe',type:'select',defaut:'droite',options:[['droite','Droite'],['gauche','Gauche']]},
    {k:'axe0',label:'Axe zéro',type:'check',defaut:true},
    {k:'axeEt',label:'Étiquette zéro',type:'check',defaut:true},
    {k:'caxe',label:'Couleur des axes',type:'color',defaut:'#6b7280'},
    {k:'cup',label:'Bougie CVD haussière',type:'color',defaut:'#19d67a'},
    {k:'cdn',label:'Bougie CVD baissière',type:'color',defaut:'#e0567f'},
    {k:'ccvd',label:'Ligne CVD',type:'color',defaut:'#8b7bff'}
  ].concat(TRIANGLE, TEXTE),
  dessine:function(g, r){
    var t0 = maintenant(), P = partages();
    var S = calcCache(g, P);
    if(!S) return;
    if(!S.aDelta){
      g.texte(g.cadre.gauche + 8, g.cadre.haut + 14,
        tr('CVD : aucun delta par barre sur ce graphe'),
        {taille:11, align:'left', couleur:'#e0567f'});
      return;
    }
    var e = g.echelle || 1, c = g.ctx, i, F = g.cadre;

    if(r.ordo && c){
      var xa = (r.ordoCote === 'gauche') ? F.gauche : F.droite;
      c.save();
      c.strokeStyle = r.caxe;
      c.lineWidth = 1 * e;
      c.beginPath();
      c.moveTo(xa, F.haut);
      c.lineTo(xa, F.bas);
      c.stroke();
      c.restore();
    }

    if(r.axe0 && c){
      var y0 = g.y(0);
      if(y0 >= F.haut && y0 <= F.bas){
        c.save();
        c.strokeStyle = r.caxe;
        c.lineWidth = 1 * e;
        if(c.setLineDash) c.setLineDash([4 * e, 4 * e]);
        c.beginPath();
        c.moveTo(F.gauche, y0);
        c.lineTo(F.droite, y0);
        c.stroke();
        c.restore();
        if(r.axeEt){
          label(g, F.gauche + 6 * e, y0 - 7 * e, '0', r.caxe,
                Math.max(8, r.fsize - 2), false, 'left');
        }
      }
    }

    // Seules les barres visibles passent par g.y : l'amorce hors ecran n'ecrase pas l'echelle.
    var d0 = 0, v0 = vue(g)[0];
    while(d0 < S.idx.length && S.idx[d0] < v0) d0++;

    if(r.style === 'bougies' && c){
      var pas = (S.idx.length > 1) ? Math.abs(g.x(S.idx[1]) - g.x(S.idx[0])) : 4 * e;
      var w = Math.max(1, pas * 0.62), lw = Math.max(1, e);
      // Un seul remplissage par couleur : un fillRect par bougie et par meche
      // depassait le budget de TT des quelques milliers de barres visibles.
      var M = r.meches ? meches(g, S, d0, t0) : {}, Q = {haut:[], bas:[]};
      for(i = d0; i < S.idx.length; i++){
        var ouv = (i > 0 && S.sk[i] === S.sk[i-1]) ? S.cv[i-1] : S.cv[i] - S.dl[i];
        var clo = S.cv[i], x = g.x(S.idx[i]);
        var y1 = g.y(ouv), y2 = g.y(clo);
        var hb = Math.abs(y2 - y1);
        if(hb < 1) hb = 1;
        var R = (clo >= ouv) ? Q.haut : Q.bas;
        if(M[i]){
          var yh = g.y(ouv + M[i].h), yl = g.y(ouv + M[i].l);
          R.push(x - lw / 2, Math.min(yh, yl), lw, Math.abs(yl - yh));
        }
        R.push(x - w / 2, Math.min(y1, y2), w, hb);
      }
      c.save();
      [[Q.haut, r.cup], [Q.bas, r.cdn]].forEach(function(q){
        c.fillStyle = q[1]; c.beginPath();
        for(var k = 0; k < q[0].length; k += 4) c.rect(q[0][k], q[0][k + 1], q[0][k + 2], q[0][k + 3]);
        c.fill();
      });
      c.restore();
    } else {
      var pts = [];
      for(i = d0; i < S.idx.length; i++){
        if(i > 0 && S.sk[i] !== S.sk[i-1]) pts.push([NaN, NaN]);
        pts.push([g.x(S.idx[i]), g.y(S.cv[i])]);
      }
      g.trait(pts, {couleur:r.ccvd, epaisseur:1.4});
    }

    dessinerSignaux(g, S, P, r, function(s){
      return [[g.x(S.idx[s.qa]), g.y(S.cv[s.qa])], [g.x(S.idx[s.qb]), g.y(S.cv[s.qb])]];
    }, function(x, y, up, col, plein){
      return triangle(g, x, y, up, col, plein, r.triT, r.triOff, r.tri);
    });
  }
});

})();
