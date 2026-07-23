// Vercel Serverless Function — suppression définitive d'un compte (RGPD, droit à l'effacement).
// Nécessite deux variables d'environnement côté serveur (Vercel → Settings → Environment Variables) :
//   SUPABASE_URL               = https://uaeurizcwiaxrwcfwehm.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  = clé "service_role" (secrète, jamais exposée côté client)
//
// La clé service_role est nécessaire ici car supprimer un utilisateur auth.users requiert
// l'API Admin de Supabase, inaccessible avec la clé publishable utilisée dans index.html.
// Le token reçu dans l'en-tête Authorization est d'abord vérifié auprès de Supabase pour en
// extraire l'ID utilisateur réel : un appelant ne peut donc jamais supprimer un autre compte
// que le sien, quoi qu'il envoie.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) {
    res.status(401).json({ error: 'Missing access token' });
    return;
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    res.status(500).json({ error: 'Server misconfigured: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' });
    return;
  }

  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${accessToken}` },
    });
    if (!userRes.ok) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    const user = await userRes.json();
    if (!user || !user.id) {
      res.status(401).json({ error: 'Invalid session' });
      return;
    }

    const deleteRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!deleteRes.ok) {
      const detail = await deleteRes.text();
      res.status(502).json({ error: 'Deletion failed', detail });
      return;
    }

    // profiles/bankrolls/sessions sont supprimés automatiquement (ON DELETE CASCADE
    // vers auth.users dans le schéma SQL) — aucun nettoyage manuel de table nécessaire ici.
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', detail: String(e && e.message || e) });
  }
};
