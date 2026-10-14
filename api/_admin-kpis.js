// Calcul pur des KPIs du panneau admin (aucun accès réseau : les données brutes
// sont passées en paramètre, ce qui permet de le tester avec Node — voir
// test/admin-kpis.test.js). Préfixe `_` : non déployé comme fonction Vercel.
const DAY_MS = 24 * 60 * 60 * 1000;
const PRO_PRICE_EUR = 9.9;          // estimation du MRR (pas les montants réels Stripe)
const FREE_SESSIONS_PER_MONTH = 10; // doit rester aligné sur index.html

function isoDay(ms){ return new Date(ms).toISOString().slice(0, 10); }

function computeKpis({ profiles, bankrolls, sessions, authUsers, pendingReviews, newSupport, errors24h, quotaResetById, nowMs }){
  const now = nowMs || Date.now();
  const since = n => now - n * DAY_MS;
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();

  const total = profiles.length;
  const planCounts = { free: 0, pro: 0, team: 0 };
  let signups7d = 0, signups30d = 0, referralRewardsGiven = 0, payingPro = 0, grantedPro = 0;
  const signupByDay = {};
  profiles.forEach(p => {
    const plan = p.plan || 'free';
    planCounts[plan] = (planCounts[plan] || 0) + 1;
    const created = p.created_at ? new Date(p.created_at).getTime() : 0;
    if (created >= since(7)) signups7d++;
    if (created >= since(30)) signups30d++;
    if (created >= since(30)) { const k = isoDay(created); signupByDay[k] = (signupByDay[k] || 0) + 1; }
    if (p.referral_reward_claimed) referralRewardsGiven++;
    if (plan !== 'free') { if (p.stripe_customer_id) payingPro++; else grantedPro++; }
  });
  const signupSeries = [];
  for (let i = 29; i >= 0; i--) {
    const k = isoDay(since(i));
    signupSeries.push({ date: k, count: signupByDay[k] || 0 });
  }

  const bankrollUsers = new Set(bankrolls.map(b => b.user_id));
  const sessionCount = {};
  const monthCount = {};
  const enteredRecently = new Set();
  let sessions30d = 0;
  sessions.forEach(s => {
    sessionCount[s.user_id] = (sessionCount[s.user_id] || 0) + 1;
    const created = s.created_at ? new Date(s.created_at).getTime() : 0;
    // Réinitialisation du quota par un admin : seules les sessions saisies après
    // cette date comptent (rien n'est supprimé).
    const quotaFrom = Math.max(monthStart, (quotaResetById && quotaResetById[s.user_id]) || 0);
    if (created >= quotaFrom) monthCount[s.user_id] = (monthCount[s.user_id] || 0) + 1;
    if (created >= since(7)) enteredRecently.add(s.user_id);
    if (created >= since(30)) sessions30d++;
  });
  const withSession = Object.keys(sessionCount).length;
  const withFive = Object.values(sessionCount).filter(n => n >= 5).length;

  const planByUser = {};
  profiles.forEach(p => { planByUser[p.id] = p.plan || 'free'; });
  const quotaBlocked = Object.keys(monthCount)
    .filter(uid => planByUser[uid] === 'free' && monthCount[uid] >= FREE_SESSIONS_PER_MONTH).length;

  let signedIn7d = 0, signedIn30d = 0;
  (authUsers || []).forEach(u => {
    const t = u.last_sign_in_at ? new Date(u.last_sign_in_at).getTime() : 0;
    if (t >= since(7)) signedIn7d++;
    if (t >= since(30)) signedIn30d++;
  });

  const proCount = planCounts.pro + planCounts.team;
  const pct = n => (total ? Math.round((n / total) * 1000) / 10 : 0);
  return {
    totalUsers: total, signups7d, signups30d, signupSeries, referralRewardsGiven,
    planCounts, proCount, payingPro, grantedPro,
    mrrEstimate: Math.round(payingPro * PRO_PRICE_EUR * 100) / 100,
    conversionPct: pct(proCount),
    activation: {
      withBankroll: bankrollUsers.size, withBankrollPct: pct(bankrollUsers.size),
      withSession, withSessionPct: pct(withSession),
      withFiveSessions: withFive, withFiveSessionsPct: pct(withFive),
    },
    active: { signedIn7d, signedIn30d, entered7d: enteredRecently.size, authAvailable: Array.isArray(authUsers) },
    sessions30d, quotaBlocked, monthCountByUser: monthCount,
    todo: { pendingReviews: pendingReviews || 0, newSupport: newSupport || 0, errors24h: errors24h || 0 },
  };
}

// Vue d'un seul compte : solde et résultat par bankroll (dans la devise de la
// bankroll, jamais de somme entre devises), activité des 6 derniers mois,
// sessions décomptées dans le quota du mois (réinitialisation admin incluse).
function computeUserStats({ bankrolls, sessions, resetMs, nowMs }){
  const now = nowMs || Date.now();
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const quotaFrom = Math.max(monthStart, resetMs || 0);
  const round = n => Math.round(n * 100) / 100;
  const byId = {};
  const perBankroll = bankrolls.map(b => {
    const row = { id: b.id, name: b.name, currency: b.currency, start: Number(b.start) || 0, sessionCount: 0, profit: 0, balance: 0, lastSessionDate: null };
    byId[b.id] = row;
    return row;
  });
  const monthKeys = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    monthKeys.push(m.getFullYear() + '-' + String(m.getMonth() + 1).padStart(2, '0'));
  }
  const monthly = {};
  monthKeys.forEach(k => { monthly[k] = { month: k, sessions: 0, profitByCurrency: {} }; });
  let quotaUsed = 0;
  sessions.forEach(s => {
    const row = byId[s.bankroll_id];
    const rate = s.fx_rate == null ? 1 : s.fx_rate;
    const profit = round((s.cashout - s.buy_in) * rate);
    if (row) {
      row.sessionCount++;
      row.profit = round(row.profit + profit);
      if (!row.lastSessionDate || (s.date && s.date > row.lastSessionDate)) row.lastSessionDate = s.date || row.lastSessionDate;
    }
    const key = (s.date || '').slice(0, 7);
    if (monthly[key]) {
      monthly[key].sessions++;
      const cur = row ? row.currency : (s.currency || 'EUR');
      monthly[key].profitByCurrency[cur] = round((monthly[key].profitByCurrency[cur] || 0) + profit);
    }
    const created = s.created_at ? new Date(s.created_at).getTime() : 0;
    if (created >= quotaFrom) quotaUsed++;
  });
  perBankroll.forEach(r => { r.balance = round(r.start + r.profit); });
  return {
    bankrolls: perBankroll,
    monthly: monthKeys.map(k => ({
      month: k, sessions: monthly[k].sessions,
      profit: Object.entries(monthly[k].profitByCurrency).map(([currency, value]) => ({ currency, value })),
    })),
    quotaUsed,
    sessionCount: sessions.length,
  };
}

module.exports = { computeKpis, computeUserStats, PRO_PRICE_EUR, FREE_SESSIONS_PER_MONTH };
