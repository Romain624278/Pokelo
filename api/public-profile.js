// Vercel Serverless Function — expose un profil public en lecture seule.
// N'utilise JAMAIS la clé publishable côté client pour ça : les policies RLS sur
// `profiles` restreignent la lecture à `auth.uid() = id`, donc un visiteur anonyme
// ne peut lire aucun profil (même public) sans passer par ici. Cette fonction
// utilise la clé service_role côté serveur mais ne renvoie jamais l'email ni
// aucune donnée financière — uniquement display_name / avatar_url / created_at,
// et seulement si is_public = true.
module.exports = async (req, res) => {
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const userId = req.query.id;
  if (!userId) { res.status(400).json({ error: 'Missing id' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  try {
    const url = `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&is_public=is.true&select=display_name,avatar_url,created_at`;
    const profileRes = await fetch(url, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    const body = await profileRes.json();
    if (!profileRes.ok) {
      // Erreur Postgrest (ex. colonne is_public/display_name/avatar_url absente
      // si la migration SQL du §6 de SUPABASE_SETUP.md n'a pas été exécutée) —
      // journalisée ici plutôt que silencieusement traitée comme "introuvable".
      console.error('public-profile: Postgrest error', body);
      res.status(502).json({ error: 'Upstream error', detail: body });
      return;
    }
    const row = Array.isArray(body) ? body[0] : null;
    if (!row) { res.status(404).json({ error: 'Not found' }); return; }

    // avatar_url doit toujours être une data URL image générée côté client
    // (canvas.toDataURL) — la policy RLS ne protège que par propriétaire, pas
    // par contenu, donc on revalide ici avant de la renvoyer à des visiteurs
    // anonymes pour ne jamais republier une valeur arbitraire écrite en base.
    const isSafeAvatarUrl = typeof row.avatar_url === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(row.avatar_url);

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json({
      displayName: row.display_name || '',
      avatarUrl: isSafeAvatarUrl ? row.avatar_url : '',
      createdAt: row.created_at || null,
    });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', detail: String(e && e.message || e) });
  }
};
