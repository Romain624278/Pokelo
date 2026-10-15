const test = require('node:test');
const assert = require('node:assert/strict');
const { safeOrigin } = require('../api/_stripe-helpers.js');

const req = origin => ({ headers: origin === undefined ? {} : { origin } });

test('safeOrigin accepte le site officiel, ses aperçus Vercel et localhost', () => {
  assert.equal(safeOrigin(req('https://www.pokelo.fr')), 'https://www.pokelo.fr');
  assert.equal(safeOrigin(req('https://pokelo.fr')), 'https://pokelo.fr');
  assert.equal(safeOrigin(req('https://pokelo-git-main-romain.vercel.app')), 'https://pokelo-git-main-romain.vercel.app');
  assert.equal(safeOrigin(req('http://localhost:3000')), 'http://localhost:3000');
});

test('safeOrigin ramène toute autre origine au site officiel', () => {
  for (const evil of ['https://evil.example', 'https://www.pokelo.fr.evil.example', 'http://www.pokelo.fr', 'https://pokelo.fr@evil.example', 'javascript:alert(1)', '']) {
    assert.equal(safeOrigin(req(evil)), 'https://www.pokelo.fr', evil);
  }
  assert.equal(safeOrigin(req(undefined)), 'https://www.pokelo.fr');
});
