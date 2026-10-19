// POC de chaque barre, trace comme un trait horizontal sur la largeur du
// corps de la bougie, a la facon de MotiveWave : le prix des niveaux de la
// barre ou bid + ask est le plus fort. Une couleur, ou deux selon le signe
// du delta de la barre.
//
// Le POC vient uniquement des niveaux : une barre sans niveaux n'a pas de
// trait.
(function(){

// ponytail: largeur du corps des bougies de TT (candles.html, max(1.2, colonne x 0.62)), a suivre si TT la change.
var CORPS = .62;

// Anglais : nom, description et reglages tels que le panneau les affiche.
var DESC = 'Le prix le plus échangé de chaque barre, en trait sur la largeur du corps de la bougie, d\'une couleur ou teinté par le delta.';
var DESC_EN = 'The most traded price of each bar, as a line across the candle body, in one color or tinted by the delta.';
var EN = {
  'POC par barre':'Bar POC', 'Teinter selon le delta':'Tint by delta',
  'Delta acheteur':'Buyer delta', 'Delta vendeur':'Seller delta'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/poc_barre.js)'] = DESC_EN + ' (extensions/poc_barre.js)';

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

// Prix du POC des niveaux d'une barre, null sans volume. Ex aequo : le prix
// le plus bas, comme le POC du SVP de TT (HFQVA), quel que soit l'ordre des
// niveaux (croissant en direct, decroissant en archive).
function poc(N){
  var p = null, max = 0;
  for(var k = 0; k < N.n; k++){
    var v = N.bid(k) + N.ask(k);
    if(v > max || (v === max && p !== null && N.prix(k) < p)){ max = v; p = N.prix(k); }
  }
  return p;
}

HFQExt.etude({
  id:'poc-barre',
  nom:'POC par barre',
  famille:'Profil',
  desc:DESC,
  graphes:['bougies'],

  reglages:[
    {k:'couleur', label:'Couleur',                type:'color',  defaut:'#f5c542'},
    {k:'epais',   label:'Épaisseur',              type:'number', defaut:2, min:1, max:6, pas:.5},
    {k:'delta',   label:'Teinter selon le delta', type:'check',  defaut:false},
    {k:'achat',   label:'Delta acheteur',         type:'color',  defaut:'#4bd48e'},
    {k:'vente',   label:'Delta vendeur',          type:'color',  defaut:'#e0567f'}
  ],

  dessine:function(g, r){
    // Largeur de colonne lue sur la projection, comme TT pour ses corps.
    var demi = Math.max(1.2, Math.abs(g.x(g.premiere + 1) - g.x(g.premiere)) * CORPS) / 2;
    // Tous les segments d'une couleur en un seul trace, separes par un point non fini.
    var A = [], V = [];
    for(var i = g.premiere; i <= g.derniere; i++){
      var N = g.niveaux(i);
      if(!N.n) continue;
      var p = poc(N);
      if(p == null) continue;
      var y = g.y(p);
      if(y < g.cadre.haut || y > g.cadre.bas) continue;
      var x = g.x(i);
      (r.delta && N.deltaTotal() < 0 ? V : A).push([x - demi, y], [x + demi, y], [NaN, NaN]);
    }
    g.trait(A, {couleur:r.delta ? r.achat : r.couleur, epaisseur:r.epais});
    g.trait(V, {couleur:r.vente, epaisseur:r.epais});
  }
});

})();
