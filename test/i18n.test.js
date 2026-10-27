import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, STRINGS, formatNumber, normalizeLanguage, otherLanguage, translate } from '../src/i18n.js';

/** The {placeholder} names a string uses, sorted. */
function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
}

test('i18n: English and Turkish have the same keys and no empty strings', () => {
  assert.deepEqual(LANGUAGES, ['en', 'tr']);
  const keys = Object.keys(STRINGS.en).sort();
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), keys);
  for (const lang of LANGUAGES) {
    for (const key of keys) assert.ok(STRINGS[lang][key].trim().length > 0, `${lang}.${key} is empty`);
  }
});

test('i18n: every Turkish string uses the same placeholders as the English one', () => {
  for (const key of Object.keys(STRINGS.en)) {
    assert.deepEqual(placeholders(STRINGS.tr[key]), placeholders(STRINGS.en[key]), key);
  }
});

test('i18n: the language toggle\'s label starts with the code the button shows (label in name)', () => {
  for (const lang of LANGUAGES) {
    const shown = otherLanguage(lang).toUpperCase();
    assert.ok(STRINGS[lang].switchLanguage.startsWith(`${shown} `), `${lang}: "${STRINGS[lang].switchLanguage}"`);
  }
});

test('translate fills placeholders and formats numbers for the language', () => {
  assert.equal(translate('en', 'levelClearTitle', { level: 2 }), 'Level 2 cleared!');
  assert.equal(translate('tr', 'levelClearTitle', { level: 2 }), '2. bölüm tamam!');
  assert.equal(translate('en', 'gameOverText', { score: 12500 }), 'Final score: 12,500.');
  assert.equal(translate('tr', 'gameOverText', { score: 12500 }), 'Son skor: 12.500.');
  assert.equal(translate('en', 'levelOf', { level: 1, total: 3 }), '1 / 3');
});

test('translate falls back safely', () => {
  assert.equal(translate('de', 'newGame'), 'New game', 'unknown language -> English');
  assert.equal(translate('en', 'noSuchKey'), 'noSuchKey', 'unknown key stays visible');
  assert.equal(translate('en', 'gameOverText'), 'Final score: {score}.', 'missing value keeps its placeholder');
});

test('language helpers: normalise, toggle and format numbers', () => {
  assert.equal(normalizeLanguage('tr'), 'tr');
  assert.equal(normalizeLanguage('xx'), 'en');
  assert.equal(normalizeLanguage(null), 'en');
  assert.equal(otherLanguage('en'), 'tr');
  assert.equal(otherLanguage('tr'), 'en');
  assert.equal(formatNumber('en', 1250), '1,250');
  assert.equal(formatNumber('tr', 1250), '1.250');
});
