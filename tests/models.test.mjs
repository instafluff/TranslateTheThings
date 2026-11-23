import test from 'node:test';
import assert from 'node:assert/strict';
import { MODES, NLLB_CODES, supportedByMode } from '../src/models.js';
import { LANGUAGES } from '../src/languages.js';

test('Everyday is the small model, premium stays opt-in', () => {
  assert.equal(MODES.everyday.name, 'NLLB-200');
  assert.equal(MODES.premium.name, 'TranslateGemma');
  assert.ok(MODES.everyday.approximateBytes < MODES.premium.approximateBytes);
  assert.equal(MODES.everyday.requiresWebGPU, false);
  assert.equal(MODES.premium.requiresWebGPU, true);
});
test('Priority European languages supported in Everyday', () => {
  for (const code of ['en','de_DE','fr_FR','es','cs_CZ','uk_UA','pl_PL','it_IT','pt_PT','nl_NL','ro_RO','sk_SK','hu_HU','sv_SE','da_DK','fi_FI']) {
    assert.equal(supportedByMode(code, 'everyday'), true, code);
    assert.match(NLLB_CODES[code], /^[a-z]{3}_[A-Za-z]+$/);
  }
});
test('NLLB codes are only assigned to existing language options', () => {
  const codes = new Set(LANGUAGES.map(([code]) => code));
  for (const code of Object.keys(NLLB_CODES)) assert.ok(codes.has(code), code);
});
test('Regional-only languages do not silently map to a different locale', () => {
  assert.equal(supportedByMode('pt_BR', 'everyday'), false);
  assert.equal(supportedByMode('pt_BR', 'premium'), true);
});
