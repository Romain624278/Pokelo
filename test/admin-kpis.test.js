const test = require('node:test');
const assert = require('node:assert/strict');
const { computeKpis } = require('../api/_admin-kpis.js');

const NOW = new Date(2026, 9, 14, 12, 0, 0).getTime(); // 14 oct. 2026
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();

function sample(){
  const profiles = [
    { id: 'u1', plan: 'free', created_at: daysAgo(2) },
    { id: 'u2', plan: 'pro', created_at: daysAgo(20), stripe_customer_id: 'cus_1' },
    { id: 'u3', plan: 'pro', created_at: daysAgo(90) },                        // attribué manuellement
    { id: 'u4', plan: 'free', created_at: daysAgo(60), referral_reward_claimed: true },
  ];
  const bankrolls = [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u2' }];
  const sessions = [];
  for (let i = 0; i < 11; i++) sessions.push({ user_id: 'u1', created_at: new Date(NOW - 3600000 * (i + 1)).toISOString() });
  for (let i = 0; i < 2; i++) sessions.push({ user_id: 'u2', created_at: daysAgo(40) });
  return { profiles, bankrolls, sessions };
}

test('MRR estimé : seuls les abonnés avec client Stripe comptent, 9,90 € chacun', () => {
  const k = computeKpis({ ...sample(), nowMs: NOW });
  assert.equal(k.proCount, 2);
  assert.equal(k.payingPro, 1);
  assert.equal(k.grantedPro, 1);
  assert.equal(k.mrrEstimate, 9.9);
  assert.equal(k.conversionPct, 50);
});

test('inscriptions 7 j / 30 j et série de 30 jours', () => {
  const k = computeKpis({ ...sample(), nowMs: NOW });
  assert.equal(k.signups7d, 1);
  assert.equal(k.signups30d, 2);
  assert.equal(k.signupSeries.length, 30);
  assert.equal(k.signupSeries.reduce((s, d) => s + d.count, 0), 2);
  assert.equal(k.referralRewardsGiven, 1);
});

test('activation : bankroll, session, 5 sessions', () => {
  const k = computeKpis({ ...sample(), nowMs: NOW });
  assert.equal(k.activation.withBankroll, 2);
  assert.equal(k.activation.withSession, 2);
  assert.equal(k.activation.withFiveSessions, 1);
  assert.equal(k.activation.withSessionPct, 50);
});

test('quota : seuls les comptes gratuits à 10+ sessions ce mois-ci sont bloqués', () => {
  const k = computeKpis({ ...sample(), nowMs: NOW });
  assert.equal(k.quotaBlocked, 1);
  assert.equal(k.sessions30d, 11);
});

test('connexions : calculées depuis last_sign_in_at, signalées indisponibles sinon', () => {
  const authUsers = [
    { id: 'u1', last_sign_in_at: daysAgo(1) },
    { id: 'u2', last_sign_in_at: daysAgo(15) },
    { id: 'u3', last_sign_in_at: null },
  ];
  const k = computeKpis({ ...sample(), authUsers, nowMs: NOW });
  assert.equal(k.active.signedIn7d, 1);
  assert.equal(k.active.signedIn30d, 2);
  assert.equal(k.active.authAvailable, true);
  const without = computeKpis({ ...sample(), nowMs: NOW });
  assert.equal(without.active.authAvailable, false);
});

test('base vide : aucun NaN ni division par zéro', () => {
  const k = computeKpis({ profiles: [], bankrolls: [], sessions: [], nowMs: NOW });
  assert.equal(k.totalUsers, 0);
  assert.equal(k.conversionPct, 0);
  assert.equal(k.mrrEstimate, 0);
  assert.equal(k.activation.withSessionPct, 0);
});
