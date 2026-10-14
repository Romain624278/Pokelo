const test = require('node:test');
const assert = require('node:assert/strict');
const { monthStartMs, nextMonthStartMs, countSessionsInMonth, computeSessionQuota, splitDuration } = require('../js/quota.js');

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0).getTime();

test('monthStartMs / nextMonthStartMs encadrent le mois courant', () => {
  const ref = at(2026, 10, 14);
  assert.equal(monthStartMs(ref), new Date(2026, 9, 1).getTime());
  assert.equal(nextMonthStartMs(ref), new Date(2026, 10, 1).getTime());
});

test('nextMonthStartMs bascule sur janvier en décembre', () => {
  assert.equal(nextMonthStartMs(at(2026, 12, 31, 23)), new Date(2027, 0, 1).getTime());
});

test('countSessionsInMonth ne compte que les sessions saisies dans le mois', () => {
  const ref = at(2026, 10, 14);
  const sessions = [
    { createdAt: at(2026, 9, 30, 23) },
    { createdAt: at(2026, 10, 1, 0) },
    { createdAt: at(2026, 10, 20) },
    { createdAt: at(2026, 11, 1, 0) },
  ];
  assert.equal(countSessionsInMonth(sessions, ref), 2);
});

test('countSessionsInMonth ignore les sessions de démonstration et tolère une liste vide', () => {
  const ref = at(2026, 10, 14);
  assert.equal(countSessionsInMonth([{ createdAt: at(2026, 10, 2), demo: true }], ref), 0);
  assert.equal(countSessionsInMonth([], ref), 0);
  assert.equal(countSessionsInMonth(undefined, ref), 0);
});

test('computeSessionQuota : restant, blocage et date de déblocage', () => {
  const ref = at(2026, 10, 14);
  const make = n => Array.from({ length: n }, (_, i) => ({ createdAt: at(2026, 10, 1 + (i % 20)) }));
  const open = computeSessionQuota(make(9), 10, ref);
  assert.equal(open.used, 9);
  assert.equal(open.remaining, 1);
  assert.equal(open.blocked, false);
  const full = computeSessionQuota(make(10), 10, ref);
  assert.equal(full.blocked, true);
  assert.equal(full.remaining, 0);
  assert.equal(full.resetAtMs, new Date(2026, 10, 1).getTime());
  const over = computeSessionQuota(make(14), 10, ref);
  assert.equal(over.blocked, true);
  assert.equal(over.remaining, 0);
});

test('splitDuration décompose une durée et ne descend jamais sous zéro', () => {
  assert.deepEqual(splitDuration(((2 * 24 + 3) * 60 + 4) * 60 * 1000 + 5000), { days: 2, hours: 3, minutes: 4, seconds: 5 });
  assert.deepEqual(splitDuration(-500), { days: 0, hours: 0, minutes: 0, seconds: 0 });
});

test('réinitialisation admin : seules les sessions saisies après la date comptent', () => {
  const ref = at(2026, 10, 14);
  const sessions = Array.from({ length: 10 }, (_, i) => ({ createdAt: at(2026, 10, 2 + i) }));
  assert.equal(computeSessionQuota(sessions, 10, ref).blocked, true);
  const reset = at(2026, 10, 9, 13); // sessions des 10 et 11 octobre seulement
  const after = computeSessionQuota(sessions, 10, ref, reset);
  assert.equal(after.blocked, false);
  assert.equal(after.used, 2);
  const withNew = computeSessionQuota(sessions.concat([{ createdAt: at(2026, 10, 14) }]), 10, ref, reset);
  assert.equal(withNew.used, 3);
});

test("une réinitialisation d'un mois précédent n'a aucun effet sur le mois courant", () => {
  const ref = at(2026, 10, 14);
  const sessions = Array.from({ length: 10 }, (_, i) => ({ createdAt: at(2026, 10, 2 + i) }));
  assert.equal(computeSessionQuota(sessions, 10, ref, at(2026, 9, 5)).blocked, true);
});
