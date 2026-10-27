// Confluence : des familles de niveaux calculees sur le graphe lui-meme,
// regroupees par proximite et notees. Modele : le Confluence Scanner de
// Resolve (getresolve.market), dont les regles ne sont pas publiees ; les noms
// des niveaux et les badges de score suivent ce qu'il affiche.
//
// Sources : VWAP journalier et hebdomadaire avec leurs ecarts-types ; profil
// de volume et profil TPO de la seance (sur RTH des que RTH est ouvert) ;
// profil de volume de la veille ; pivots journaliers et hebdomadaires ; haut,
// bas, cloture de la veille ; ouvertures ETH, 0h, H4, RTH ; plages overnight,
// de seance, d'ouverture et balance initiale. Deux niveaux a moins de
// `largeur` ticks tombent dans la meme zone ; le score d'une zone est son
// nombre de niveaux. Quand le prix s'en approche, la zone s'allume.
//
// Rien n'est tire de donnees manquantes : un niveau dont la fenetre n'est pas
// chargee en entier (seance prise en cours, veille tronquee ou absente,
// semaine sans son lundi, barre de comblement) n'est pas affiche.
(function(){

// ponytail: minutes de seance sur un graphe ETH ouvert a 18:00 ET (ES, NQ).
var RTH_M = 930, RTH_FIN = 1320, MINUIT_M = 360, H4_M = 240, TPO_M = 30;
// ponytail: duree de la seance du graphe en minutes, 23 h en ETH et 6 h 30 en RTH (ES, NQ).
var DUREE = {eth:1380, rth:390};
// Une fenetre est couverte si sa premiere barre tombe dans l'heure qui suit
// son debut et, close, si la derniere va jusqu'a 4 h de sa fin : une cloture
// anticipee de jour ferie passe (regle de pivots.js).
var MARGE = [60, 240];
// Fond des textes, pour qu'ils restent lisibles sur un profil de volume.
var FOND = 'rgba(12,14,20,0.82)';

var CACHE = {cleFixe:'', fixe:null, cle:'', R:null};

// Seances du graphe. Footprint : pas de _date, une seance commence quand les
// minutes repartent en arriere.
function seances(g){
  var out = [], prev = null, n = g.n | 0;
  for(var i = 0; i < n; i++){
    var b = g.barre(i);
    if(!b) continue;
    if(!prev || (b._date != null ? b._date !== prev._date : +b.m < +prev.m)){
      if(out.length) out[out.length - 1].fin = i - 1;
      out.push({cle:b._date != null ? String(b._date) : 'j' + out.length, deb:i, fin:n - 1});
    }
    prev = b;
  }
  return out;
}

// Vrai si les barres de la seance s entre les minutes a et z couvrent cette
// fenetre : la premiere dans l'heure qui suit a, aucune barre de comblement
// et, pour une fenetre close, la derniere a moins de 4 h de z.
function couvre(g, s, a, z, close){
  var m0 = null, m1 = null;
  for(var i = s.deb; i <= s.fin; i++){
    var b = g.barre(i), m = b ? +b.m : NaN;
    if(!(m >= a && m < z)) continue;
    if(b._trou) return false;
    if(m0 === null) m0 = m;
    m1 = m;
  }
  return m0 !== null && m0 <= a + MARGE[0] && (!close || m1 >= z - MARGE[1]);
}

// Date AAAA-MM-JJ en millisecondes UTC, null si la cle n'est pas une date (footprint).
function jour(cle){
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(cle);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

// Jours de semaine strictement entre deux dates : une seance manque entre elles.
// ponytail: les feries comptent ; le lendemain d'un ferie, la veille passe pour manquante, donc masquee.
function ouvresEntre(a, b){
  var d = jour(a), f = jour(b), n = 0;
  if(d === null || f === null) return 0;
  for(d += 864e5; d < f; d += 864e5) if(new Date(d).getUTCDay() % 6) n++;
  return n;
}

// Jour de la semaine (0 dimanche a 6 samedi), -1 sans date.
// ponytail: les feries sont ignores ; une semaine ouverte un mardi apres un lundi ferie passe pour incomplete.
function jourSem(cle){ var d = jour(cle); return d === null ? -1 : new Date(d).getUTCDay(); }

// Semaine ISO d'une date AAAA-MM-JJ, en cle triable ; '' si la date manque.
function semaine(cle){
  var t = jour(cle);
  if(t === null) return '';
  var d = new Date(t);
  var j = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - j);
  var an = d.getUTCFullYear();
  var num = Math.ceil(((d - Date.UTC(an, 0, 1)) / 86400000 + 1) / 7);
  return an + '-' + (num < 10 ? '0' : '') + num;
}

// Zone de valeur a 70 % autour du pic d'un histogramme {prix: poids}.
function zoneValeur(h, tick){
  var prix = [], total = 0, p;
  for(p in h){ prix.push(+p); total += h[p]; }
  if(!prix.length) return null;
  prix.sort(function(a, b){ return a - b; });
  var milieu = (prix[0] + prix[prix.length - 1]) / 2, ip = 0;
  for(var k = 1; k < prix.length; k++){
    if(h[prix[k]] > h[prix[ip]] || (h[prix[k]] === h[prix[ip]] && Math.abs(prix[k] - milieu) < Math.abs(prix[ip] - milieu))) ip = k;
  }
  var a = ip, z = ip, acc = h[prix[ip]], cible = 0.7 * total;
  while(acc < cible && (a > 0 || z < prix.length - 1)){
    var vb = a > 0 ? h[prix[a - 1]] : -1, vh = z < prix.length - 1 ? h[prix[z + 1]] : -1;
    if(vh > vb){ z++; acc += h[prix[z]]; } else { a--; acc += h[prix[a]]; }
  }
  return {poc:prix[ip], vah:prix[z], val:prix[a]};
}

// Haut, bas, ouverture, cloture et sommes du VWAP sur des barres ; avec
// `profils`, aussi le profil de volume et le profil TPO, plus couteux.
// `mMin` ne garde que les barres a partir de cette minute de seance.
function resume(g, deb, fin, mMin, tick, profils){
  var vol = {}, sv = 0, spv = 0, spv2 = 0, bv = 0, bpv = 0, bpv2 = 0;
  var perLo = {}, perHi = {}, tLo = Infinity, tHi = -Infinity;
  var hi = -Infinity, lo = Infinity, o = null, c = null, nb = 0, k, p, v;
  for(var i = deb; i <= fin; i++){
    var b = g.barre(i);
    if(!b || b._trou) continue;
    if(mMin != null && +b.m < mMin) continue;
    nb++;
    if(o === null) o = b.o;
    c = b.c;
    if(b.h > hi) hi = b.h;
    if(b.l < lo) lo = b.l;
    var L = g.niveaux(i);
    for(k = 0; k < L.n; k++){
      p = L.prix(k); v = L.bid(k) + L.ask(k);
      if(!(v > 0)) continue;
      if(profils) vol[p] = (vol[p] || 0) + v;
      sv += v; spv += p * v; spv2 += p * p * v;
    }
    var t = (b.h + b.l + b.c) / 3, w = +b.v || 0;
    bv += w; bpv += t * w; bpv2 += t * t * w;
    // TPO : une periode de 30 minutes couvre tous les ticks de sa plage haut-bas.
    if(profils){
      var per = Math.floor(+b.m / TPO_M), t0 = Math.round(b.l / tick), t1 = Math.round(b.h / tick);
      if(perLo[per] == null || t0 < perLo[per]) perLo[per] = t0;
      if(perHi[per] == null || t1 > perHi[per]) perHi[per] = t1;
      if(t0 < tLo) tLo = t0;
      if(t1 > tHi) tHi = t1;
    }
  }
  if(!nb) return null;
  var R = {n:nb, hi:hi, lo:lo, o:o, c:c, vwap:null, sd:0, vp:null, tpo:null,
           V:(sv > 0 ? sv : bv), PV:(sv > 0 ? spv : bpv), PV2:(sv > 0 ? spv2 : bpv2)};
  if(R.V > 0){ R.vwap = R.PV / R.V; R.sd = Math.sqrt(Math.max(0, R.PV2 / R.V - R.vwap * R.vwap)); }
  if(profils && sv > 0) R.vp = zoneValeur(vol, tick);
  if(profils && isFinite(tLo)){
    // Nombre de periodes par tick, par tableau de differences : O(barres + ticks).
    var diff = [], n = tHi - tLo + 2;
    for(k = 0; k < n; k++) diff.push(0);
    for(p in perLo){ diff[perLo[p] - tLo]++; diff[perHi[p] - tLo + 1]--; }
    var comptes = {}, acc = 0;
    for(k = 0; k < n - 1; k++){ acc += diff[k]; if(acc > 0) comptes[(tLo + k) * tick] = acc; }
    R.tpo = zoneValeur(comptes, tick);
  }
  return R;
}

function ajouter(out, src, nom, prix){
  if(prix != null && isFinite(prix)) out.push({src:src, nom:nom, prix:prix});
}

function pivots(out, src, prefixe, H, L, C){
  var pp = (H + L + C) / 3;
  ajouter(out, src, prefixe + 'PP', pp);
  ajouter(out, src, prefixe + 'R1', 2 * pp - L);
  ajouter(out, src, prefixe + 'S1', 2 * pp - H);
  ajouter(out, src, prefixe + 'R2', pp + (H - L));
  ajouter(out, src, prefixe + 'S2', pp - (H - L));
}

function bandes(out, src, nom, vwap, sd, n){
  ajouter(out, src, nom, vwap);
  for(var k = 1; k <= n; k++){
    ajouter(out, src, nom + '+' + k, vwap + k * sd);
    ajouter(out, src, nom + '-' + k, vwap - k * sd);
  }
}

// Ce qui ne bouge pas pendant la seance : veille, pivots, sommes de la semaine.
// La veille doit etre la seance ouvree d'avant, chargee sur toute sa fenetre ;
// une semaine doit partir du lundi, sans seance manquante ni incomplete.
function fixes(g, r, S, cur, tick){
  var out = [], eth = (g.seance === 'eth'), mV = (eth && r.pdRth) ? RTH_M : null, dur = DUREE[eth ? 'eth' : 'rth'];
  var pv = cur > 0 ? S[cur - 1] : null;
  var veille = pv && !ouvresEntre(pv.cle, S[cur].cle) && couvre(g, pv, mV || 0, mV ? RTH_FIN : dur, true)
    ? resume(g, pv.deb, pv.fin, mV, tick, !!(r.vp && r.vpVeille)) : null;
  if(veille){
    if(r.cles){
      ajouter(out, 'cles', 'PDH', veille.hi);
      ajouter(out, 'cles', 'PDL', veille.lo);
      ajouter(out, 'cles', 'PDC', veille.c);
    }
    if(r.pivJ) pivots(out, 'pivJ', '', veille.hi, veille.lo, veille.c);
    if(r.vp && r.vpVeille && veille.vp){
      ajouter(out, 'vp', 'pdPOC', veille.vp.poc);
      ajouter(out, 'vp', 'pdVAH', veille.vp.vah);
      ajouter(out, 'vp', 'pdVAL', veille.vp.val);
    }
  }
  // Semaine ISO precedente, pour les pivots ; semaine en cours, pour le VWAP hebdo.
  var semCur = semaine(S[cur].cle), hi = -Infinity, lo = Infinity, c = null, sem = '';
  var som = {V:0, PV:0, PV2:0, ok:!!semCur}, okPrec = true, apres = S[cur].cle, debut = apres, debPrec = '';
  for(var i = cur - 1; i >= 0; i--){
    var s = semaine(S[i].cle);
    if(!s) continue;
    var R = resume(g, S[i].deb, S[i].fin, null, tick, false);
    if(!R) continue;
    if(s !== semCur && sem && s !== sem) break;
    // Seance chargee en entier, sans jour ouvre manquant jusqu'a la suivante ;
    // la derniere de la semaine precedente doit etre un vendredi.
    var ok = couvre(g, S[i], 0, dur, true) && (s !== semCur && !sem ? jourSem(S[i].cle) === 5 : !ouvresEntre(S[i].cle, apres));
    apres = S[i].cle;
    if(s === semCur){ som.V += R.V; som.PV += R.PV; som.PV2 += R.PV2; som.ok = som.ok && ok; debut = apres; continue; }
    sem = s;
    debPrec = apres;
    okPrec = okPrec && ok;
    if(c === null) c = R.c;
    if(R.hi > hi) hi = R.hi;
    if(R.lo < lo) lo = R.lo;
  }
  som.ok = som.ok && jourSem(debut) === 1;
  if(r.pivH && c !== null && okPrec && jourSem(debPrec) === 1) pivots(out, 'pivH', 'w', hi, lo, c);
  return {niveaux:out, semaine:som};
}

// Niveaux de la seance en cours, recalcules a chaque tick.
function courants(g, r, S, cur, F, tick){
  var out = [], eth = (g.seance === 'eth'), m0 = eth ? RTH_M : 0, s = S[cur];
  var deb = s.deb, fin = s.fin, last = g.barre(fin);
  if(!last) return out;
  var enRth = eth && +last.m >= RTH_M, besoinP = !!(r.vp || r.tpo), surRth = !!(r.vpRth && enRth);
  // Seance chargee depuis son ouverture (plein), ou depuis 09:30 pour ce qui ne regarde que RTH.
  var plein = couvre(g, s, 0, Infinity), rth = surRth && couvre(g, s, RTH_M, Infinity);
  var R = resume(g, deb, fin, null, tick, besoinP && !surRth && plein);
  if(!R) return out;
  var P = !besoinP ? null : surRth ? (rth ? resume(g, deb, fin, RTH_M, tick, true) : null) : plein ? R : null, px = surRth ? 'RTH' : '';
  if(r.vwap && plein && R.vwap != null) bandes(out, 'vwap', 'DVWAP', R.vwap, R.sd, r.sigmas);
  if(r.vwapH && plein && F.semaine.ok){
    var V = F.semaine.V + R.V, PV = F.semaine.PV + R.PV, PV2 = F.semaine.PV2 + R.PV2;
    if(V > 0){ var wv = PV / V; bandes(out, 'vwap', 'wVWAP', wv, Math.sqrt(Math.max(0, PV2 / V - wv * wv)), r.sigmas); }
  }
  if(r.vp && P && P.vp){
    ajouter(out, 'vp', px + 'POC', P.vp.poc);
    ajouter(out, 'vp', px + 'VAH', P.vp.vah);
    ajouter(out, 'vp', px + 'VAL', P.vp.val);
  }
  if(r.tpo && P && P.tpo){
    ajouter(out, 'tpo', 'TPOC', P.tpo.poc);
    ajouter(out, 'tpo', 'TVAH', P.tpo.vah);
    ajouter(out, 'tpo', 'TVAL', P.tpo.val);
  }
  if(r.plages && plein){ ajouter(out, 'plages', 'HOD', R.hi); ajouter(out, 'plages', 'LOD', R.lo); }
  // Ouvertures : ETH, 0h, H4 et RTH ; overnight avant 09:30. Une ouverture
  // n'est prise que si la premiere barre de sa fenetre tombe dans l'heure.
  var h4 = Math.floor(+last.m / H4_M) * H4_M, oH4 = null, o0h = null, oRth = null, on = null;
  var ouv = function(b, a){ return !b._trou && +b.m < a + MARGE[0] ? b.o : NaN; };
  for(var i = deb; i <= fin; i++){
    var b = g.barre(i);
    if(!b) continue;
    var m = +b.m;
    if(oH4 === null && m >= h4) oH4 = ouv(b, h4);
    if(eth){
      if(o0h === null && m >= MINUIT_M) o0h = ouv(b, MINUIT_M);
      if(m >= RTH_M && oRth === null) oRth = ouv(b, RTH_M);
      if(m < RTH_M && !b._trou){ if(!on) on = {hi:b.h, lo:b.l}; else { if(b.h > on.hi) on.hi = b.h; if(b.l < on.lo) on.lo = b.l; } }
    }
  }
  if(r.cles){
    ajouter(out, 'cles', eth ? 'OpenETH' : 'OpenRTH', plein ? R.o : null);
    if(eth){ ajouter(out, 'cles', 'Open0h', o0h); ajouter(out, 'cles', 'OpenRTH', oRth); }
    ajouter(out, 'cles', 'OpenH4', oH4);
  }
  if(r.plages && on && couvre(g, s, 0, RTH_M)){ ajouter(out, 'plages', 'ONH', on.hi); ajouter(out, 'plages', 'ONL', on.lo); }
  var plages = [[r.orMin, 'OR'], [r.ibMin, 'IB']];
  for(var k = 0; k < plages.length; k++){
    var duree = +plages[k][0];
    if(!(duree > 0)) continue;
    var hi = -Infinity, lo = Infinity;
    for(i = deb; i <= fin; i++){
      b = g.barre(i);
      if(!b || b._trou || +b.m < m0 || +b.m >= m0 + duree) continue;
      if(b.h > hi) hi = b.h;
      if(b.l < lo) lo = b.l;
    }
    if(isFinite(hi) && couvre(g, s, m0, m0 + duree)){ ajouter(out, 'or', plages[k][1] + 'H', hi); ajouter(out, 'or', plages[k][1] + 'L', lo); }
  }
  return out;
}

// Zones : niveaux tries, un niveau rejoint la zone si le precedent est a moins
// de `largeur` et que la zone ne depasse pas deux largeurs.
function zones(niveaux, largeur){
  niveaux.sort(function(a, b){ return a.prix - b.prix; });
  var out = [], z = null;
  for(var i = 0; i < niveaux.length; i++){
    var l = niveaux[i];
    if(z && l.prix - z.haut <= largeur && l.prix - z.bas <= 2 * largeur){ z.haut = l.prix; z.items.push(l); }
    else { z = {bas:l.prix, haut:l.prix, items:[l]}; out.push(z); }
  }
  for(i = 0; i < out.length; i++) out[i].score = out[i].items.length;
  return out;
}

var DETECTION = ['largeur', 'sigmas', 'vwap', 'vwapH', 'vp', 'vpVeille', 'vpRth', 'tpo', 'pivJ', 'pivH', 'cles', 'plages', 'orMin', 'ibMin', 'pdRth'];

function calc(g, r){
  var n = g.n | 0;
  if(n < 2) return null;
  var last = g.barre(n - 1);
  if(!last) return null;
  var tick = g.tick || 0.25;
  var cle = [g.sym, g.tf, g.seance, n, last.c, last.h, last.l, g.niveaux(n - 1).n].concat(DETECTION.map(function(k){ return r[k]; })).join('|');
  if(cle === CACHE.cle) return CACHE.R;
  var S = seances(g), cur = S.length - 1;
  if(cur < 0) return null;
  var cleFixe = [g.sym, g.tf, g.seance, S[cur].cle, S[cur].deb, cur, r.pdRth, r.pivJ, r.pivH, r.cles, r.vp, r.vpVeille].join('|');
  if(cleFixe !== CACHE.cleFixe){ CACHE.cleFixe = cleFixe; CACHE.fixe = fixes(g, r, S, cur, tick); }
  var niveaux = CACHE.fixe.niveaux.concat(courants(g, r, S, cur, CACHE.fixe, tick));
  var R = {niveaux:niveaux, zones:zones(niveaux, r.largeur * tick), tick:tick, prix:(g.prixCourant != null ? g.prixCourant : last.c)};
  CACHE.cle = cle; CACHE.R = R;
  return R;
}

// Texte, sur un fond si `fond` est donne.
function texte(g, x, y, s, col, taille, gras, align, fond){
  var e = g.echelle || 1, c = g.ctx;
  c.save();
  c.font = (gras ? 'bold ' : '') + Math.round(taille * e) + 'px system-ui, -apple-system, Segoe UI, sans-serif';
  c.textAlign = align;
  c.textBaseline = 'middle';
  var w = c.measureText(s).width;
  if(fond){
    c.fillStyle = fond;
    c.fillRect((align === 'right' ? x - w : align === 'center' ? x - w / 2 : x) - 2 * e, y - (taille / 2 + 2) * e, w + 4 * e, (taille + 4) * e);
  }
  c.fillStyle = col;
  c.fillText(s, x, y);
  c.restore();
  return w;
}

// Les etudes se dessinent dans l'ordre de leurs fichiers, et un fichier
// enregistre dans l'Editeur d'etudes passe en dernier : un profil de volume
// dessine apres celle-ci couvrait les badges. Textes et badges se dessinent
// donc une fois l'image de la page finie, par-dessus toutes les etudes, avec
// la transformation et le cadre de l'image.
// ponytail: microtache apres le dessin de la page ; si HFQExt gagne un ordre de dessin, s'en servir.
var DEVANT = null;
function devant(g, L){
  var attendu = !DEVANT;
  DEVANT = {c:g.ctx, T:g.ctx.getTransform(), F:g.cadre, L:L};
  if(attendu) Promise.resolve().then(function(){
    var D = DEVANT, c = D.c, F = D.F;
    DEVANT = null;
    c.save();
    try{
      c.setTransform(D.T);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      c.setLineDash([]);
      c.beginPath();
      c.rect(F.gauche, F.haut, F.droite - F.gauche, F.bas - F.haut);
      c.clip();
      for(var i = 0; i < D.L.length; i++) D.L[i][0].apply(null, D.L[i].slice(1));
    }catch(x){ console.error('[confluence] textes :', x); }
    c.restore();
  });
}

// Badge a la Resolve : la note dans une case pleine, les noms a sa droite sur
// fond sombre, le tout cale au bord droit du graphe.
function badge(g, y, score, noms, col, taille){
  var e = g.echelle || 1, c = g.ctx, F = g.cadre, h = (taille + 8) * e, pad = 5 * e;
  c.save();
  c.font = Math.round(taille * e) + 'px system-ui, -apple-system, Segoe UI, sans-serif';
  var wn = c.measureText(noms).width + 2 * pad;
  c.font = 'bold ' + Math.round(taille * e) + 'px system-ui, -apple-system, Segoe UI, sans-serif';
  var ws = c.measureText(String(score)).width + 2 * pad;
  c.restore();
  var x1 = F.droite - 10 * e, x0 = x1 - wn - ws, yt = y - h / 2;
  c.save();
  c.fillStyle = col;
  c.fillRect(x0, yt, ws, h);
  c.fillStyle = FOND;
  c.fillRect(x0 + ws, yt, wn, h);
  c.strokeStyle = col;
  c.lineWidth = 1 * e;
  c.strokeRect(x0 + ws, yt, wn, h);
  c.restore();
  texte(g, x0 + ws / 2, y, String(score), '#ffffff', taille, true, 'center');
  texte(g, x0 + ws + pad, y, noms, col, taille, false, 'left');
}

// Anglais : description, reglages et options tels que le panneau les affiche.
var DESC = 'VWAP, profils de volume et TPO, pivots, ouvertures, plages : regroupés par proximité et notés. Les zones s\'allument quand le prix approche.';
var DESC_EN = 'VWAP, volume and TPO profiles, pivots, opens, ranges: grouped by proximity and scored. Zones light up as price approaches.';
var EN = {
  'Largeur de regroupement (ticks)':'Grouping width (ticks)', 'Score mini d\'une zone':'Minimum zone score', 'Distance de proximité (ticks)':'Proximity distance (ticks)',
  'VWAP journalier (DVWAP)':'Daily VWAP (DVWAP)', 'VWAP hebdomadaire (wVWAP)':'Weekly VWAP (wVWAP)', 'Bandes VWAP (0 à 2 écarts-types)':'VWAP bands (0 to 2 std devs)',
  'Profil de volume (POC, VAH, VAL)':'Volume profile (POC, VAH, VAL)', 'Profil de volume de la veille':'Previous session volume profile',
  'Profil TPO (TPOC, TVAH, TVAL)':'TPO profile (TPOC, TVAH, TVAL)', 'Profils sur RTH dès 09:30 (graphe ETH)':'Profiles on RTH from 09:30 (ETH chart)',
  'Pivots journaliers':'Daily pivots', 'Pivots hebdomadaires':'Weekly pivots', 'Niveaux clés : veille et ouvertures':'Key levels: previous session and opens',
  'Plages : overnight et séance':'Ranges: overnight and session', 'Plage d\'ouverture (min, 0 = off)':'Opening range (min, 0 = off)',
  'Balance initiale (min, 0 = off)':'Initial balance (min, 0 = off)', 'Veille sur RTH seul (graphe ETH)':'Previous session on RTH only (ETH chart)',
  'Niveaux isolés en trait fin':'Isolated levels as thin lines', 'Badges de score':'Score badges', 'Taille du texte':'Text size', 'Opacité de base':'Base opacity',
  'Couleur score 2':'Score 2 color', 'Couleur score 3':'Score 3 color', 'Couleur score 4 et plus':'Score 4+ color', 'Couleur à l\'approche':'Approach color'
};
EN[DESC] = DESC_EN;
EN[DESC + ' (extensions/confluence.js)'] = DESC_EN + ' (extensions/confluence.js)';

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

var def = {
  id:'confluence',
  nom:'Confluence Scanner',
  famille:'Zones',
  desc:DESC,
  graphes:['bougies','footprint'],
  reglages:[
    {k:'largeur',label:'Largeur de regroupement (ticks)',type:'number',defaut:6,min:1,max:200,pas:1},
    {k:'minScore',label:'Score mini d\'une zone',type:'number',defaut:2,min:1,max:12,pas:1},
    {k:'prox',label:'Distance de proximité (ticks)',type:'number',defaut:8,min:1,max:200,pas:1},
    {k:'vwap',label:'VWAP journalier (DVWAP)',type:'check',defaut:true},
    {k:'vwapH',label:'VWAP hebdomadaire (wVWAP)',type:'check',defaut:true},
    {k:'sigmas',label:'Bandes VWAP (0 à 2 écarts-types)',type:'number',defaut:2,min:0,max:2,pas:1},
    {k:'vp',label:'Profil de volume (POC, VAH, VAL)',type:'check',defaut:true},
    {k:'vpVeille',label:'Profil de volume de la veille',type:'check',defaut:true},
    {k:'tpo',label:'Profil TPO (TPOC, TVAH, TVAL)',type:'check',defaut:true},
    {k:'vpRth',label:'Profils sur RTH dès 09:30 (graphe ETH)',type:'check',defaut:true},
    {k:'pivJ',label:'Pivots journaliers',type:'check',defaut:true},
    {k:'pivH',label:'Pivots hebdomadaires',type:'check',defaut:true},
    {k:'cles',label:'Niveaux clés : veille et ouvertures',type:'check',defaut:true},
    {k:'plages',label:'Plages : overnight et séance',type:'check',defaut:true},
    {k:'orMin',label:'Plage d\'ouverture (min, 0 = off)',type:'number',defaut:15,min:0,max:240,pas:5},
    {k:'ibMin',label:'Balance initiale (min, 0 = off)',type:'number',defaut:60,min:0,max:240,pas:5},
    {k:'pdRth',label:'Veille sur RTH seul (graphe ETH)',type:'check',defaut:true},
    {k:'voirSeuls',label:'Niveaux isolés en trait fin',type:'check',defaut:true},
    {k:'etiq',label:'Badges de score',type:'check',defaut:true},
    {k:'fsize',label:'Taille du texte',type:'number',defaut:10,min:6,max:20,pas:1},
    {k:'opac',label:'Opacité de base',type:'number',defaut:0.08,min:0.02,max:0.5,pas:0.02},
    {k:'c2',label:'Couleur score 2',type:'color',defaut:'#8a929c'},
    {k:'c3',label:'Couleur score 3',type:'color',defaut:'#3b82f6'},
    {k:'c4',label:'Couleur score 4 et plus',type:'color',defaut:'#e0567f'},
    {k:'cprox',label:'Couleur à l\'approche',type:'color',defaut:'#ffffff'}
  ],
  calcul:calc,
  dessine:function(g, r){
    var R = calc(g, r);
    if(!R) return;
    var e = g.echelle || 1, c = g.ctx, F = g.cadre, textes = [];
    var pad = R.tick * r.largeur / 2, marge = R.tick * r.prox;
    for(var i = 0; i < R.zones.length; i++){
      var z = R.zones[i];
      if(z.score < r.minScore){
        if(r.voirSeuls) for(var k = 0; k < z.items.length; k++){
          var y = g.y(z.items[k].prix);
          g.ligne(z.items[k].prix, {couleur:r.c2, opacite:0.35, pointille:[2,4]});
          if(c && r.etiq && y > F.haut && y < F.bas) textes.push([texte, g, F.droite - 4 * e, y - 6 * e, z.items[k].nom, r.c2, Math.max(6, r.fsize - 2), false, 'right', FOND]);
        }
        continue;
      }
      var col = z.score >= 4 ? r.c4 : z.score === 3 ? r.c3 : r.c2;
      var bas = z.bas - pad, haut = z.haut + pad;
      var proche = R.prix >= bas - marge && R.prix <= haut + marge;
      var op = Math.min(0.6, r.opac * (1 + 0.5 * (z.score - r.minScore)) + (proche ? 0.1 : 0));
      g.zone(bas, haut, {couleur:col, opacite:op});
      if(proche){
        g.ligne(bas, {couleur:r.cprox, epaisseur:1.2, opacite:0.8});
        g.ligne(haut, {couleur:r.cprox, epaisseur:1.2, opacite:0.8});
      }
      if(r.etiq){
        var noms = [];
        for(k = 0; k < z.items.length; k++) noms.push(z.items[k].nom);
        var ym = g.y((z.bas + z.haut) / 2);
        if(c){ if(ym > F.haut && ym < F.bas) textes.push([badge, g, ym, z.score, noms.join(' · '), proche ? r.cprox : col, r.fsize]); }
        else g.etiquette((z.bas + z.haut) / 2, {couleur:col, texte:z.score + ' · ' + noms.join(' '), sansTrait:true});
      }
    }
    if(textes.length) devant(g, textes);
  }
};

HFQExt.etude(def);

})();
