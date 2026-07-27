// Vercel Serverless Function — désactive un code promotionnel Stripe depuis
// le panneau admin. Réservé au rôle admin, revérifié côté serveur.
// Stripe ne permet pas de supprimer un code promo (ni son coupon une fois
// utilisé) : la désactivation (active=false) est l'équivalent fonctionnel —
// le code cesse immédiatement d'être accepté au Checkout, sans casser
// l'historique des remises déjà appliquées aux abonnements existants.
const { stripeRequest, getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const { id } = req.body || {};
  if (!id || typeof id !== 'string' || !id.startsWith('promo_')) { res.status(400).json({ error: 'Missing or invalid promotion code id' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    const promo = await stripeRequest(`promotion_codes/${id}`, STRIPE_SECRET_KEY, { active: false });

    console.log(`[admin-deactivate-promo] ${caller.email} a désactivé le code ${promo.code}`);
    res.status(200).json({ ok: true, code: promo.code });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
