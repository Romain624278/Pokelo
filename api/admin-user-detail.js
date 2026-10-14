// Vercel Serverless Function — détail d'un compte pour le panneau admin (vue
// par utilisateur : bankrolls, sessions, factures Stripe) et envoi d'un
// e-mail de réinitialisation de mot de passe à sa place. Regroupées dans un
// seul fichier pour rester sous la limite de 12 fonctions serverless du plan
// Hobby Vercel. Réservé au rôle admin, revérifié côté serveur à chaque appel.
const { stripeGet, getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');
const { computeUserStats } = require('./_admin-kpis');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireAdmin(req, res){
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return null; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return null; }

  const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
  if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return null; }
  const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
  if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return null; }
  return caller;
}

async function getUserDetail(req, res){
  const userId = (req.query || {}).userId;
  if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) { res.status(400).json({ error: 'Missing userId' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };

  try {
    const [profileRes, bankrollsRes, sessionsRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,display_name,plan,role,created_at,stripe_customer_id,stripe_current_period_end,referral_code,referred_by_user_id&id=eq.${userId}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/bankrolls?select=id,name,currency,start,color,created_at&user_id=eq.${userId}&order=created_at.asc`, { headers }),
      // limit=100 : un aperçu récent suffit pour du support/debug, pas besoin
      // de charger l'historique complet d'un joueur actif depuis longtemps.
      fetch(`${SUPABASE_URL}/rest/v1/sessions?select=id,bankroll_id,category,format,date,buy_in,cashout,currency,fx_rate,created_at&user_id=eq.${userId}&order=date.desc`, { headers }),
    ]);
    if (!profileRes.ok) throw new Error('Supabase profile query failed');
    const profileRows = await profileRes.json();
    const profile = profileRows[0];
    if (!profile) { res.status(404).json({ error: 'User not found' }); return; }
    const bankrolls = bankrollsRes.ok ? await bankrollsRes.json() : [];
    const sessions = sessionsRes.ok ? await sessionsRes.json() : [];

    // Éléments secondaires : chacun est isolé, un échec ne casse jamais la fiche.
    const safeJson = async (url) => {
      try { const r = await fetch(url, { headers }); return r.ok ? await r.json() : null; } catch (e) { return null; }
    };
    const [authRow, reviewRows, supportRows, referredRows, quotaRows] = await Promise.all([
      safeJson(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`),
      safeJson(`${SUPABASE_URL}/rest/v1/reviews?select=id,rating,text,status,created_at&user_id=eq.${userId}&order=created_at.desc`),
      safeJson(`${SUPABASE_URL}/rest/v1/support_messages?select=id,category,message,status,created_at&user_id=eq.${userId}&order=created_at.desc&limit=20`),
      safeJson(`${SUPABASE_URL}/rest/v1/profiles?select=id&referred_by_user_id=eq.${userId}`),
      safeJson(`${SUPABASE_URL}/rest/v1/profiles?select=quota_reset_at&id=eq.${userId}`),
    ]);
    let referrerEmail = null;
    if (profile.referred_by_user_id && UUID_RE.test(profile.referred_by_user_id)) {
      const ref = await safeJson(`${SUPABASE_URL}/rest/v1/profiles?select=email&id=eq.${profile.referred_by_user_id}`);
      referrerEmail = ref && ref[0] ? ref[0].email : null;
    }
    const quotaResetAt = quotaRows && quotaRows[0] && quotaRows[0].quota_reset_at ? quotaRows[0].quota_reset_at : null;
    const stats = computeUserStats({
      bankrolls, sessions, resetMs: quotaResetAt ? new Date(quotaResetAt).getTime() : 0,
    });

    let invoices = [];
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
    if (profile.stripe_customer_id && STRIPE_SECRET_KEY) {
      try {
        const result = await stripeGet(`invoices?customer=${profile.stripe_customer_id}&limit=24`, STRIPE_SECRET_KEY);
        invoices = (result.data || []).map(inv => ({
          id: inv.id,
          date: inv.created ? inv.created * 1000 : null,
          amount: inv.amount_paid != null ? inv.amount_paid / 100 : null,
          currency: inv.currency,
          status: inv.status,
          hostedInvoiceUrl: inv.hosted_invoice_url || null,
          pdfUrl: inv.invoice_pdf || null,
        }));
      } catch (e) { /* facturation indisponible ne doit pas casser le reste de la fiche */ }
    }

    res.status(200).json({
      profile: {
        id: profile.id, email: profile.email, displayName: profile.display_name,
        plan: profile.plan || 'free', role: profile.role || 'user', createdAt: profile.created_at,
        hasStripeCustomer: !!profile.stripe_customer_id, periodEnd: profile.stripe_current_period_end,
        lastSignInAt: authRow && authRow.last_sign_in_at ? authRow.last_sign_in_at : null,
        referralCode: profile.referral_code || null, referrerEmail, referredCount: referredRows ? referredRows.length : 0,
        quotaResetAt,
      },
      stats,
      reviews: reviewRows || [],
      supportMessages: supportRows || [],
      bankrolls: bankrolls.map(b => ({ id: b.id, name: b.name, currency: b.currency, start: b.start, color: b.color, createdAt: b.created_at })),
      sessions: sessions.slice(0, 100).map(s => ({
        id: s.id, bankrollId: s.bankroll_id, category: s.category, format: s.format, date: s.date,
        buyIn: s.buy_in, cashout: s.cashout, currency: s.currency, fxRate: s.fx_rate, createdAt: s.created_at,
      })),
      invoices,
    });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
}

async function sendPasswordReset(req, res, caller){
  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string') { res.status(400).json({ error: 'Missing userId' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const target = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, userId, 'email');
    if (!target || !target.email) { res.status(404).json({ error: 'User not found' }); return; }

    // Même endpoint que celui utilisé par resetPasswordForEmail() côté client
    // (voir index.html) : on le déclenche depuis le serveur, à la place du
    // joueur, avec la clé service_role plutôt que l'anon key — évite d'exposer
    // un moyen pour n'importe qui d'appeler cette route pour un e-mail
    // arbitraire (elle revérifie déjà le rôle admin ci-dessus, mais reste
    // cohérente avec le reste du fichier qui n'utilise que service_role).
    const recoverRes = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: 'POST',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target.email }),
    });
    if (!recoverRes.ok) { const detail = await recoverRes.text(); throw new Error(detail || 'Supabase recover call failed'); }

    console.log(`[admin-user-detail:reset] ${caller.email} a envoyé un reset mot de passe à ${target.email}`);
    res.status(200).json({ ok: true, email: target.email });
  } catch (e) {
    res.status(502).json({ error: 'Reset failed', detail: String(e && e.message || e) });
  }
}

// Geste commercial : remet le quota mensuel de sessions d'un compte à zéro en
// enregistrant une date de réinitialisation (profiles.quota_reset_at). Aucune
// session n'est supprimée ni modifiée — le client ne compte simplement plus
// celles saisies avant cette date.
async function resetQuota(req, res, caller){
  const { userId } = req.body || {};
  if (!userId || typeof userId !== 'string' || !UUID_RE.test(userId)) { res.status(400).json({ error: 'Missing userId' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const nowIso = new Date().toISOString();
    const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ quota_reset_at: nowIso }),
    });
    if (!r.ok) {
      const detail = await r.text();
      // Colonne absente : la migration SUPABASE_SETUP.md §17 n'a pas été appliquée.
      if (/quota_reset_at|42703|PGRST204/i.test(detail)) { res.status(409).json({ error: 'migration-required' }); return; }
      throw new Error(detail || 'Supabase update failed');
    }
    console.log(`[admin-user-detail:reset-quota] ${caller.email} a réinitialisé le quota de ${userId}`);
    res.status(200).json({ ok: true, quotaResetAt: nowIso });
  } catch (e) {
    res.status(502).json({ error: 'Reset failed', detail: String(e && e.message || e) });
  }
}

module.exports = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (req.method === 'GET') { await getUserDetail(req, res); return; }
  if (req.method === 'POST') {
    const action = (req.body || {}).action;
    if (action === 'send-password-reset') { await sendPasswordReset(req, res, caller); return; }
    if (action === 'reset-quota') { await resetQuota(req, res, caller); return; }
    res.status(400).json({ error: 'Missing or invalid action' });
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
};
