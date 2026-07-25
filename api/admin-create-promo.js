// Vercel Serverless Function — crée un coupon + code promotionnel Stripe
// depuis le panneau admin (offrir des mois de Pokelo Pro à un ami). Réservé
// au rôle admin, revérifié côté serveur. Le code créé fonctionne directement
// au Checkout grâce à allow_promotion_codes (voir create-checkout-session.js).
const { stripeRequest, getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const { percentOff, duration, durationInMonths, maxRedemptions, code } = req.body || {};
  const pct = Number(percentOff);
  if (!pct || pct < 1 || pct > 100) { res.status(400).json({ error: 'percentOff must be between 1 and 100' }); return; }
  if (!['once', 'repeating', 'forever'].includes(duration)) { res.status(400).json({ error: 'Invalid duration' }); return; }
  if (duration === 'repeating' && (!durationInMonths || Number(durationInMonths) < 1)) {
    res.status(400).json({ error: 'durationInMonths required for repeating duration' }); return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    const couponParams = { percent_off: pct, duration, name: `Pokelo admin — ${pct}% (${duration})` };
    if (duration === 'repeating') couponParams.duration_in_months = Number(durationInMonths);
    if (maxRedemptions) couponParams.max_redemptions = Number(maxRedemptions);
    const coupon = await stripeRequest('coupons', STRIPE_SECRET_KEY, couponParams);

    const promoParams = { coupon: coupon.id };
    if (code && String(code).trim()) promoParams.code = String(code).trim().toUpperCase();
    const promo = await stripeRequest('promotion_codes', STRIPE_SECRET_KEY, promoParams);

    console.log(`[admin-create-promo] ${caller.email} a créé le code ${promo.code} (${pct}%, ${duration})`);
    res.status(200).json({ code: promo.code, couponId: coupon.id, percentOff: pct, duration });
  } catch (e) {
    res.status(502).json({ error: 'Stripe error', detail: String(e && e.message || e) });
  }
};
