// Vercel Serverless Function — statistiques de parrainage de l'utilisateur connecté.
// Ne passe jamais par le client Supabase directement : les policies RLS actuelles
// (auth.uid() = id) empêchent un utilisateur de lire les lignes `profiles` d'autrui,
// même pour un simple comptage — cette fonction utilise donc la clé service_role
// et ne renvoie que des nombres, jamais les lignes elles-mêmes (email, etc.).
const { getSupabaseUser } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const user = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!user) { res.status(401).json({ error: 'Invalid or expired session' }); return; }

    const referredRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=referral_reward_claimed&referred_by_user_id=eq.${user.id}`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!referredRes.ok) throw new Error('Supabase query failed');
    const referred = await referredRes.json();
    const totalReferred = referred.length;
    const rewardsGiven = referred.filter(r => r.referral_reward_claimed).length;

    res.status(200).json({ totalReferred, rewardsGiven });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
};
