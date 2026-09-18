// Vercel Serverless Function — relance par e-mail des comptes inactifs
// (déclenchée par le cron défini dans vercel.json) + désinscription en un
// clic depuis le lien de l'e-mail (aucune connexion requise, jeton HMAC).
// Regroupées dans un seul fichier pour rester sous la limite de 12 fonctions
// serverless du plan Hobby Vercel.
// Variables d'environnement requises : RESEND_API_KEY, CRON_SECRET,
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — voir EMAIL_SETUP.md.
const crypto = require('crypto');
const { getSupabaseUser, fetchProfileFields } = require('./_stripe-helpers');

// Pas de relance avant 7 jours d'inactivité (laisse le temps à un joueur
// occasionnel de revenir de lui-même), et jamais plus d'une relance tous les
// 14 jours même si l'inactivité se prolonge — un rappel hebdomadaire sans fin
// est plus agaçant qu'utile et abîme la délivrabilité (plaintes spam).
const INACTIVITY_DAYS = 7;
const RESEND_THROTTLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function unsubscribeToken(userId, secret){
  return crypto.createHmac('sha256', secret).update(userId).digest('hex');
}

async function sendEmail(apiKey, to, subject, html){
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'Pokelo <notifications@pokelo.fr>', to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(detail || 'Resend request failed');
  }
  return res.json();
}

// Même gabarit visuel que supabase/email-templates/*.html (fond clair, en-tête
// sombre avec le logo, bouton vert) pour rester cohérent avec les e-mails
// d'authentification déjà envoyés par Supabase.
function reminderEmailHtml(displayName, days, unsubscribeUrl){
  const greeting = displayName ? `Salut ${displayName},` : 'Salut,';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f4;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
  <tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr><td style="background:#0d1210;padding:28px 32px;text-align:center;">
        <img src="https://www.pokelo.fr/icons/icon-192.png" width="40" height="40" alt="Pokelo" style="display:block;margin:0 auto 10px;border-radius:8px;" />
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:.02em;">Pokelo</span>
      </td></tr>
      <tr><td style="padding:36px 32px;">
        <h1 style="margin:0 0 16px;font-size:20px;color:#111827;">On ne vous voit plus 👋</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#374151;">
          ${greeting} ça fait ${days} jours que vous n'avez pas enregistré de session sur Pokelo. Prenez 30 secondes pour garder votre suivi à jour — c'est la régularité qui rend les statistiques utiles.
        </p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
          <tr><td style="border-radius:8px;background:#08BF2F;">
            <a href="https://www.pokelo.fr/app/sessions" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0d1210;text-decoration:none;">
              Ajouter ma dernière session
            </a>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
          Pokelo — <a href="https://www.pokelo.fr" style="color:#9ca3af;">pokelo.fr</a> ·
          <a href="${unsubscribeUrl}" style="color:#9ca3af;">Ne plus recevoir ces rappels</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}

async function runCron(req, res){
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !CRON_SECRET) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }

  const headers = { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` };
  const [profilesRes, sessionsRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id,email,display_name,created_at,reengagement_emails_enabled,last_reengagement_sent_at`, { headers }),
    // select=user_id,date seulement : pas besoin du reste de la ligne pour
    // calculer la dernière activité par utilisateur (même logique d'agrégation
    // en JS que api/admin-stats.js, cohérent avec le reste du projet).
    fetch(`${SUPABASE_URL}/rest/v1/sessions?select=user_id,date`, { headers }),
  ]);
  if (!profilesRes.ok || !sessionsRes.ok) { res.status(502).json({ error: 'Supabase query failed' }); return; }
  const profiles = await profilesRes.json();
  const sessions = await sessionsRes.json();

  const lastSessionByUser = {};
  sessions.forEach(s => {
    if (!lastSessionByUser[s.user_id] || s.date > lastSessionByUser[s.user_id]) lastSessionByUser[s.user_id] = s.date;
  });

  const now = Date.now();
  const sent = [];
  const errors = [];
  for (const p of profiles) {
    if (p.reengagement_emails_enabled === false) continue;
    if (!p.email) continue;
    const lastSent = p.last_reengagement_sent_at ? new Date(p.last_reengagement_sent_at).getTime() : 0;
    if (now - lastSent < RESEND_THROTTLE_DAYS * DAY_MS) continue;
    const lastActivity = lastSessionByUser[p.id] ? new Date(lastSessionByUser[p.id]).getTime() : new Date(p.created_at).getTime();
    const daysSince = Math.floor((now - lastActivity) / DAY_MS);
    if (daysSince < INACTIVITY_DAYS) continue;

    const token = unsubscribeToken(p.id, CRON_SECRET);
    const unsubscribeUrl = `https://www.pokelo.fr/api/reengagement?unsubscribe=${encodeURIComponent(p.id)}&token=${token}`;
    try {
      await sendEmail(RESEND_API_KEY, p.email, 'On ne vous voit plus sur Pokelo', reminderEmailHtml(p.display_name, daysSince, unsubscribeUrl));
      await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${p.id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ last_reengagement_sent_at: new Date().toISOString() }),
      });
      sent.push(p.email);
    } catch (e) {
      console.error('reengagement: send failed for', p.email, e);
      errors.push({ email: p.email, error: String(e && e.message || e) });
    }
  }
  res.status(200).json({ checked: profiles.length, sent: sent.length, errors });
}

async function handleUnsubscribe(req, res){
  const { unsubscribe: userId, token } = req.query || {};
  const CRON_SECRET = process.env.CRON_SECRET;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fail = () => { res.status(400).setHeader('Content-Type', 'text/html; charset=utf-8').send('<p>Lien de désinscription invalide ou expiré.</p>'); };
  if (!userId || !token || !CRON_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) { fail(); return; }

  const expected = unsubscribeToken(String(userId), CRON_SECRET);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { fail(); return; }

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(String(userId))}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json', Prefer: 'return=minimal',
    },
    body: JSON.stringify({ reengagement_emails_enabled: false }),
  });

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:Arial,Helvetica,sans-serif;text-align:center;padding:60px 20px;background:#f4f5f4;color:#111827;">
    <h2>Désinscription confirmée</h2>
    <p>Vous ne recevrez plus de rappels par e-mail de Pokelo. Vous pouvez réactiver ces rappels à tout moment depuis les paramètres de votre compte.</p>
    <a href="https://www.pokelo.fr" style="color:#08BF2F;">Retour à Pokelo</a>
  </body></html>`);
}

// Depuis le panneau admin : envoie le même e-mail de relance à l'admin
// connecté lui-même, sans vérifier inactivité ni throttle (c'est un test
// délibéré) — jamais à un email arbitraire fourni par le client, toujours
// celui du compte authentifié.
async function sendTestToSelf(req, res){
  const authHeader = req.headers.authorization || '';
  const accessToken = authHeader.replace(/^Bearer\s+/i, '');
  if (!accessToken) { res.status(401).json({ error: 'Missing access token' }); return; }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const CRON_SECRET = process.env.CRON_SECRET;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !RESEND_API_KEY || !CRON_SECRET) {
    res.status(500).json({ error: 'Server misconfigured' });
    return;
  }
  try {
    const caller = await getSupabaseUser(SUPABASE_URL, SERVICE_ROLE_KEY, accessToken);
    if (!caller) { res.status(401).json({ error: 'Invalid or expired session' }); return; }
    const callerProfile = await fetchProfileFields(SUPABASE_URL, SERVICE_ROLE_KEY, caller.id, 'role,display_name');
    if (!callerProfile || callerProfile.role !== 'admin') { res.status(403).json({ error: 'Forbidden' }); return; }

    const token = unsubscribeToken(caller.id, CRON_SECRET);
    const unsubscribeUrl = `https://www.pokelo.fr/api/reengagement?unsubscribe=${encodeURIComponent(caller.id)}&token=${token}`;
    await sendEmail(RESEND_API_KEY, caller.email, '[Test] On ne vous voit plus sur Pokelo', reminderEmailHtml(callerProfile.display_name, 7, unsubscribeUrl));
    res.status(200).json({ ok: true, email: caller.email });
  } catch (e) {
    res.status(502).json({ error: 'Send failed', detail: String(e && e.message || e) });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const action = (req.body || {}).action;
    if (action === 'send-test') { await sendTestToSelf(req, res); return; }
    res.status(400).json({ error: 'Missing or invalid action' });
    return;
  }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  if (req.query && req.query.unsubscribe) { await handleUnsubscribe(req, res); return; }

  // Déclenché par Vercel Cron (voir vercel.json) : Vercel ajoute
  // automatiquement `Authorization: Bearer $CRON_SECRET` sur ces requêtes
  // quand la variable d'environnement CRON_SECRET est définie — un appelant
  // externe ne peut pas deviner cette valeur.
  const authHeader = req.headers.authorization || '';
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  await runCron(req, res);
};
