// Vercel Serverless Function — gère les codes promotionnels Stripe depuis le
// panneau admin (liste, création, désactivation). Regroupées dans un seul
// fichier (au lieu de 3 endpoints séparés) pour rester sous la limite de 12
// fonctions serverless du plan Hobby Vercel. Réservé au rôle admin, revérifié
// côté serveur à chaque appel.
const { stripeRequest, stripeGet, getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

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

async function listPromos(req, res){
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }
  try {
    // limit=100 : largement suffisant pour un usage "offrir des mois à des
    // amis" — pas de pagination pour rester simple.
    const result = await stripeGet('promotion_codes?limit=100', STRIPE_SECRET_KEY);
    const promos = (result.data || []).map(p => ({
      id: p.id,
      code: p.code,
      active: p.active,
      percentOff: p.coupon ? p.coupon.percent_off : null,
      duration: p.coupon ? p.coupon.duration : null,
      timesRedeemed: p.times_redeemed,
      maxRedemptions: p.max_redemptions,
      created: p.created,
    })).sort((a, b) => b.created - a.created);
    res.status(200).json({ promos });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
}

async function createPromo(req, res, caller){
  const { percentOff, duration, durationInMonths, maxRedemptions, code } = req.body || {};
  const pct = Number(percentOff);
  if (!pct || pct < 1 || pct > 100) { res.status(400).json({ error: 'percentOff must be between 1 and 100' }); return; }
  if (!['once', 'repeating', 'forever'].includes(duration)) { res.status(400).json({ error: 'Invalid duration' }); return; }
  if (duration === 'repeating' && (!durationInMonths || Number(durationInMonths) < 1)) {
    res.status(400).json({ error: 'durationInMonths required for repeating duration' }); return;
  }
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }
  try {
    const couponParams = { percent_off: pct, duration, name: `Pokelo admin — ${pct}% (${duration})` };
    if (duration === 'repeating') couponParams.duration_in_months = Number(durationInMonths);
    if (maxRedemptions) couponParams.max_redemptions = Number(maxRedemptions);
    const coupon = await stripeRequest('coupons', STRIPE_SECRET_KEY, couponParams);

    const promoParams = { coupon: coupon.id };
    if (code && String(code).trim()) promoParams.code = String(code).trim().toUpperCase();
    const promo = await stripeRequest('promotion_codes', STRIPE_SECRET_KEY, promoParams);

    console.log(`[admin-promos:create] ${caller.email} a créé le code ${promo.code} (${pct}%, ${duration})`);
    res.status(200).json({ code: promo.code, couponId: coupon.id, percentOff: pct, duration });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
}

async function deactivatePromo(req, res, caller){
  const { id } = req.body || {};
  if (!id || typeof id !== 'string' || !id.startsWith('promo_')) { res.status(400).json({ error: 'Missing or invalid promotion code id' }); return; }
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }
  try {
    const promo = await stripeRequest(`promotion_codes/${id}`, STRIPE_SECRET_KEY, { active: false });
    console.log(`[admin-promos:deactivate] ${caller.email} a désactivé le code ${promo.code}`);
    res.status(200).json({ ok: true, code: promo.code });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
}

module.exports = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (req.method === 'GET') { await listPromos(req, res); return; }
  if (req.method === 'POST') {
    const action = (req.body || {}).action;
    if (action === 'deactivate') { await deactivatePromo(req, res, caller); return; }
    if (action === 'create') { await createPromo(req, res, caller); return; }
    res.status(400).json({ error: 'Missing or invalid action' });
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
};
