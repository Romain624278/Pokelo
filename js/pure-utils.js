// Fonctions pures extraites de index.html — aucune dépendance à `state`, au DOM
// ou au réseau, donc testables directement avec Node (voir test/pure-utils.test.js).
// Chargé en <script> classique dans index.html (assigne sur window, exactement
// comme avant l'extraction — aucun appelant existant n'a besoin de changer) et
// utilisable en require() côté Node pour les tests.
(function (global) {
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

  function todayStr(){ return new Date().toISOString().slice(0,10); }

  function escapeHtml(s){
    return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function csvEscape(v){
    const s = v == null ? '' : String(v);
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function mulberry32(seed){
    return function(){
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function sessionProfit(s){
    const rate = (s.fxRate == null) ? 1 : s.fxRate;
    return Math.round((s.cashout - s.buyIn) * rate * 100)/100;
  }

  function fmtNum(n){
    return (Math.round(n*100)/100).toLocaleString('fr-FR', { minimumFractionDigits:2, maximumFractionDigits:2 });
  }
  function fmtMoney(n, cur){ return fmtNum(n) + ' ' + (cur||''); }
  function fmtSigned(n, cur){ return (n>=0?'+':'') + fmtMoney(n, cur); }

  const PureUtils = { uid, todayStr, escapeHtml, csvEscape, mulberry32, sessionProfit, fmtNum, fmtMoney, fmtSigned };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PureUtils;
  } else {
    Object.assign(global, PureUtils);
  }
})(typeof window !== 'undefined' ? window : globalThis);
