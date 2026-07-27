// Vercel Serverless Function — liste les codes promotionnels Stripe créés
// depuis le panneau admin, pour affichage/suppression dans #/app/admin.
// Réservé au rôle admin, revérifié côté serveur.
const { stripeGet, getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !STRIPE_SECRET_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    // limit=100 : largement suffisant pour un usage "offrir des mois à des
    // amis" — pas de pagination pour rester simple, à revoir si le volume
    // de codes créés grossit un jour significativement.
    // promotion_code.coupon est déjà un objet Coupon complet par défaut chez
    // Stripe (pas une référence à développer), pas besoin de paramètre expand.
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
};
