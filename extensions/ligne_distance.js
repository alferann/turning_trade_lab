// Ligne a distance du prix : un trait horizontal a une distance choisie du
// dernier prix (cloture de la barre en cours), en ticks ou en points,
// au-dessus, en dessous ou les deux. Le trait part du bord droit et va vers
// la gauche jusqu'a la bougie visible la plus recente qui le touche, meche
// comprise et bougie en cours comprise ; sans contact a l'ecran, il bute sur
// le bord gauche. Le prix du niveau reste ecrit dans tous les cas.
(function(){

var POINTILLE = {plein:null, tirets:[6,4], points:[2,3]};

// Anglais : nom, description, reglages et options tels que le panneau les affiche.
var DESC = 'Un trait horizontal à une distance choisie du dernier prix, en ticks ou en points, au-dessus, en dessous ou les deux, tiré du bord droit jusqu\'à la bougie visible la plus récente qui le touche, mèche comprise.';
var DESC_EN = 'A horizontal line at a chosen distance from the last price, in ticks or points, above, below or both, drawn from the right edge to the most recent visible candle that touches it, wick included.';
var EN = {
  'Ligne à distance du prix':'Price Offset Line', 'Unité':'Unit', 'En ticks':'In ticks', 'En points':'In points',
  'Au-dessus du prix':'Above price', 'Distance au-dessus':'Distance above', 'Couleur au-dessus':'Color above',
  'En dessous du prix':'Below price', 'Distance en dessous':'Distance below', 'Couleur en dessous':'Color below',
  'Style':'Style'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/ligne_distance.js)'] = DESC_EN + ' (extensions/ligne_distance.js)';

// Le panneau d'etudes s'ouvre dans la fenetre du terminal, au-dessus des
// graphes : le dictionnaire s'enregistre dans chaque fenetre parente.
function anglais(D){
  var w = typeof window !== 'undefined' ? window : null;
  for(var n = 0; w && n < 8; n++){
    try{ if(w.HFQI18n) w.HFQI18n.dict('en', D); }catch(_){}
    try{ w = w.parent !== w ? w.parent : null; }catch(_){ w = null; }
  }
}
anglais(EN);

// Premier index de [deb, fin] dont l'abscisse atteint x, fin + 1 sinon : g.x
// croit avec l'index. Le footprint passe tout l'historique dans
// premiere..derniere, pas seulement les barres a l'ecran.
function borne(g, deb, fin, x){
  while(deb <= fin){ var m = (deb + fin) >> 1; if(g.x(m) < x) deb = m + 1; else fin = m - 1; }
  return deb;
}

// Les niveaux demandes : `s` le cote (+1 dessus, -1 dessous), `d` la distance
// saisie, `p` le prix cale sur le tick, `i` l'index de la bougie visible la
// plus recente qui le touche, -1 sans contact a l'ecran. null sans prix.
function calcul(g, r){
  var n = g.n | 0, der = n ? g.barre(n - 1) : null;
  if(!der || !isFinite(der.c)) return null;
  var tick = +g.tick || 0.25, pas = r.unite === 'points' ? 1 : tick, L = [];
  [[1, r.haut, r.hautD, r.hautC], [-1, r.bas, r.basD, r.basC]].forEach(function(c){
    var d = Math.max(0, +c[2] || 0);
    if(c[1]) L.push({s:c[0], d:d, p:Math.round((der.c + c[0] * d * pas) / tick) * tick, i:-1, col:c[3]});
  });
  // Bougies a l'ecran seulement : un contact hors cadre a gauche se dessine comme l'absence de contact.
  var deb = Math.max(0, g.premiere | 0), fin = Math.min(g.derniere | 0, n - 1);
  deb = Math.max(deb, borne(g, deb, fin, g.cadre.gauche));
  fin = Math.min(fin, borne(g, deb, fin, g.cadre.droite + 1e-6) - 1);
  // ponytail: balayage des barres a l'ecran a chaque image, 2 ms au pire pour 60 000 barres sans contact ; a memoriser par (n, prix, vue) si la mesure le demande.
  // Un quart de tick de marge : les prix sont sur la grille, pas les flottants.
  var reste = L.length, eps = tick / 4;
  for(var i = fin; i >= deb && reste; i--){
    var b = g.barre(i);
    if(!b || b._trou) continue;
    for(var k = 0; k < L.length; k++) if(L[k].i < 0 && b.l - eps <= L[k].p && L[k].p <= b.h + eps){ L[k].i = i; reste--; }
  }
  return {c:der.c, tick:tick, L:L};
}

HFQExt.etude({
  id:'ligne-distance',
  nom:'Ligne à distance du prix',
  famille:'Prix',
  desc:DESC,
  graphes:['bougies','footprint'],

  reglages:[
    {k:'unite',  label:'Unité',               type:'select', defaut:'ticks', options:[['ticks','En ticks'],['points','En points']]},
    {k:'haut',   label:'Au-dessus du prix',   type:'check',  defaut:true},
    {k:'hautD',  label:'Distance au-dessus',  type:'number', defaut:20, min:0, pas:1},
    {k:'hautC',  label:'Couleur au-dessus',   type:'color',  defaut:'#4bd48e'},
    {k:'bas',    label:'En dessous du prix',  type:'check',  defaut:true},
    {k:'basD',   label:'Distance en dessous', type:'number', defaut:20, min:0, pas:1},
    {k:'basC',   label:'Couleur en dessous',  type:'color',  defaut:'#e0567f'},
    {k:'style',  label:'Style',               type:'select', defaut:'tirets', options:[['plein','Plein'],['tirets','Tirets'],['points','Pointillés']]},
    {k:'ep',     label:'Épaisseur',           type:'number', defaut:1, min:0.5, max:4, pas:0.5},
    {k:'op',     label:'Opacité',             type:'number', defaut:0.85, min:0.05, max:1, pas:0.05},
    {k:'etiq',   label:'Étiquette',           type:'check',  defaut:true}
  ],

  calcul:calcul,

  dessine:function(g, r){
    var R = calcul(g, r), F = g.cadre, e = g.echelle || 1;
    if(!R) return;
    var dec = (String(R.tick).split('.')[1] || '').length, u = r.unite === 'points' ? ' pt' : ' t';
    R.L.forEach(function(v){
      var y = g.y(v.p);
      if(y < F.haut || y > F.bas) return;
      g.trait([[F.droite, y], [v.i >= 0 ? g.x(v.i) : F.gauche, y]],
        {couleur:v.col, opacite:+r.op, epaisseur:+r.ep || 1, pointille:POINTILLE[r.style] || null});
      // Le prix et la distance au bout droit, du cote oppose au prix.
      if(r.etiq) g.texte(F.droite - 3 * e, y - v.s * 2 * e, v.p.toFixed(dec) + '  ' + (v.s > 0 ? '+' : '−') + v.d + u,
        {couleur:v.col, opacite:+r.op, taille:10, align:'right', base:v.s > 0 ? 'bottom' : 'top'});
    });
  }
});

})();
