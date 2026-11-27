import assert from 'node:assert/strict';
import test from 'node:test';

import { buildCardConfig, cardAriaAttrs, DEFAULT_CARD_CONFIG } from './card-config.js';

// ── buildCardConfig ──────────────────────────────────────────────────────────

test('default config is returned when no attrs are provided', () => {
  const config = buildCardConfig();

  assert.equal(config.label,   DEFAULT_CARD_CONFIG.label);
  assert.equal(config.loading, DEFAULT_CARD_CONFIG.loading);
  assert.equal(config.compact, DEFAULT_CARD_CONFIG.compact);
  assert.equal(config.error,   DEFAULT_CARD_CONFIG.error);
  assert.equal(config.hasError, false);
});

test('default config is returned for an empty attrs object', () => {
  const config = buildCardConfig({});

  assert.equal(config.loading, false);
  assert.equal(config.compact,  false);
  assert.equal(config.hasError, false);
  assert.equal(config.error,    '');
});

test('label is normalised from the attrs map', () => {
  const config = buildCardConfig({ label: '  Lending position  ' });
  assert.equal(config.label, 'Lending position');
});

test('a blank or whitespace-only label falls back to the empty default', () => {
  assert.equal(buildCardConfig({ label: '   ' }).label,  '');
  assert.equal(buildCardConfig({ label: '' }).label,     '');
  assert.equal(buildCardConfig({ label: null }).label,   '');
});

// ── Loading state ────────────────────────────────────────────────────────────

test('loading state: empty-string attribute value is treated as present', () => {
  const config = buildCardConfig({ loading: '' });
  assert.equal(config.loading, true);
});

test('loading state: any non-"false" string is treated as present', () => {
  assert.equal(buildCardConfig({ loading: 'true' }).loading,    true);
  assert.equal(buildCardConfig({ loading: 'loading' }).loading, true);
});

test('loading state: the string "false" is treated as absent', () => {
  const config = buildCardConfig({ loading: 'false' });
  assert.equal(config.loading, false);
});

test('loading state: undefined (attribute not set) is false', () => {
  const config = buildCardConfig({ loading: undefined });
  assert.equal(config.loading, false);
});

test('loading state: null (attribute not set) is false', () => {
  const config = buildCardConfig({ loading: null });
  assert.equal(config.loading, false);
});

test('loading state: boolean true passes through', () => {
  const config = buildCardConfig({ loading: true });
  assert.equal(config.loading, true);
});

test('loading state: boolean false passes through', () => {
  const config = buildCardConfig({ loading: false });
  assert.equal(config.loading, false);
});

// ── Error state ──────────────────────────────────────────────────────────────

test('error state: a string message sets hasError and captures the message', () => {
  const config = buildCardConfig({ error: 'Network request failed' });
  assert.equal(config.hasError, true);
  assert.equal(config.error,    'Network request failed');
});

test('error state: an empty-string error value still marks the card as errored', () => {
  const config = buildCardConfig({ error: '' });
  assert.equal(config.hasError, true);
  assert.equal(config.error,    '');
});

test('error state: whitespace-only error value captures as empty string', () => {
  const config = buildCardConfig({ error: '   ' });
  assert.equal(config.hasError, true);
  assert.equal(config.error,    '');
});

test('error state: null means no error', () => {
  const config = buildCardConfig({ error: null });
  assert.equal(config.hasError, false);
});

test('error state: undefined means no error', () => {
  const config = buildCardConfig({ error: undefined });
  assert.equal(config.hasError, false);
});

// ── Compact variant ──────────────────────────────────────────────────────────

test('compact variant: empty-string attribute value is treated as present', () => {
  const config = buildCardConfig({ compact: '' });
  assert.equal(config.compact, true);
});

test('compact variant: any non-"false" string is treated as present', () => {
  assert.equal(buildCardConfig({ compact: 'true' }).compact,    true);
  assert.equal(buildCardConfig({ compact: 'compact' }).compact, true);
});

test('compact variant: the string "false" is treated as absent', () => {
  const config = buildCardConfig({ compact: 'false' });
  assert.equal(config.compact, false);
});

test('compact variant: undefined (attribute not set) is false', () => {
  const config = buildCardConfig({ compact: undefined });
  assert.equal(config.compact, false);
});

test('compact variant: boolean true passes through', () => {
  const config = buildCardConfig({ compact: true });
  assert.equal(config.compact, true);
});

// ── Combined states ──────────────────────────────────────────────────────────

test('loading and compact can be active simultaneously', () => {
  const config = buildCardConfig({ loading: '', compact: '' });
  assert.equal(config.loading, true);
  assert.equal(config.compact, true);
  assert.equal(config.hasError, false);
});

test('error and compact can be active simultaneously', () => {
  const config = buildCardConfig({ error: 'Oops', compact: '' });
  assert.equal(config.hasError, true);
  assert.equal(config.compact,  true);
  assert.equal(config.loading,  false);
});

// ── Malformed input ──────────────────────────────────────────────────────────

test('malformed attrs (non-object) falls back to defaults', () => {
  assert.doesNotThrow(() => buildCardConfig('not-an-object'));
  const config = buildCardConfig('not-an-object');
  assert.equal(config.loading,  DEFAULT_CARD_CONFIG.loading);
  assert.equal(config.compact,  DEFAULT_CARD_CONFIG.compact);
  assert.equal(config.hasError, false);
});

test('array input falls back to defaults', () => {
  const config = buildCardConfig(['loading']);
  assert.equal(config.loading, false);
});

test('null input falls back to defaults', () => {
  const config = buildCardConfig(null);
  assert.equal(config.loading, false);
  assert.equal(config.hasError, false);
});

// ── cardAriaAttrs ────────────────────────────────────────────────────────────

test('cardAriaAttrs returns empty object for a plain default config', () => {
  const config  = buildCardConfig();
  const attrs   = cardAriaAttrs(config);
  assert.deepEqual(attrs, {});
});

test('cardAriaAttrs includes aria-label when label is set', () => {
  const config = buildCardConfig({ label: 'Staking card' });
  const attrs  = cardAriaAttrs(config);
  assert.equal(attrs['aria-label'], 'Staking card');
});

test('cardAriaAttrs includes aria-busy when loading', () => {
  const config = buildCardConfig({ loading: '' });
  const attrs  = cardAriaAttrs(config);
  assert.equal(attrs['aria-busy'], 'true');
});

test('cardAriaAttrs does not include aria-busy when not loading', () => {
  const config = buildCardConfig({ loading: false });
  const attrs  = cardAriaAttrs(config);
  assert.ok(!('aria-busy' in attrs));
});

test('cardAriaAttrs includes aria-invalid when errored', () => {
  const config = buildCardConfig({ error: 'failed' });
  const attrs  = cardAriaAttrs(config);
  assert.equal(attrs['aria-invalid'], 'true');
});

test('cardAriaAttrs does not include aria-invalid when no error', () => {
  const config = buildCardConfig();
  const attrs  = cardAriaAttrs(config);
  assert.ok(!('aria-invalid' in attrs));
});

test('cardAriaAttrs carries all three attrs for a labelled, loading, error card', () => {
  const config = buildCardConfig({ label: 'Dashboard card', loading: '', error: '' });
  const attrs  = cardAriaAttrs(config);
  assert.equal(attrs['aria-label'],   'Dashboard card');
  assert.equal(attrs['aria-busy'],    'true');
  assert.equal(attrs['aria-invalid'], 'true');
});

test('cardAriaAttrs result is frozen', () => {
  const config = buildCardConfig({ label: 'x' });
  const attrs  = cardAriaAttrs(config);
  assert.throws(() => { attrs['aria-label'] = 'mutated'; }, TypeError);
});
