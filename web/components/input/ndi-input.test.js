import assert from 'node:assert/strict';
import test from 'node:test';

import { createInputConfig, isErrorState, formatDecimalInput } from './input-config.js';

// ── createInputConfig ────────────────────────────────────────────────────────

test('returns a frozen object with all expected keys', () => {
  const config = createInputConfig();
  const keys = ['type', 'label', 'helper', 'error', 'suffix', 'placeholder', 'maxDecimals', 'showMax'];
  keys.forEach((key) => assert.ok(Object.prototype.hasOwnProperty.call(config, key), `missing key: ${key}`));
  assert.ok(Object.isFrozen(config), 'config must be frozen');
});

test('defaults: type text, empty strings, maxDecimals 18, showMax false', () => {
  const config = createInputConfig();
  assert.equal(config.type, 'text');
  assert.equal(config.label, '');
  assert.equal(config.helper, '');
  assert.equal(config.error, '');
  assert.equal(config.suffix, '');
  assert.equal(config.placeholder, '');
  assert.equal(config.maxDecimals, 18);
  assert.equal(config.showMax, false);
});

test('accepts valid type values', () => {
  const types = ['text', 'number', 'email', 'password', 'search', 'tel', 'url'];
  types.forEach((t) => {
    const config = createInputConfig({ type: t });
    assert.equal(config.type, t, `type ${t} should be preserved`);
  });
});

test('invalid type falls back to text', () => {
  assert.equal(createInputConfig({ type: 'checkbox' }).type, 'text');
  assert.equal(createInputConfig({ type: '' }).type, 'text');
  assert.equal(createInputConfig({ type: 42 }).type, 'text');
  assert.equal(createInputConfig({ type: null }).type, 'text');
});

test('label is trimmed', () => {
  assert.equal(createInputConfig({ label: '  Amount  ' }).label, 'Amount');
});

test('label defaults to empty string when missing or non-string', () => {
  assert.equal(createInputConfig({ label: null }).label, '');
  assert.equal(createInputConfig({ label: 123 }).label, '');
  assert.equal(createInputConfig({}).label, '');
});

test('helper and error are trimmed', () => {
  const config = createInputConfig({ helper: '  Enter amount  ', error: '  Required  ' });
  assert.equal(config.helper, 'Enter amount');
  assert.equal(config.error, 'Required');
});

test('error non-empty signals error state', () => {
  const withError = createInputConfig({ error: 'Value is required' });
  assert.equal(withError.error, 'Value is required');
});

test('helper and error can coexist', () => {
  const config = createInputConfig({
    helper: 'Enter a whole number',
    error: 'Value exceeds maximum',
  });
  assert.equal(config.helper, 'Enter a whole number');
  assert.equal(config.error, 'Value exceeds maximum');
});

test('maxDecimals clamps to 0–18', () => {
  assert.equal(createInputConfig({ maxDecimals: -5 }).maxDecimals, 0);
  assert.equal(createInputConfig({ maxDecimals: 100 }).maxDecimals, 18);
  assert.equal(createInputConfig({ maxDecimals: 6 }).maxDecimals, 6);
  assert.equal(createInputConfig({ maxDecimals: 0 }).maxDecimals, 0);
  assert.equal(createInputConfig({ maxDecimals: 18 }).maxDecimals, 18);
});

test('maxDecimals non-numeric falls back to 18', () => {
  assert.equal(createInputConfig({ maxDecimals: 'abc' }).maxDecimals, 18);
  assert.equal(createInputConfig({ maxDecimals: null }).maxDecimals, 18);
  assert.equal(createInputConfig({ maxDecimals: undefined }).maxDecimals, 18);
});

test('maxDecimals fractional values are truncated (not rounded)', () => {
  assert.equal(createInputConfig({ maxDecimals: 6.9 }).maxDecimals, 6);
});

test('showMax coerces correctly', () => {
  assert.equal(createInputConfig({ showMax: true }).showMax, true);
  assert.equal(createInputConfig({ showMax: false }).showMax, false);
  assert.equal(createInputConfig({ showMax: '' }).showMax, true);
  assert.equal(createInputConfig({ showMax: 'true' }).showMax, true);
  assert.equal(createInputConfig({ showMax: 'false' }).showMax, false);
});

test('suffix is trimmed', () => {
  assert.equal(createInputConfig({ suffix: '  ETH  ' }).suffix, 'ETH');
});

test('placeholder is trimmed', () => {
  assert.equal(createInputConfig({ placeholder: '  0.00  ' }).placeholder, '0.00');
});

test('non-object argument treated as no-op — returns defaults', () => {
  assert.equal(createInputConfig(null).type, 'text');
  assert.equal(createInputConfig('string').type, 'text');
  assert.equal(createInputConfig([]).type, 'text');
});

// ── isErrorState ─────────────────────────────────────────────────────────────

test('isErrorState returns true for non-empty error', () => {
  assert.equal(isErrorState(createInputConfig({ error: 'Required' })), true);
  assert.equal(isErrorState(createInputConfig({ error: ' ' })), false); // trimmed to ''
  assert.equal(isErrorState(createInputConfig({ error: '' })), false);
  assert.equal(isErrorState(createInputConfig()), false);
});

test('isErrorState returns false for null/undefined config', () => {
  assert.equal(isErrorState(null), false);
  assert.equal(isErrorState(undefined), false);
});

// ── formatDecimalInput ───────────────────────────────────────────────────────

test('strips non-numeric characters except the decimal point', () => {
  assert.equal(formatDecimalInput('1a2b3c'), '123');
  assert.equal(formatDecimalInput('$1,000.50'), '1000.50');
  assert.equal(formatDecimalInput('-42'), '42');
  assert.equal(formatDecimalInput('+12.5'), '12.5');
});

test('allows only the first decimal point', () => {
  assert.equal(formatDecimalInput('1.2.3'), '1.23');
  assert.equal(formatDecimalInput('1..2'), '1.2');
  assert.equal(formatDecimalInput('...'), '.');
});

test('truncates decimal places to maxDecimals', () => {
  assert.equal(formatDecimalInput('1.123456789', 6), '1.123456');
  assert.equal(formatDecimalInput('3.14159265358979', 2), '3.14');
  assert.equal(formatDecimalInput('3.14159265358979', 0), '3');
  assert.equal(formatDecimalInput('3.14159265358979', 18), '3.14159265358979');
});

test('preserves trailing dot when maxDecimals > 0', () => {
  assert.equal(formatDecimalInput('42.', 6), '42.');
});

test('removes trailing dot when maxDecimals is 0', () => {
  assert.equal(formatDecimalInput('42.', 0), '42');
  assert.equal(formatDecimalInput('42.5', 0), '42');
});

test('handles empty and whitespace input', () => {
  assert.equal(formatDecimalInput(''), '');
  assert.equal(formatDecimalInput('   '), '');
  assert.equal(formatDecimalInput(null), '');
  assert.equal(formatDecimalInput(undefined), '');
});

test('passes integer strings unchanged when no dot present', () => {
  assert.equal(formatDecimalInput('1000', 6), '1000');
  assert.equal(formatDecimalInput('0', 6), '0');
});

test('maxDecimals clamped — out-of-range values fall back to 18', () => {
  // Values outside 0–18 get clamped internally, so negative → 0, > 18 → 18.
  assert.equal(formatDecimalInput('1.123456789', -1), '1');
  assert.equal(formatDecimalInput('1.1234567890123456789', 100), '1.123456789012345678');
});
