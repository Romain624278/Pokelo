// Petits utilitaires partagés par les fonctions Stripe — pas de dépendance npm,
// tout passe par l'API REST de Stripe en fetch().
const crypto = require('crypto');

function toFormUrlEncoded(obj, prefix){
  const pairs = [];
  Object.keys(obj).forEach((key) => {
    const value = obj[key];
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === undefined || value === null) return;
    if (typeof value === 'object' && !Array.isArray(value)) {
      pairs.push(...toFormUrlEncoded(value, fullKey).split('&').filter(Boolean));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          pairs.push(...toFormUrlEncoded(item, `${fullKey}[${i}]`).split('&').filter(Boolean));
        } else {
          pairs.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      pairs.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`);
    }
  });
  return pairs.join('&');
}

async function stripeRequest(path, secretKey, params){
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toFormUrlEncoded(params),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || 'Stripe request failed');
    err.stripeError = data.error;
    throw err;
  }
  return data;
}

async function stripeGet(path, secretKey){
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error((data.error && data.error.message) || 'Stripe request failed');
    err.stripeError = data.error;
    throw err;
  }
  return data;
}

async function getSupabaseUser(supabaseUrl, serviceRoleKey, accessToken){
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user && user.id ? user : null;
}

// Lecture minimale d'un profil (clé service_role, contourne RLS) — utilisé par
// la logique de parrainage (create-checkout-session.js, stripe-webhook.js).
async function fetchProfileFields(supabaseUrl, serviceRoleKey, userId, fields){
  const res = await fetch(`${supabaseUrl}/rest/v1/profiles?select=${fields}&id=eq.${userId}`, {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] || null;
}

// Journalise une erreur serveur sur un chemin sensible (webhook Stripe,
// checkout, crédit de parrainage) — jamais bloquant : une erreur ici est
// avalée pour ne jamais faire échouer l'appelant à cause du logging lui-même.
// Consultable uniquement via api/admin-stats.js (réservé au rôle admin).
async function logServerError(supabaseUrl, serviceRoleKey, source, message, context, userId){
  try {
    await fetch(`${supabaseUrl}/rest/v1/error_logs`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ source, message: String(message).slice(0, 2000), context: context || null, user_id: userId || null }),
    });
  } catch (e) { /* ne jamais faire échouer l'appelant à cause du logging */ }
}

function verifyStripeSignature(rawBody, sigHeader, secret, toleranceSeconds){
  if (!sigHeader) return false;
  const parts = sigHeader.split(',').reduce((acc, part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return acc;
    acc[part.slice(0, idx)] = part.slice(idx + 1);
    return acc;
  }, {});
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const sigBuffer = Buffer.from(signature, 'utf8');
  const expBuffer = Buffer.from(expected, 'utf8');
  if (sigBuffer.length !== expBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expBuffer)) return false;
  // Rejette un webhook signé mais rejoué tel quel bien plus tard (une requête
  // interceptée puis renvoyée des heures après reste, sinon, valide pour
  // toujours puisque la signature ne dépend que du corps et du timestamp qu'il
  // contient). Tolérance de 5 min par défaut, comme recommandé par Stripe.
  const toleranceMs = (toleranceSeconds || 300) * 1000;
  if (Math.abs(Date.now() - Number(timestamp) * 1000) > toleranceMs) return false;
  return true;
}

function getRawBody(req){
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

module.exports = { stripeRequest, stripeGet, getSupabaseUser, fetchProfileFields, logServerError, verifyStripeSignature, getRawBody };
