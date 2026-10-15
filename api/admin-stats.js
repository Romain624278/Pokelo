// Vercel Serverless Function — statistiques globales pour le rôle admin.
// L'accès n'est JAMAIS décidé côté client : ce endpoint revérifie lui-même
// profiles.role === 'admin' via la clé service_role avant de renvoyer quoi
// que ce soit. Le menu admin visible côté client n'est qu'un confort d'UI.
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');
const { computeKpis } = require('./_admin-kpis');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const user = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

    const caller = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, user.id, 'role');
    if (!caller || caller.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
    const [profilesRes, errorsRes, bankrollsRes, sessionsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,display_name,plan,role,created_at,stripe_customer_id,stripe_subscription_status,stripe_current_period_end,referral_reward_claimed&order=created_at.desc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/error_logs?select=*&order=created_at.desc&limit=20`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/bankrolls?select=id,user_id,currency,start`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/sessions?select=user_id,bankroll_id,buy_in,cashout,fx_rate,created_at&order=created_at.desc`, { headers }),
    ]);
    if (!profilesRes.ok) throw new Error('Supabase profiles query failed');
    const profiles = await profilesRes.json();
    const errors = errorsRes.ok ? await errorsRes.json() : [];
    const bankrolls = bankrollsRes.ok ? await bankrollsRes.json() : [];
    const sessions = sessionsRes.ok ? await sessionsRes.json() : [];

    // Éléments secondaires : chacun est isolé, un échec (table absente,
    // API auth indisponible) ne doit jamais casser tout le panneau.
    const safeJson = async (url) => {
      try { const r = await fetch(url, { headers }); return r.ok ? await r.json() : null; } catch (e) { return null; }
    };
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [pendingReviewsRows, newSupportRows, errors24hRows, reviewRows, quotaResetRows] = await Promise.all([
      safeJson(`${SUPABASE_URL}/rest/v1/reviews?select=id&status=eq.pending&limit=1000`),
      safeJson(`${SUPABASE_URL}/rest/v1/support_messages?select=id&status=eq.new&limit=1000`),
      safeJson(`${SUPABASE_URL}/rest/v1/error_logs?select=id&created_at=gte.${since24h}&limit=1000`),
      safeJson(`${SUPABASE_URL}/rest/v1/reviews?select=user_id,rating,status,created_at&order=created_at.desc&limit=2000`),
      // Colonne ajoutée par la migration SUPABASE_SETUP.md §17 : requête isolée,
      // elle renvoie null (et rien d'autre ne casse) tant que la migration n'est pas faite.
      safeJson(`${SUPABASE_URL}/rest/v1/profiles?select=id,quota_reset_at&quota_reset_at=not.is.null&limit=2000`),
    ]);
    const quotaResetById = {};
    (quotaResetRows || []).forEach(r => { quotaResetById[r.id] = new Date(r.quota_reset_at).getTime(); });
    const reviewsByUser = {};
    (reviewRows || []).forEach(r => {
      if (!r.user_id) return;
      const cur = reviewsByUser[r.user_id] || { count: 0, rating: null, status: null };
      cur.count++;
      if (cur.rating == null) { cur.rating = r.rating; cur.status = r.status; } // le plus récent d'abord
      reviewsByUser[r.user_id] = cur;
    });
    // Dernière connexion : n'existe que dans l'authentification Supabase
    // (auth.users.last_sign_in_at), pas dans `profiles`.
    let authUsers = null;
    try {
      authUsers = [];
      for (let page = 1; page <= 10; page++) {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers });
        if (!r.ok) { if (page === 1) authUsers = null; break; }
        const body = await r.json();
        const batch = Array.isArray(body) ? body : (body.users || []);
        authUsers = authUsers.concat(batch);
        if (batch.length < 1000) break;
      }
    } catch (e) { authUsers = null; }
    const lastSignInById = {};
    (authUsers || []).forEach(u => { lastSignInById[u.id] = u.last_sign_in_at || null; });

    const kpis = computeKpis({
      profiles, bankrolls, sessions, authUsers,
      pendingReviews: pendingReviewsRows ? pendingReviewsRows.length : 0,
      newSupport: newSupportRows ? newSupportRows.length : 0,
      errors24h: errors24hRows ? errors24hRows.length : 0,
      quotaResetById,
    });

    const bankrollCountByUser = {};
    const bankrollById = {};
    bankrolls.forEach(b => {
      bankrollCountByUser[b.user_id] = (bankrollCountByUser[b.user_id] || 0) + 1;
      bankrollById[b.id] = b;
    });
    const sessionCountByUser = {};
    const lastSessionByUser = {};
    // Valeur de bankroll et tendance 30j par devise (un joueur peut avoir des
    // bankrolls en plusieurs devises — pas de somme naïve entre devises
    // différentes, voir affichage client qui les liste séparément).
    const bankrollValueByUser = {};
    const profit30dByUser = {};
    bankrolls.forEach(b => {
      bankrollValueByUser[b.user_id] = bankrollValueByUser[b.user_id] || {};
      bankrollValueByUser[b.user_id][b.currency] = (bankrollValueByUser[b.user_id][b.currency] || 0) + (Number(b.start) || 0);
    });
    const now30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    sessions.forEach(s => {
      sessionCountByUser[s.user_id] = (sessionCountByUser[s.user_id] || 0) + 1;
      if (!lastSessionByUser[s.user_id]) lastSessionByUser[s.user_id] = s.created_at;
      const bk = bankrollById[s.bankroll_id];
      if (!bk) return;
      const rate = s.fx_rate == null ? 1 : s.fx_rate;
      const profit = Math.round((s.cashout - s.buy_in) * rate * 100) / 100;
      bankrollValueByUser[s.user_id] = bankrollValueByUser[s.user_id] || {};
      bankrollValueByUser[s.user_id][bk.currency] = (bankrollValueByUser[s.user_id][bk.currency] || 0) + profit;
      if (s.created_at && new Date(s.created_at).getTime() >= now30) {
        profit30dByUser[s.user_id] = profit30dByUser[s.user_id] || {};
        profit30dByUser[s.user_id][bk.currency] = (profit30dByUser[s.user_id][bk.currency] || 0) + profit;
      }
    });
    const toCurrencyList = (byCurrency) => Object.entries(byCurrency || {}).map(([currency, value]) => ({ currency, value: Math.round(value * 100) / 100 }));

    const now = Date.now();
    const days = n => now - n * 24 * 60 * 60 * 1000;
    const planCounts = { free: 0, pro: 0, team: 0 };
    let signups7d = 0, signups30d = 0, referralRewardsGiven = 0;
    profiles.forEach(p => {
      planCounts[p.plan] = (planCounts[p.plan] || 0) + 1;
      const createdAt = p.created_at ? new Date(p.created_at).getTime() : 0;
      if (createdAt >= days(7)) signups7d++;
      if (createdAt >= days(30)) signups30d++;
      if (p.referral_reward_claimed) referralRewardsGiven++;
    });

    const users = profiles.slice(0, 1000).map(p => ({
      id: p.id,
      email: p.email,
      displayName: p.display_name || '',
      plan: p.plan || 'free',
      role: p.role || 'user',
      createdAt: p.created_at,
      hasStripeCustomer: !!p.stripe_customer_id,
      subscriptionStatus: p.stripe_subscription_status || null,
      periodEnd: p.stripe_current_period_end,
      bankrollCount: bankrollCountByUser[p.id] || 0,
      sessionCount: sessionCountByUser[p.id] || 0,
      lastSessionAt: lastSessionByUser[p.id] || null,
      lastSignInAt: lastSignInById[p.id] || null,
      monthSessions: kpis.monthCountByUser[p.id] || 0,
      quotaResetAt: quotaResetById[p.id] ? new Date(quotaResetById[p.id]).toISOString() : null,
      reviewCount: (reviewsByUser[p.id] || {}).count || 0,
      reviewRating: (reviewsByUser[p.id] || {}).rating == null ? null : reviewsByUser[p.id].rating,
      reviewStatus: (reviewsByUser[p.id] || {}).status || null,
      bankrollValue: toCurrencyList(bankrollValueByUser[p.id]),
      profit30d: toCurrencyList(profit30dByUser[p.id]),
    }));

    res.status(200).json({
      totalUsers: profiles.length,
      planCounts,
      signups7d,
      signups30d,
      referralRewardsGiven,
      kpis,
      // Santé du panneau : ce qui dépend d'une migration ou d'une API annexe.
      capabilities: { authUsers: authUsers !== null, quotaReset: quotaResetRows !== null, reviews: reviewRows !== null },
      recentErrors: errors,
      users,
    });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
};
