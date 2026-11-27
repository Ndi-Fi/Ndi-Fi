import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildToastConfig,
  getToastIcon,
  TOAST_TYPES,
  DEFAULT_DURATION,
  MAX_TOASTS,
} from './toast-config.js';

// ─── Constants ────────────────────────────────────────────────────────────────

test('DEFAULT_DURATION is 5000ms', () => {
  assert.equal(DEFAULT_DURATION, 5000);
});

test('MAX_TOASTS is 5', () => {
  assert.equal(MAX_TOASTS, 5);
});

test('TOAST_TYPES contains the four expected types', () => {
  assert.deepEqual([...TOAST_TYPES].sort(), ['error', 'info', 'success', 'warning']);
});

// ─── buildToastConfig — defaults ──────────────────────────────────────────────

test('default config has empty message, empty title, info type, and default duration', () => {
  const config = buildToastConfig();

  assert.equal(config.message, '');
  assert.equal(config.title, '');
  assert.equal(config.type, 'info');
  assert.equal(config.duration, DEFAULT_DURATION);
});

test('default config object is frozen', () => {
  const config = buildToastConfig();
  assert.ok(Object.isFrozen(config));
});

// ─── buildToastConfig — message ───────────────────────────────────────────────

test('message is passed through when it is a non-empty string', () => {
  const config = buildToastConfig({ message: 'Hello world' });
  assert.equal(config.message, 'Hello world');
});

test('message is trimmed', () => {
  const config = buildToastConfig({ message: '  trimmed  ' });
  assert.equal(config.message, 'trimmed');
});

test('non-string message falls back to empty string', () => {
  assert.equal(buildToastConfig({ message: 42 }).message, '');
  assert.equal(buildToastConfig({ message: null }).message, '');
  assert.equal(buildToastConfig({ message: ['a'] }).message, '');
});

// ─── buildToastConfig — title ─────────────────────────────────────────────────

test('title is passed through when it is a non-empty string', () => {
  const config = buildToastConfig({ title: 'Network error' });
  assert.equal(config.title, 'Network error');
});

test('title is trimmed', () => {
  assert.equal(buildToastConfig({ title: '  Heads up  ' }).title, 'Heads up');
});

test('whitespace-only title falls back to empty string', () => {
  assert.equal(buildToastConfig({ title: '   ' }).title, '');
});

// ─── buildToastConfig — type validation ───────────────────────────────────────

test('each valid type is accepted as-is', () => {
  for (const type of TOAST_TYPES) {
    assert.equal(buildToastConfig({ type }).type, type);
  }
});

test('unknown type falls back to info', () => {
  assert.equal(buildToastConfig({ type: 'danger' }).type, 'info');
  assert.equal(buildToastConfig({ type: '' }).type, 'info');
  assert.equal(buildToastConfig({ type: 'SUCCESS' }).type, 'info');
});

test('type matching is case-sensitive (must be lowercase)', () => {
  assert.equal(buildToastConfig({ type: 'Success' }).type, 'info');
  assert.equal(buildToastConfig({ type: 'ERROR' }).type, 'info');
});

test('non-string type falls back to info', () => {
  assert.equal(buildToastConfig({ type: 42 }).type, 'info');
  assert.equal(buildToastConfig({ type: null }).type, 'info');
  assert.equal(buildToastConfig({ type: ['error'] }).type, 'info');
});

// ─── buildToastConfig — duration normalisation ────────────────────────────────

test('custom positive duration is accepted', () => {
  assert.equal(buildToastConfig({ duration: 3000 }).duration, 3000);
});

test('duration of 0 means persistent (is preserved)', () => {
  assert.equal(buildToastConfig({ duration: 0 }).duration, 0);
});

test('negative duration falls back to DEFAULT_DURATION', () => {
  assert.equal(buildToastConfig({ duration: -1 }).duration, DEFAULT_DURATION);
  assert.equal(buildToastConfig({ duration: -9999 }).duration, DEFAULT_DURATION);
});

test('non-finite duration falls back to DEFAULT_DURATION', () => {
  assert.equal(buildToastConfig({ duration: Infinity }).duration, DEFAULT_DURATION);
  assert.equal(buildToastConfig({ duration: NaN }).duration, DEFAULT_DURATION);
});

test('non-number duration falls back to DEFAULT_DURATION', () => {
  assert.equal(buildToastConfig({ duration: '3000' }).duration, DEFAULT_DURATION);
  assert.equal(buildToastConfig({ duration: null }).duration, DEFAULT_DURATION);
});

// ─── buildToastConfig — malformed input ───────────────────────────────────────

test('null options fall back entirely to defaults', () => {
  const config = buildToastConfig(null);
  assert.equal(config.type, 'info');
  assert.equal(config.duration, DEFAULT_DURATION);
});

test('array options fall back entirely to defaults', () => {
  const config = buildToastConfig(['error', 1000]);
  assert.equal(config.type, 'info');
  assert.equal(config.duration, DEFAULT_DURATION);
});

test('string options fall back entirely to defaults', () => {
  const config = buildToastConfig('error');
  assert.equal(config.type, 'info');
  assert.equal(config.duration, DEFAULT_DURATION);
});

// ─── getToastIcon ─────────────────────────────────────────────────────────────

test('getToastIcon returns a non-empty string for every valid type', () => {
  for (const type of TOAST_TYPES) {
    const icon = getToastIcon(type);
    assert.ok(typeof icon === 'string' && icon.length > 0, `icon missing for type "${type}"`);
  }
});

test('each type icon contains an SVG element', () => {
  for (const type of TOAST_TYPES) {
    assert.match(getToastIcon(type), /<svg/, `SVG tag not found in icon for type "${type}"`);
  }
});

test('all icons carry aria-hidden to hide them from assistive tech', () => {
  for (const type of TOAST_TYPES) {
    assert.match(
      getToastIcon(type),
      /aria-hidden="true"/,
      `aria-hidden missing on icon for type "${type}"`,
    );
  }
});

test('icons are distinct for each type', () => {
  const icons = TOAST_TYPES.map(getToastIcon);
  const unique = new Set(icons);
  assert.equal(unique.size, TOAST_TYPES.length, 'every type must have a unique icon');
});

test('getToastIcon falls back to the info icon for unknown types', () => {
  const infoIcon = getToastIcon('info');
  assert.equal(getToastIcon('unknown'), infoIcon);
  assert.equal(getToastIcon(''), infoIcon);
  assert.equal(getToastIcon(null), infoIcon);
});
