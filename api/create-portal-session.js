// Vercel Serverless Function — ouvre le Billing Portal Stripe pour un client existant.
// Variables d'environnement requises : STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const { stripeRequest, getSupabaseUser } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  try {
    const user = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=stripe_customer_id`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const rows = await profileRes.json();
    const customerId = rows && rows[0] && rows[0].stripe_customer_id;
    if (!customerId) { res.status(404).json({ error: 'No Stripe customer for this account yet' }); return; }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const portalSession = await stripeRequest('billing_portal/sessions', STRIPE_SECRET_KEY, {
      customer: customerId,
      return_url: `${origin}/#/app/settings`,
    });

    res.status(200).json({ url: portalSession.url });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
