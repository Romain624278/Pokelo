const test = require('node:test');
const assert = require('node:assert/strict');
const {
  uid, todayStr, escapeHtml, csvEscape, mulberry32, sessionProfit, fmtNum, fmtMoney, fmtSigned,
} = require('../js/pure-utils.js');

test('uid produces unique, non-empty ids', () => {
  const a = uid();
  const b = uid();
  assert.notEqual(a, b);
  assert.match(a, /^[a-z0-9]+$/);
});

test('todayStr returns an ISO date (YYYY-MM-DD)', () => {
  assert.match(todayStr(), /^\d{4}-\d{2}-\d{2}$/);
});

test('escapeHtml escapes all five special characters', () => {
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
});

test('escapeHtml treats null/undefined as empty string', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('csvEscape quotes fields containing comma, quote, semicolon or newline', () => {
  assert.equal(csvEscape('Winamax'), 'Winamax');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('a;b'), '"a;b"');
  assert.equal(csvEscape('line1\nline2'), '"line1\nline2"');
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""');
});

test('csvEscape treats null/undefined as empty string', () => {
  assert.equal(csvEscape(null), '');
  assert.equal(csvEscape(undefined), '');
});

test('mulberry32 is deterministic for a given seed', () => {
  const rand1 = mulberry32(42);
  const rand2 = mulberry32(42);
  const seq1 = [rand1(), rand1(), rand1()];
  const seq2 = [rand2(), rand2(), rand2()];
  assert.deepEqual(seq1, seq2);
  seq1.forEach(v => { assert.ok(v >= 0 && v < 1); });
});

test('mulberry32 produces different sequences for different seeds', () => {
  const a = mulberry32(1)();
  const b = mulberry32(2)();
  assert.notEqual(a, b);
});

test('sessionProfit computes (cashout - buyIn) * fxRate, rounded to cents', () => {
  assert.equal(sessionProfit({ buyIn: 50, cashout: 120, fxRate: 1 }), 70);
  assert.equal(sessionProfit({ buyIn: 50, cashout: 120, fxRate: null }), 70); // fxRate null => defaults to 1
  assert.equal(sessionProfit({ buyIn: 10, cashout: 0, fxRate: 0.92 }), -9.2);
  assert.equal(sessionProfit({ buyIn: 33.333, cashout: 66.666, fxRate: 1 }), 33.33);
});

test('fmtNum formats with exactly 2 decimals, French locale grouping', () => {
  assert.equal(fmtNum(1234.5), '1 234,50');
  assert.equal(fmtNum(0), '0,00');
});

test('fmtMoney appends the currency after the formatted number', () => {
  assert.equal(fmtMoney(10, 'EUR'), '10,00 EUR');
});

test('fmtSigned prefixes a plus sign for zero/positive amounts only', () => {
  assert.equal(fmtSigned(10, 'EUR'), '+10,00 EUR');
  assert.equal(fmtSigned(0, 'EUR'), '+0,00 EUR');
  assert.equal(fmtSigned(-10, 'EUR'), '-10,00 EUR');
});
