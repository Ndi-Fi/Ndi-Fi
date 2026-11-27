import assert from 'node:assert/strict';
import test from 'node:test';

import { ICONS, ICON_NAMES, ICON_SIZES, iconSvg, resolveIconSize } from './icons.js';

test('ICON_NAMES lists every icon, sorted and unique', () => {
  assert.equal(ICON_NAMES.length, Object.keys(ICONS).length);
  assert.deepEqual([...ICON_NAMES], [...ICON_NAMES].sort());
  assert.equal(new Set(ICON_NAMES).size, ICON_NAMES.length);
  assert.ok(Object.isFrozen(ICONS) && Object.isFrozen(ICON_NAMES));
});

test('icon names are lowercase kebab-case', () => {
  for (const name of ICON_NAMES) assert.match(name, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, name);
});

test('every icon has a title and well-formed path data', () => {
  const allowed = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/;
  for (const [name, icon] of Object.entries(ICONS)) {
    assert.ok(icon.title?.trim(), `${name}: missing title`);
    assert.match(icon.path, /^M/, `${name}: path must start with an absolute moveto`);
    assert.match(icon.path, allowed, `${name}: path contains characters outside SVG path syntax`);
  }
});

test('no two icons share the same drawing', () => {
  const seen = new Map();
  for (const [name, icon] of Object.entries(ICONS)) {
    assert.ok(!seen.has(icon.path), `${name} duplicates ${seen.get(icon.path)}`);
    seen.set(icon.path, name);
  }
});

test('absolute coordinates stay on the 24×24 grid', () => {
  // Every number that follows an absolute command letter (M, L, H, V, C, …)
  // is a coordinate; it must sit inside the viewBox.
  for (const [name, icon] of Object.entries(ICONS)) {
    for (const segment of icon.path.match(/[MLHVCSQT][^A-Za-z]*/g) ?? []) {
      for (const n of segment.slice(1).match(/-?\d*\.?\d+/g) ?? []) {
        const v = Number(n);
        assert.ok(v >= 0 && v <= 24, `${name}: coordinate ${v} is off the 24px grid`);
      }
    }
  }
});

test('the set covers every UI need in the product', () => {
  const required = [
    // DeFi actions
    'deposit', 'withdraw', 'borrow', 'repay', 'stake', 'rewards', 'swap',
    // wallet & network
    'wallet', 'connect-wallet', 'network', 'switch-network',
    // positions & risk
    'dashboard', 'positions', 'history', 'health', 'liquidation', 'risk', 'lock', 'unlock',
    // feedback (errors, toasts, onboarding hints)
    'info', 'success', 'warning', 'error', 'help', 'lightbulb', 'book', 'sparkle',
    // interface
    'check', 'close', 'plus', 'minus', 'menu', 'refresh', 'arrow-left', 'arrow-right',
    'chevron-up', 'chevron-down', 'chevron-left', 'chevron-right',
    'external-link', 'copy', 'search', 'settings', 'user', 'sun', 'moon',
  ];
  for (const name of required) assert.ok(ICONS[name], `missing icon: ${name}`);
});

test('resolveIconSize maps named sizes and validates numbers', () => {
  assert.deepEqual(ICON_SIZES, { xs: 12, sm: 16, md: 20, lg: 24, xl: 32, '2xl': 48 });
  assert.equal(resolveIconSize(undefined), 20);
  assert.equal(resolveIconSize('lg'), 24);
  assert.equal(resolveIconSize('18'), 18);
  for (const bad of ['bogus', '0', '-4', '1.5', '9999']) assert.equal(resolveIconSize(bad), 20, bad);
});

test('iconSvg renders decorative markup by default', () => {
  const svg = iconSvg('deposit');
  assert.match(svg, /aria-hidden="true"/);
  assert.match(svg, /focusable="false"/);
  assert.doesNotMatch(svg, /role="img"|<title>/);
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /width="20" height="20"/);
  assert.ok(svg.includes(`d="${ICONS.deposit.path}"`));
});

test('iconSvg renders a labelled image and escapes the label', () => {
  const svg = iconSvg('warning', { size: 'xl', label: 'Risk "high" <now>' });
  assert.match(svg, /role="img"/);
  assert.match(svg, /aria-label="Risk &quot;high&quot; &lt;now&gt;"/);
  assert.match(svg, /<title>Risk &quot;high&quot; &lt;now&gt;<\/title>/);
  assert.match(svg, /width="32"/);
  assert.doesNotMatch(svg, /aria-hidden/);
});

test('iconSvg falls back to help for unknown names', () => {
  assert.ok(iconSvg('nope').includes(ICONS.help.path));
});
