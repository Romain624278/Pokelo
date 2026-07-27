// Vercel Serverless Function — gère la facturation Stripe côté compte :
// POST = ouvre le Billing Portal Stripe (gérer/annuler l'abonnement, changer
// de carte) ; GET = renvoie l'historique des factures (date, montant, statut,
// lien vers la facture PDF). Regroupées dans un seul fichier pour rester sous
// la limite de 12 fonctions serverless du plan Hobby Vercel.
// Variables d'environnement requises : STRIPE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const { stripeRequest, stripeGet, getSupabaseUser } = require('./_stripe-helpers');

async function getCustomerId(SUPABASE_URL, SERVICE_ROLE_KEY, userId){
  const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=stripe_customer_id`, {
    headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  const rows = await profileRes.json();
  return rows && rows[0] && rows[0].stripe_customer_id;
}

module.exports = async (req, res) => {
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

    if (req.method === 'GET') {
      const customerId = await getCustomerId(SUPABASE_URL, SERVICE_ROLE_KEY, user.id);
      if (!customerId) { res.status(200).json({ invoices: [] }); return; }
      const result = await stripeGet(`invoices?customer=${customerId}&limit=12`, STRIPE_SECRET_KEY);
      const invoices = (result.data || []).map(inv => ({
        id: inv.id,
        date: inv.created ? inv.created * 1000 : null,
        amount: inv.amount_paid != null ? inv.amount_paid / 100 : null,
        currency: inv.currency,
        status: inv.status,
        hostedInvoiceUrl: inv.hosted_invoice_url || null,
        pdfUrl: inv.invoice_pdf || null,
      }));
      res.status(200).json({ invoices });
      return;
    }

    if (req.method === 'POST') {
      const customerId = await getCustomerId(SUPABASE_URL, SERVICE_ROLE_KEY, user.id);
      if (!customerId) { res.status(404).json({ error: 'No Stripe customer for this account yet' }); return; }
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const portalSession = await stripeRequest('billing_portal/sessions', STRIPE_SECRET_KEY, {
        customer: customerId,
        return_url: `${origin}/#/app/account`,
      });
      res.status(200).json({ url: portalSession.url });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
