// Vercel Serverless Function — reçoit les événements Stripe et met à jour le plan
// de l'utilisateur dans Supabase (profiles.plan / stripe_customer_id / stripe_subscription_id).
// Variables d'environnement requises :
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Le body doit rester brut (non parsé) pour vérifier la signature Stripe — d'où
// `bodyParser: false` ci-dessous.
const { stripeGet, stripeRequest, fetchProfileFields, verifyStripeSignature, getRawBody } = require('./_stripe-helpers');

module.exports.config = { api: { bodyParser: false } };

async function planForPriceId(priceId){
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  return 'pro'; // prix inconnu : on suppose Pro plutôt que de laisser l'utilisateur sans plan payant
}

function periodEndIso(subscription){
  return subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : null;
}

async function updateProfile(supabaseUrl, serviceRoleKey, filterColumn, filterValue, fields){
  await fetch(`${supabaseUrl}/rest/v1/profiles?${filterColumn}=eq.${filterValue}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(fields),
  });
}

// Parrainage : si l'utilisateur qui vient de s'abonner (referredUserId) a été
// parrainé et que la récompense n'a pas déjà été versée, crédite 1 mois offert
// au parrain (via un crédit de solde Stripe, appliqué automatiquement à sa
// prochaine facture) — à condition que le parrain soit actuellement Pro/Équipe
// et ait déjà un stripe_customer_id (donc déjà passé par un vrai Checkout).
async function creditReferralIfNeeded(supabaseUrl, serviceRoleKey, stripeSecretKey, referredUserId){
  try {
    const referred = await fetchProfileFields(supabaseUrl, serviceRoleKey, referredUserId, 'referred_by_user_id,referral_reward_claimed');
    if (!referred || !referred.referred_by_user_id || referred.referral_reward_claimed) return;
    const referrer = await fetchProfileFields(supabaseUrl, serviceRoleKey, referred.referred_by_user_id, 'stripe_customer_id,plan');
    if (!referrer || !referrer.stripe_customer_id || !referrer.plan || referrer.plan === 'free') return;
    const proPriceId = process.env.STRIPE_PRICE_PRO;
    if (!proPriceId) return;
    const price = await stripeGet(`prices/${proPriceId}`, stripeSecretKey);
    const amount = price && price.unit_amount;
    if (!amount) return;
    await stripeRequest(`customers/${referrer.stripe_customer_id}/balance_transactions`, stripeSecretKey, {
      amount: -amount, currency: price.currency || 'eur', description: 'Pokelo — 1 mois offert (parrainage)',
    });
    await updateProfile(supabaseUrl, serviceRoleKey, 'id', referredUserId, {
      referral_reward_claimed: true, referral_discount_used: true,
    });
  } catch (e) {
    console.error('Crédit de parrainage échoué :', e);
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY || !WEBHOOK_SECRET) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers['stripe-signature'];
  if (!verifyStripeSignature(rawBody, signature, WEBHOOK_SECRET)) {
    res.status(400).json({ error: 'Invalid signature' });
    return;
  }

  let event;
  try { event = JSON.parse(rawBody); } catch (e) { res.status(400).json({ error: 'Invalid JSON' }); return; }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.client_reference_id;
      const customerId = session.customer;
      const subscriptionId = session.subscription;
      if (userId && subscriptionId) {
        const subscription = await stripeGet(`subscriptions/${subscriptionId}`, STRIPE_SECRET_KEY);
        const priceId = subscription.items && subscription.items.data[0] && subscription.items.data[0].price.id;
        const plan = await planForPriceId(priceId);
        await updateProfile(SUPABASE_URL, SERVICE_ROLE_KEY, 'id', userId, {
          plan, stripe_customer_id: customerId, stripe_subscription_id: subscriptionId,
          stripe_subscription_status: subscription.status, stripe_current_period_end: periodEndIso(subscription),
        });
        await creditReferralIfNeeded(SUPABASE_URL, SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, userId);
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const isActive = ['active', 'trialing', 'past_due'].includes(subscription.status);
      const priceId = subscription.items && subscription.items.data[0] && subscription.items.data[0].price.id;
      const plan = isActive ? await planForPriceId(priceId) : 'free';
      await updateProfile(SUPABASE_URL, SERVICE_ROLE_KEY, 'stripe_customer_id', customerId, {
        plan, stripe_subscription_status: subscription.status, stripe_current_period_end: periodEndIso(subscription),
      });
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: 'Webhook handling failed', detail: String(e && e.message || e) });
  }
};
