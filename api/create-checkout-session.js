// Vercel Serverless Function — crée une session Stripe Checkout (abonnement).
// Variables d'environnement requises (Vercel → Settings → Environment Variables) :
//   STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   STRIPE_COUPON_REFERRAL30 (optionnel — voir STRIPE_SETUP.md, système de parrainage)
// Voir STRIPE_SETUP.md pour la marche à suivre complète (compte Stripe, Price ID, etc.).
const { stripeRequest, getSupabaseUser, fetchProfileFields, logServerError } = require('./_stripe-helpers');

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
  // N'accepter que nos propres Price ID Pro/Équipe : sans cette liste, un
  // appelant pourrait envoyer n'importe quel priceId existant sur le compte
  // Stripe (ex. un prix de test à 1€ jamais destiné au public) et obtenir
  // malgré tout le plan Pro, car planForPriceId() dans stripe-webhook.js
  // suppose "Pro" pour tout prix qu'il ne reconnaît pas.
  const ALLOWED_PRICE_IDS = [process.env.STRIPE_PRICE_PRO, process.env.STRIPE_PRICE_TEAM].filter(Boolean);
  if (!ALLOWED_PRICE_IDS.includes(priceId)) { res.status(400).json({ error: 'Invalid priceId' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  let userId = null;
  try {
    const user = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    userId = user.id;

    // Parrainage : -30% sur le premier mois si l'utilisateur a été parrainé, n'a
    // jamais souscrit avant (plan === 'free') et n'a pas déjà consommé cette remise.
    // Le parrain doit actuellement être Pro/Équipe (vérifié ici, pas seulement au
    // moment où le code a été renseigné à l'inscription).
    // Isolé dans son propre try/catch : si les colonnes de parrainage n'existent
    // pas encore en base (migration SUPABASE_SETUP.md §7 non exécutée), le
    // checkout doit quand même fonctionner — juste sans remise automatique.
    let discountCoupon = null;
    try {
      const profile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, user.id, 'plan,referred_by_user_id,referral_discount_used');
      if (profile && profile.plan === 'free' && !profile.referral_discount_used && profile.referred_by_user_id && process.env.STRIPE_COUPON_REFERRAL30) {
        const referrer = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, profile.referred_by_user_id, 'plan');
        if (referrer && referrer.plan && referrer.plan !== 'free') {
          discountCoupon = process.env.STRIPE_COUPON_REFERRAL30;
        }
      }
    } catch (refErr) {
      await logServerError(SUPABASE_URL, SERVICE_ROLE_KEY, 'create-checkout-session-referral', String(refErr && refErr.message || refErr), { priceId }, userId).catch(() => {});
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;
    const sessionParams = {
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user.email,
      client_reference_id: user.id,
      success_url: `${origin}/#/app/account?checkout=success`,
      cancel_url: `${origin}/#/app/account?checkout=cancelled`,
    };
    // discounts et allow_promotion_codes sont mutuellement exclusifs côté Stripe :
    // remise de parrainage automatique, sinon on laisse la place à un code promo
    // manuel (cadeau d'un mois offert à un ami, voir STRIPE_SETUP.md).
    if (discountCoupon) sessionParams.discounts = [{ coupon: discountCoupon }];
    else sessionParams.allow_promotion_codes = true;

    const session = await stripeRequest('checkout/sessions', STRIPE_SECRET_KEY, sessionParams);

    res.status(200).json({ url: session.url });
  } catch (e) {
    await logServerError(SUPABASE_URL, SERVICE_ROLE_KEY, 'create-checkout-session', String(e && e.message || e), { priceId }, userId);
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
