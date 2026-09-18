// Vercel Serverless Function — modération des avis publics laissés par les
// utilisateurs (voir table `reviews`, SUPABASE_SETUP.md). Réservé au rôle
// admin, revérifié côté serveur. La soumission elle-même et la lecture des
// avis déjà approuvés (page d'accueil) passent directement par le client
// Supabase (RLS), jamais par ici — cette fonction ne sert qu'à voir les avis
// en attente et à les valider/rejeter.
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

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

async function listReviews(req, res){
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const listRes = await fetch(
      `${SUPABASE_URL}/rest/v1/reviews?select=id,user_id,rating,text,display_name,status,created_at&order=created_at.desc&limit=200`,
      { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
    );
    if (!listRes.ok) throw new Error('Supabase query failed');
    const reviews = await listRes.json();
    res.status(200).json({ reviews });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
}

async function setReviewStatus(req, res, caller){
  const { id, status } = req.body || {};
  if (!id || !['pending', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: 'Missing or invalid id/status' });
    return;
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/reviews?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ status }),
    });
    if (!updateRes.ok) throw new Error('Supabase update failed');
    console.log(`[admin-reviews] ${caller.email} a mis l'avis ${id} au statut "${status}"`);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: 'Update failed', detail: String(e && e.message || e) });
  }
}

module.exports = async (req, res) => {
  const caller = await requireAdmin(req, res);
  if (!caller) return;

  if (req.method === 'GET') { await listReviews(req, res); return; }
  if (req.method === 'POST') { await setReviewStatus(req, res, caller); return; }
  res.status(405).json({ error: 'Method not allowed' });
};
