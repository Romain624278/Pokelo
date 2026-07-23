// Vercel Serverless Function — crée une session Stripe Checkout (abonnement).
// Variables d'environnement requises (Vercel → Settings → Environment Variables) :
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Voir STRIPE_SETUP.md pour la marche à suivre complète (compte Stripe, Price ID, etc.).
const { stripeRequest, getSupabaseUser } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const { priceId } = req.body || {};
  if (!priceId) { res.status(400).json({ error: 'Missing priceId' }); return; }

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

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const session = await stripeRequest('checkout/sessions', STRIPE_SECRET_KEY, {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: `${origin}/#/app/settings?checkout=success`,
      cancel_url: `${origin}/#/app/settings?checkout=cancelled`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
