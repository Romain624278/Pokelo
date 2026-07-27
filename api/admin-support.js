// Vercel Serverless Function — liste et met à jour le statut des messages de
// support depuis le panneau admin. Regroupées dans un seul fichier (au lieu
// de 2 endpoints séparés) pour rester sous la limite de 12 fonctions
// serverless du plan Hobby Vercel. Réservé au rôle admin, revérifié côté
// serveur à chaque appel.
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

module.exports = async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    if (req.method === 'GET') {
      const listRes = await fetch(`${SUPABASE_URL}/rest/v1/support_messages?select=*&order=created_at.desc&limit=200`, {
        headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      });
      if (!listRes.ok) throw new Error('Supabase query failed');
      const messages = await listRes.json();
      res.status(200).json({ messages });
      return;
    }

    if (req.method === 'POST') {
      const { id, status } = req.body || {};
      if (!id || (status !== 'new' && status !== 'read')) { res.status(400).json({ error: 'Missing or invalid id/status' }); return; }
      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/support_messages?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json', Prefer: 'return=minimal',
        },
        body: JSON.stringify({ status }),
      });
      if (!updateRes.ok) throw new Error('Supabase update failed');
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
};
