// Vercel Serverless Function — formulaire de contact public (soumission) et
// gestion des messages depuis le panneau admin (liste, statut). Regroupées
// dans un seul fichier (au lieu de 2 endpoints séparés, anciennement
// support-submit.js + admin-support.js) pour rester sous la limite de 12
// fonctions serverless du plan Hobby Vercel — une soumission publique n'a
// jamais de rôle admin à vérifier, donc les deux chemins restent isolés l'un
// de l'autre malgré le fichier commun (pas de garde partagée entre les deux).
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

const ALLOWED_CATEGORIES = new Set(['bug', 'billing', 'suggestion', 'other']);

async function submitPublic(req, res){
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
      console.error('support:submit failed', detail);
      res.status(502).json({ error: 'Upstream error' });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Unexpected error', detail: String(e && e.message || e) });
  }
}

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

async function listMessages(req, res){
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    const listRes = await fetch(`${SUPABASE_URL}/rest/v1/support_messages?select=*&order=created_at.desc&limit=200`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (!listRes.ok) throw new Error('Supabase query failed');
    const messages = await listRes.json();
    res.status(200).json({ messages });
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
}

async function updateStatus(req, res){
  const { id, status } = req.body || {};
  if (!id || (status !== 'new' && status !== 'read')) { res.status(400).json({ error: 'Missing or invalid id/status' }); return; }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
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
  } catch (e) {
    res.status(502).json({ error: 'Query failed', detail: String(e && e.message || e) });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const caller = await requireAdmin(req, res);
    if (!caller) return;
    await listMessages(req, res);
    return;
  }
  if (req.method === 'POST') {
    const action = (req.body || {}).action;
    if (action === 'update-status') {
      const caller = await requireAdmin(req, res);
      if (!caller) return;
      await updateStatus(req, res);
      return;
    }
    // Pas d'action reconnue : c'est une soumission publique du formulaire de
    // contact, jamais une opération admin — aucune vérification de rôle ici.
    await submitPublic(req, res);
    return;
  }
  res.status(405).json({ error: 'Method not allowed' });
};
