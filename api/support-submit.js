// Vercel Serverless Function — reçoit un message envoyé depuis le formulaire
// de contact (mini QCM + message libre), accessible avec ou sans compte.
// Stocke en base (table support_messages, voir SUPABASE_SETUP.md §14) plutôt
// que d'envoyer un email — décision produit : suivi centralisé depuis le
// panneau admin plutôt que dépendre d'un fournisseur d'emails transactionnels.
const { getSupabaseUser } = require('./_stripe-helpers');

const ALLOWED_CATEGORIES = new Set(['bug', 'billing', 'suggestion', 'other']);

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { res.status(500).json({ error: 'Server misconfigured' }); return; }

  const { category, message, email } = req.body || {};
  if (!category || !ALLOWED_CATEGORIES.has(category)) { res.status(400).json({ error: 'Invalid category' }); return; }
  const trimmedMessage = typeof message === 'string' ? message.trim() : '';
  if (!trimmedMessage || trimmedMessage.length > 4000) { res.status(400).json({ error: 'Invalid message' }); return; }

  try {
    // Si l'utilisateur est connecté (jeton fourni), on rattache le message à
    // son compte et on utilise son email réel plutôt que celui saisi dans le
    // formulaire (qui pourrait être usurpé) — sinon on accepte un email de
    // contact facultatif pour un visiteur anonyme.
    let userId = null;
    let resolvedEmail = typeof email === 'string' ? email.trim().slice(0, 200) : null;
    const authHeader = req.headers.authorization || '';
    const accessToken = authHeader.replace(/^Bearer\s+/i, '');
    if (accessToken) {
      const user = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
      if (user) { userId = user.id; resolvedEmail = user.email; }
    }

    const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/support_messages`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json', Prefer: 'return=minimal',
      },
      body: JSON.stringify({ user_id: userId, email: resolvedEmail, category, message: trimmedMessage }),
    });
    if (!insertRes.ok) {
      const detail = await insertRes.text();
      console.error('support-submit: insert failed', detail);
      res.status(502).json({ error: 'Upstream error' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', detail: String(e && e.message || e) });
  }
};
