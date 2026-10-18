// Profil de volume de la seance, de la semaine ISO ou du mois en cours : le
// volume echange a chaque prix (bid + ask des niveaux de chaque barre),
// dessine en histogramme colle au bord droit du graphe, avec le POC et
// l'aire de valeur (VAH, VAL) prolonges depuis le debut de la periode.
//
// La periode en cours est celle de la derniere barre. Le volume vient
// uniquement des niveaux des barres : une barre sans niveaux ne compte pas,
// et la legende dit quelle part des barres en manque.
(function(){

// ponytail: minutes de seance de RTH (09:30 a 16:00 ET) sur un graphe ETH ouvert a 18:00 ET (ES, NQ).
var RTH = [930, 1320];
// ponytail: hauteur mini d'une rangee en mode auto ; les ticks se regroupent au zoom arriere.
var RANGEE_PX = 3;
// ponytail: budget du premier calcul par image ; les seances closes qui restent se lisent aux images suivantes.
var BUDGET_MS = 4;
var ETAT = {sig:'', n:0, J:[], prev:null, H:{}, somme:{cle:'', S:null}}, CACHE = {cle:'', R:null};
var NOM = {jour:'Séance', sem:'Semaine', mois:'Mois'};

// Anglais : nom, description, reglages, options et textes du canevas.
var DESC = 'Profil de volume de la séance, de la semaine ou du mois en cours, collé au bord droit du graphe, avec POC, VAH et VAL.';
var DESC_EN = 'Volume profile of the current session, week or month, pinned to the right edge of the chart, with POC, VAH and VAL.';
var EN = {
  'Profil de volume par période':'Period Volume Profile', 'Value Area %':'Value Area %',
  'Calcul sur RTH seul (graphe ETH)':'Computed on RTH only (ETH chart)',
  'Largeur (% du graphe)':'Width (% of chart)', 'Ticks par rangée (0 = auto)':'Ticks per row (0 = auto)',
  'Couleur du volume':'Volume color', 'POC, VAH et VAL prolongés':'Extended POC, VAH and VAL',
  'partiel, depuis le':'partial, since', 'des barres sans niveaux':'of bars without levels',
  'Profil de période : barres sans date, profil de séance seulement':'Period profile: undated bars, session profile only',
  'Profil de période : aucune barre de la période ne porte de niveaux':'Period profile: no bar of the period carries levels'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/profil_periode.js)'] = DESC_EN + ' (extensions/profil_periode.js)';

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
function maintenant(){ return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now(); }
function redessiner(){
  try{ if(typeof setTimeout !== 'undefined' && HFQExt.redessiner) setTimeout(function(){ HFQExt.redessiner(); }, 0); }catch(_){}
}

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

// Seances du graphe, barre de debut et de fin. Incremental : si le graphe a
// seulement grandi, seules les nouvelles barres sont lues ; s'il a raccourci
// (replay ramene en arriere), les seances au-dela de sa fin sont coupees.
// La lecture s'arrete passee l'echeance `fin` et reprend a l'appel suivant.
function seances(S, g, fin){
  var n = g.n | 0, b0 = n ? g.barre(0) : null, b, c;
  var sig = [g.sym, g.tf, g.seance, g.tick, b0 ? (b0._date || '') + ':' + b0.m : ''].join('|');
  if(sig !== S.sig){ S.sig = sig; S.n = 0; S.J = []; S.prev = null; S.H = {}; S.somme = {cle:'', S:null}; }
  var J = S.J;
  if(n < S.n){
    while(J.length && J[J.length - 1].deb >= n) J.pop();
    if(J.length) J[J.length - 1].fin = n - 1;
    for(c in S.H) if(+c.split(':')[0] >= J.length - 1) delete S.H[c];
    S.n = n; S.prev = n ? g.barre(n - 1) : null; S.somme = {cle:'', S:null};
  }
  var prev = S.prev;
  for(var i = S.n; i < n; i++){
    if(!(i & 2047) && i > S.n && maintenant() > fin) break;
    b = g.barre(i);
    if(!b) continue;
    if(!prev || (b._date != null ? b._date !== prev._date : +b.m < +prev.m)) J.push({date:b._date ? String(b._date).slice(0, 10) : '', deb:i, fin:i});
    J[J.length - 1].fin = i;
    prev = b;
  }
  S.n = i; S.prev = prev;
  return J;
}

// Volume par tick des barres deb..fin, cle = prix / tick arrondi. Une Map :
// des cles entieres vers 28 000 et eparses rendent un objet deux fois plus lent.
function histo(g, deb, fin, rth){
  var h = new Map(), t = g.tick || 0.25, sans = 0, nb = 0;
  for(var i = deb; i <= fin; i++){
    var b = g.barre(i);
    if(!b || b._trou || (rth && (+b.m < RTH[0] || +b.m >= RTH[1]))) continue;
    nb++;
    var L = g.niveaux(i);
    if(!L.n){ sans++; continue; }
    for(var k = 0; k < L.n; k++){
      var v = L.bid(k) + L.ask(k);
      if(v > 0){ var p = Math.round(L.prix(k) / t); h.set(p, (h.get(p) || 0) + v); }
    }
  }
  return {h:h, sans:sans, nb:nb};
}

function ajoute(A, B){
  B.h.forEach(function(v, p){ A.h.set(p, (A.h.get(p) || 0) + v); });
  A.sans += B.sans; A.nb += B.nb;
  return A;
}

// POC et aire de valeur sur un histogramme par tick : depuis le POC, on
// ajoute le tick voisin le plus fourni jusqu'a couvrir la part demandee.
// Ex aequo comme TT (hfq-va.js) : le POC le plus bas, puis le cote haut.
function zoneValeur(h, part){
  var T = [], total = 0;
  h.forEach(function(v, p){ T.push(p); total += v; });
  if(!T.length) return null;
  T.sort(function(a, b){ return a - b; });
  var ip = 0;
  for(var k = 1; k < T.length; k++) if(h.get(T[k]) > h.get(T[ip])) ip = k;
  var a = ip, z = ip, acc = h.get(T[ip]), cible = part * total;
  while(acc < cible && (a > 0 || z < T.length - 1)){
    var vb = a > 0 ? h.get(T[a - 1]) : -1, vh = z < T.length - 1 ? h.get(T[z + 1]) : -1;
    if(vh >= vb){ z++; acc += h.get(T[z]); } else { a--; acc += h.get(T[a]); }
  }
  return {ticks:T, total:total, poc:T[ip], vah:T[z], val:T[a]};
}

// Profil de la periode en cours. Les seances closes de la periode se
// calculent une fois, au plus BUDGET_MS par image (rien n'est dessine avant
// la fin) ; la seance ouverte se relit quand la derniere barre bouge.
function calcul(g, r){
  var t0 = maintenant(), J = seances(ETAT, g, t0 + BUDGET_MS), n = g.n | 0;
  if(ETAT.n < n){ redessiner(); return null; }
  if(!J.length) return null;
  var T = r.periode, der = J.length - 1, d = J[der].date;
  if(T !== 'jour' && !d) return {raison:'Profil de période : barres sans date, profil de séance seulement'};
  var cleDe = T === 'sem' ? semaine : T === 'mois' ? mois : null, k0 = der;
  if(cleDe) while(k0 > 0 && J[k0 - 1].date && cleDe(J[k0 - 1].date) === cleDe(d)) k0--;
  var rth = !!r.rth && g.seance === 'eth', last = g.barre(n - 1), L = g.niveaux(n - 1);
  var cle = [ETAT.sig, n, k0, rth, r.vaPct, last && last.c, last && last.h, last && last.l, L.n, L.volume()].join('|');
  if(cle === CACHE.cle) return CACHE.R;

  var cs = [k0, der, rth].join('|');
  if(ETAT.somme.cle !== cs){
    var S = {h:new Map(), sans:0, nb:0}, k;
    for(k = k0; k < der; k++){
      if(ETAT.H[k + ':' + rth]) continue;
      if(maintenant() - t0 > BUDGET_MS){ redessiner(); return null; }
      ETAT.H[k + ':' + rth] = histo(g, J[k].deb, J[k].fin, rth);
    }
    for(k = k0; k < der; k++) ajoute(S, ETAT.H[k + ':' + rth]);
    ETAT.somme = {cle:cs, S:S};
  }
  var tot = ajoute(ajoute({h:new Map(), sans:0, nb:0}, ETAT.somme.S), histo(g, J[der].deb, J[der].fin, rth));
  var Z = zoneValeur(tot.h, r.vaPct / 100), R;
  if(!Z) R = {raison:'Profil de période : aucune barre de la période ne porte de niveaux'};
  else R = {deb:J[k0].deb, vol:tot.h, ticks:Z.ticks, total:Z.total, poc:Z.poc, vah:Z.vah, val:Z.val, sans:tot.sans, nb:tot.nb,
            nom:NOM[T], cle:T === 'jour' ? d : T === 'sem' ? semaine(d).slice(5) : mois(d),
            // La periode n'est entiere que si le graphe la charge depuis son premier jour ouvre.
            partiel:T !== 'jour' && k0 === 0 && !premierOuvre(T, J[0].date) ? J[0].date : null};
  CACHE.cle = cle; CACHE.R = R;
  return R;
}

var def = {
  id:'profil-periode',
  nom:'Profil de volume par période',
  famille:'Profil',
  desc:DESC,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'periode', label:'Période', type:'select', defaut:'jour', options:[['jour','Jour'],['sem','Semaine'],['mois','Mois']]},
    {k:'rth', label:'Calcul sur RTH seul (graphe ETH)', type:'check', defaut:false},
    {k:'vaPct', label:'Value Area %', type:'number', defaut:70, min:50, max:95, pas:1},
    {k:'largeur', label:'Largeur (% du graphe)', type:'number', defaut:25, min:5, max:60, pas:1},
    {k:'rangee', label:'Ticks par rangée (0 = auto)', type:'number', defaut:0, min:0, max:100, pas:1},
    {k:'opac', label:'Opacité', type:'number', defaut:0.5, min:0.05, max:1, pas:0.05},
    {k:'couleur', label:'Couleur du volume', type:'color', defaut:'#6b7785'},
    {k:'couleurVA', label:'Couleur Value Area', type:'color', defaut:'#3d8bd4'},
    {k:'pocC', label:'Couleur POC', type:'color', defaut:'#ffb347'},
    {k:'niveaux', label:'POC, VAH et VAL prolongés', type:'check', defaut:true},
    {k:'etiq', label:'Étiquettes', type:'check', defaut:true}
  ],
  calcul:calcul,
  outils:{zoneValeur:zoneValeur, premierOuvre:premierOuvre, semaine:semaine},
  dessine:function(g, r){
    var R = calcul(g, r), F = g.cadre, e = g.echelle || 1, t = g.tick || 0.25;
    if(!R) return;
    if(R.raison){ g.texte(F.gauche + 8 * e, F.haut + 14 * e, tr(R.raison), {couleur:'#8a929c', taille:10}); return; }

    // Rangees de `pas` ticks, alignees sur des multiples de `pas` pour ne pas
    // bouger au defilement ; la plus fournie prend toute la largeur.
    var hTick = Math.abs(g.y(R.poc * t) - g.y((R.poc + 1) * t));
    var pas = r.rangee >= 1 ? r.rangee | 0 : Math.max(1, Math.ceil(RANGEE_PX * e / Math.max(hTick, 1e-9)));
    var rows = {}, max = 0, q, k;
    for(k = 0; k < R.ticks.length; k++){
      q = Math.floor(R.ticks[k] / pas);
      if((rows[q] = (rows[q] || 0) + R.vol.get(R.ticks[k])) > max) max = rows[q];
    }
    var W = F.largeur * r.largeur / 100, c = g.ctx;
    c.globalAlpha = r.opac;
    for(q in rows){
      var i0 = +q * pas, i1 = i0 + pas - 1, ya = g.y((i1 + 0.5) * t), yb = g.y((i0 - 0.5) * t);
      var y0 = Math.min(ya, yb), h = Math.abs(yb - ya);
      if(y0 > F.bas || y0 + h < F.haut) continue;
      if(h > 3 * e){ y0 += 0.5 * e; h -= e; }
      var w = W * rows[q] / max;
      c.fillStyle = R.poc >= i0 && R.poc <= i1 ? r.pocC : i1 >= R.val && i0 <= R.vah ? r.couleurVA : r.couleur;
      c.fillRect(F.droite - w, y0, w, h);
    }
    c.globalAlpha = 1;

    var x0 = R.deb >= g.premiere ? g.x(R.deb) : F.gauche;
    var niv = [['POC', R.poc, r.pocC], ['VAH', R.vah, r.couleurVA], ['VAL', R.val, r.couleurVA]];
    for(k = 0; k < niv.length; k++){
      var y = g.y(niv[k][1] * t);
      if(r.niveaux) g.trait([[x0, y], [F.droite, y]], {couleur:niv[k][2], epaisseur:k ? 1 : 1.5, pointille:k ? [4, 3] : null, opacite:0.9});
      if(r.etiq) g.texte(F.droite - W - 4 * e, y, niv[k][0], {couleur:niv[k][2], taille:10, align:'right'});
    }
    // Les mises en garde s'affichent meme sans etiquettes.
    if(!r.etiq && !R.partiel && !R.sans) return;
    var titre = tr(R.nom) + (R.cle ? ' ' + R.cle : '');
    if(R.partiel) titre += ' · ' + tr('partiel, depuis le') + ' ' + R.partiel;
    if(R.sans) titre += ' · ' + Math.round(100 * R.sans / R.nb) + ' % ' + tr('des barres sans niveaux');
    g.texte(F.droite - 4 * e, F.haut + 12 * e, titre, {couleur:'#8a929c', taille:10, align:'right'});
  }
};

HFQExt.etude(def);

})();
