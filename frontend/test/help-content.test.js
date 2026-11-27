import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_LOCALE,
  LOCALES,
  formatString,
  getActiveLocale,
  getTerm,
  getUiString,
  listLocales,
  listTerms,
  normalizeLocale,
  resolveLocale,
  setActiveLocale,
} from '../src/help-content.js';

test('every locale has complete, non-empty translations', () => {
  const englishKeys = Object.keys(LOCALES[DEFAULT_LOCALE].terms);
  const englishUiKeys = Object.keys(LOCALES[DEFAULT_LOCALE].ui);

  for (const [code, locale] of Object.entries(LOCALES)) {
    assert.deepEqual(Object.keys(locale.terms), englishKeys, `${code}: term keys drifted`);
    assert.deepEqual(Object.keys(locale.ui), englishUiKeys, `${code}: UI keys drifted`);

    for (const [key, entry] of Object.entries(locale.terms)) {
      for (const field of ['term', 'summary', 'details']) {
        assert.equal(typeof entry[field], 'string', `${code}/${key}.${field} must be a string`);
        assert.ok(entry[field].trim().length > 0, `${code}/${key}.${field} must not be empty`);
      }
    }
  }
});

test('the requested concepts have plain-language summaries and longer details', () => {
  for (const key of ['collateralFactor', 'apr', 'apy', 'healthFactor', 'liquidation', 'ltv']) {
    const entry = getTerm(key, 'en');
    assert.ok(entry, `${key} should be documented`);
    assert.ok(entry.summary.length > 20, `${key} needs a real summary`);
    assert.ok(entry.details.length > entry.summary.length, `${key} needs expanded details`);
  }
});

test('locale tags are normalised and unknown tags fall back to English', () => {
  assert.equal(normalizeLocale('es-MX'), 'es');
  assert.equal(normalizeLocale('FR_ca'), 'fr');
  assert.equal(normalizeLocale(' en '), 'en');
  assert.equal(normalizeLocale('de-DE'), null);
  assert.equal(normalizeLocale(null), null);

  assert.equal(resolveLocale('es-419'), 'es');
  assert.equal(resolveLocale('de-DE'), DEFAULT_LOCALE);
});

test('terms and UI labels are localised', () => {
  assert.match(getTerm('collateralFactor', 'en').summary, /percentage of your collateral/i);
  assert.match(getTerm('collateralFactor', 'es').summary, /porcentaje del valor de tu garantía/i);
  assert.match(getTerm('healthFactor', 'fr').summary, /sécurité de votre prêt/i);
  assert.equal(getUiString('learnMore', 'fr'), 'En savoir plus');
  assert.equal(getUiString('whatIs', 'es', { term: 'APR' }), '¿Qué es APR?');
});

test('unknown terms return null and unknown locales fall back cleanly', () => {
  assert.equal(getTerm('doesNotExist', 'en'), null);
  assert.equal(getTerm('', 'en'), null);
  assert.equal(getTerm(null, 'en'), null);

  const fallback = getTerm('apr', 'de-DE');
  assert.equal(fallback.locale, DEFAULT_LOCALE);
  assert.equal(fallback.term, 'APR');
  assert.equal(getUiString('learnMore', 'de-DE'), 'Learn more');
});

test('formatString keeps unknown placeholders visible', () => {
  assert.equal(formatString('{term} / {missing}', { term: 'APY' }), 'APY / {missing}');
  assert.equal(formatString(undefined), '');
});

test('catalogue helpers expose locales and concepts', () => {
  assert.deepEqual(
    listLocales().map((locale) => locale.code),
    ['en', 'es', 'fr'],
  );
  assert.ok(listTerms('es').length >= 12);
  assert.equal(listTerms('es')[0].locale, 'es');
});

test('the active locale can be changed and validated', () => {
  const original = getActiveLocale();
  try {
    assert.equal(setActiveLocale('fr-FR'), 'fr');
    assert.equal(getActiveLocale(), 'fr');
    assert.equal(getTerm('yield').term, 'Rendement');
    assert.equal(setActiveLocale('xx'), DEFAULT_LOCALE);
    assert.equal(getActiveLocale(), DEFAULT_LOCALE);
  } finally {
    setActiveLocale(original);
  }
});
