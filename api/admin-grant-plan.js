// Vercel Serverless Function — attribue ou retire Pokelo Pro/Équipe à un
// utilisateur directement (sans passer par un vrai abonnement Stripe), pour
// offrir un accès à un joueur. Réservé au rôle admin, revérifié côté serveur.
// Ne touche jamais aux champs stripe_* : si l'utilisateur souscrit réellement
// plus tard via Stripe, le webhook reprend la main normalement.
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const { email, plan } = req.body || {};
  if (!email || !['free', 'pro', 'team'].includes(plan)) { res.status(400).json({ error: 'Missing or invalid email/plan' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
    const findRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,plan&email=eq.${encodeURIComponent(email)}`, { headers });
    if (!findRes.ok) throw new Error('Supabase lookup failed');
    const rows = await findRes.json();
    const target = rows[0];
    if (!target) { res.status(404).json({ error: 'No account with this email' }); return; }

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${target.id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ plan }),
    });
    if (!patchRes.ok) throw new Error('Supabase update failed');

    console.log(`[admin-grant-plan] ${caller.email} a mis le plan de ${target.email} à "${plan}"`);
    res.status(200).json({ ok: true, email: target.email, plan });
  } catch (e) {
    res.status(502).json({ error: 'Grant failed', detail: String(e && e.message || e) });
  }
};
