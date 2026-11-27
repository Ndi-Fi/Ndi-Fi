import assert from 'node:assert/strict';
import test from 'node:test';

import { buildModalConfig, VALID_SIZES } from './modal-config.js';

// ── VALID_SIZES ─────────────────────────────────────────────────────────────

test('VALID_SIZES contains sm, md and lg', () => {
  assert.ok(Array.isArray(VALID_SIZES));
  assert.ok(VALID_SIZES.includes('sm'));
  assert.ok(VALID_SIZES.includes('md'));
  assert.ok(VALID_SIZES.includes('lg'));
});

test('VALID_SIZES is frozen', () => {
  assert.ok(Object.isFrozen(VALID_SIZES));
});

// ── buildModalConfig — defaults ─────────────────────────────────────────────

test('default config has size md', () => {
  const config = buildModalConfig();
  assert.equal(config.size, 'md');
});

test('default config has sheet false', () => {
  const config = buildModalConfig();
  assert.equal(config.sheet, false);
});

test('default config has label "Dialog"', () => {
  const config = buildModalConfig();
  assert.equal(config.label, 'Dialog');
});

test('default config has noBackdropClose false', () => {
  const config = buildModalConfig();
  assert.equal(config.noBackdropClose, false);
});

test('default config is frozen', () => {
  const config = buildModalConfig();
  assert.ok(Object.isFrozen(config));
});

test('calling with no argument returns same shape as empty object', () => {
  const a = buildModalConfig();
  const b = buildModalConfig({});
  assert.deepEqual(a, b);
});

// ── buildModalConfig — size variants ────────────────────────────────────────

test('size sm is accepted', () => {
  const config = buildModalConfig({ size: 'sm' });
  assert.equal(config.size, 'sm');
});

test('size md is accepted', () => {
  const config = buildModalConfig({ size: 'md' });
  assert.equal(config.size, 'md');
});

test('size lg is accepted', () => {
  const config = buildModalConfig({ size: 'lg' });
  assert.equal(config.size, 'lg');
});

test('unknown size falls back to md', () => {
  const config = buildModalConfig({ size: 'xl' });
  assert.equal(config.size, 'md');
});

test('empty string size falls back to md', () => {
  const config = buildModalConfig({ size: '' });
  assert.equal(config.size, 'md');
});

test('null size falls back to md', () => {
  const config = buildModalConfig({ size: null });
  assert.equal(config.size, 'md');
});

test('whitespace-only size falls back to md', () => {
  const config = buildModalConfig({ size: '   ' });
  assert.equal(config.size, 'md');
});

// ── buildModalConfig — bottom-sheet ─────────────────────────────────────────

test('sheet attribute empty string is truthy', () => {
  const config = buildModalConfig({ sheet: '' });
  assert.equal(config.sheet, true);
});

test('sheet attribute "true" string is truthy', () => {
  const config = buildModalConfig({ sheet: 'true' });
  assert.equal(config.sheet, true);
});

test('sheet attribute null means false', () => {
  const config = buildModalConfig({ sheet: null });
  assert.equal(config.sheet, false);
});

test('sheet attribute undefined means false', () => {
  const config = buildModalConfig({ sheet: undefined });
  assert.equal(config.sheet, false);
});

test('sheet attribute boolean false means false', () => {
  const config = buildModalConfig({ sheet: false });
  assert.equal(config.sheet, false);
});

// ── buildModalConfig — label / aria ─────────────────────────────────────────

test('custom label is preserved', () => {
  const config = buildModalConfig({ label: 'Confirm deletion' });
  assert.equal(config.label, 'Confirm deletion');
});

test('label is trimmed', () => {
  const config = buildModalConfig({ label: '  Confirm  ' });
  assert.equal(config.label, 'Confirm');
});

test('empty label falls back to "Dialog"', () => {
  const config = buildModalConfig({ label: '' });
  assert.equal(config.label, 'Dialog');
});

test('whitespace-only label falls back to "Dialog"', () => {
  const config = buildModalConfig({ label: '   ' });
  assert.equal(config.label, 'Dialog');
});

test('null label falls back to "Dialog"', () => {
  const config = buildModalConfig({ label: null });
  assert.equal(config.label, 'Dialog');
});

// ── buildModalConfig — noBackdropClose ──────────────────────────────────────

test('no-backdrop-close empty string enables the flag', () => {
  const config = buildModalConfig({ 'no-backdrop-close': '' });
  assert.equal(config.noBackdropClose, true);
});

test('no-backdrop-close null leaves the flag false', () => {
  const config = buildModalConfig({ 'no-backdrop-close': null });
  assert.equal(config.noBackdropClose, false);
});

// ── buildModalConfig — robustness ────────────────────────────────────────────

test('null input falls back to all defaults', () => {
  const config = buildModalConfig(null);
  assert.equal(config.size, 'md');
  assert.equal(config.label, 'Dialog');
  assert.equal(config.sheet, false);
  assert.equal(config.noBackdropClose, false);
});

test('array input falls back to all defaults', () => {
  const config = buildModalConfig(['sm', 'lg']);
  assert.equal(config.size, 'md');
});

test('all valid sizes round-trip through buildModalConfig', () => {
  for (const size of VALID_SIZES) {
    const config = buildModalConfig({ size });
    assert.equal(config.size, size, `size "${size}" should round-trip`);
  }
});

test('combined config with all fields is built correctly', () => {
  const config = buildModalConfig({
    size: 'lg',
    sheet: '',
    label: 'Settings',
    'no-backdrop-close': '',
  });

  assert.equal(config.size, 'lg');
  assert.equal(config.sheet, true);
  assert.equal(config.label, 'Settings');
  assert.equal(config.noBackdropClose, true);
});
