// Vercel Serverless Function — reçoit les événements Stripe et met à jour le plan
// de l'utilisateur dans Supabase (profiles.plan / stripe_customer_id / stripe_subscription_id).
// Variables d'environnement requises :
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Le body doit rester brut (non parsé) pour vérifier la signature Stripe — d'où
// `bodyParser: false` ci-dessous.
const { stripeGet, verifyStripeSignature, getRawBody } = require('./_stripe-helpers');

module.exports.config = { api: { bodyParser: false } };

async function planForPriceId(priceId){
  if (priceId === process.env.STRIPE_PRICE_TEAM) return 'team';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
  return 'pro'; // prix inconnu : on suppose Pro plutôt que de laisser l'utilisateur sans plan payant
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
          stripe_subscription_status: subscription.status,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      const customerId = subscription.customer;
      const isActive = ['active', 'trialing', 'past_due'].includes(subscription.status);
      const priceId = subscription.items && subscription.items.data[0] && subscription.items.data[0].price.id;
      const plan = isActive ? await planForPriceId(priceId) : 'free';
      await updateProfile(SUPABASE_URL, SERVICE_ROLE_KEY, 'stripe_customer_id', customerId, {
        plan, stripe_subscription_status: subscription.status,
      });
    }
    res.status(200).json({ received: true });
  } catch (e) {
    res.status(500).json({ error: 'Webhook handling failed', detail: String(e && e.message || e) });
  }
};
