// Calcul pur des KPIs du panneau admin (aucun accès réseau : les données brutes
// sont passées en paramètre, ce qui permet de le tester avec Node — voir
// test/admin-kpis.test.js). Préfixe `_` : non déployé comme fonction Vercel.
const DAY_MS = 24 * 60 * 60 * 1000;
const PRO_PRICE_EUR = 9.9;          // estimation du MRR (pas les montants réels Stripe)
const FREE_SESSIONS_PER_MONTH = 10; // doit rester aligné sur index.html

function isoDay(ms){ return new Date(ms).toISOString().slice(0, 10); }

function computeKpis({ profiles, bankrolls, sessions, authUsers, pendingReviews, newSupport, errors24h, nowMs }){
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
    if (created >= monthStart) monthCount[s.user_id] = (monthCount[s.user_id] || 0) + 1;
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
    sessions30d, quotaBlocked,
    todo: { pendingReviews: pendingReviews || 0, newSupport: newSupport || 0, errors24h: errors24h || 0 },
  };
}

module.exports = { computeKpis, PRO_PRICE_EUR, FREE_SESSIONS_PER_MONTH };
