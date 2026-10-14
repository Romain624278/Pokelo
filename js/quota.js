// Quota mensuel de sessions du plan gratuit — fonctions pures (aucune dépendance
// à `state`, au DOM ou à l'horloge système : la date de référence est toujours
// passée en paramètre), donc testables avec Node (voir test/quota.test.js).
// Le décompte se fait sur la date de SAISIE (createdAt), pas sur la date de
// jeu : sinon antidater une session suffirait à contourner la limite, et le
// compte à rebours de déblocage n'aurait aucun sens.
(function (global) {
  function monthStartMs(refMs){
    const d = new Date(refMs);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  function nextMonthStartMs(refMs){
    const d = new Date(refMs);
    return new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  }

  // Les sessions de démonstration (`demo: true`) ne consomment jamais le quota.
  // `sinceMs` (optionnel) : réinitialisation du quota par un admin — seules les
  // sessions saisies à partir de cette date comptent, jamais rien n'est supprimé.
  function countSessionsInMonth(sessions, refMs, sinceMs){
    const start = Math.max(monthStartMs(refMs), sinceMs || 0);
    const end = nextMonthStartMs(refMs);
    return (sessions || []).filter(s => !s.demo && s.createdAt >= start && s.createdAt < end).length;
  }

  function computeSessionQuota(sessions, limit, refMs, sinceMs){
    const used = countSessionsInMonth(sessions, refMs, sinceMs);
    return {
      used,
      limit,
      remaining: Math.max(0, limit - used),
      blocked: used >= limit,
      resetAtMs: nextMonthStartMs(refMs),
    };
  }

  // Décompose une durée en jours / heures / minutes / secondes pour le timer.
  function splitDuration(ms){
    const total = Math.max(0, Math.floor(ms / 1000));
    return {
      days: Math.floor(total / 86400),
      hours: Math.floor((total % 86400) / 3600),
      minutes: Math.floor((total % 3600) / 60),
      seconds: total % 60,
    };
  }

  const Quota = { monthStartMs, nextMonthStartMs, countSessionsInMonth, computeSessionQuota, splitDuration };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Quota;
  } else {
    global.Quota = Quota;
  }
})(typeof window !== 'undefined' ? window : globalThis);
