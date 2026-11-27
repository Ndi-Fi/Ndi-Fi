import assert from 'node:assert/strict';
import test from 'node:test';

import { AA, AUDIT_PAIRS, auditAll, auditTheme, contrastRatio, parseColor } from './contrast.js';
import { colorTokens } from './tokens.js';

test('contrastRatio matches known WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(2), '21.00');
  assert.equal(contrastRatio('#ffffff', '#ffffff').toFixed(2), '1.00');
  // #767676 on white is the classic 4.54:1 AA boundary grey.
  assert.equal(contrastRatio('#767676', '#ffffff').toFixed(2), '4.54');
  // Order does not matter.
  assert.equal(contrastRatio('#ffffff', '#000000'), contrastRatio('#000000', '#ffffff'));
});

test('parseColor handles short hex, long hex and rgba()', () => {
  assert.deepEqual(parseColor('#fff'), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor('#3457d5'), { r: 52, g: 87, b: 213, a: 1 });
  assert.deepEqual(parseColor('rgba(52, 87, 213, 0.8)'), { r: 52, g: 87, b: 213, a: 0.8 });
  assert.throws(() => parseColor('hsl(0 0% 0%)'), TypeError);
});

test('translucent foregrounds are composited over the background', () => {
  // 0-alpha black on white is invisible: ratio 1.
  assert.equal(contrastRatio('rgba(0, 0, 0, 0)', '#ffffff').toFixed(2), '1.00');
  assert.ok(contrastRatio('rgba(0, 0, 0, 0.5)', '#ffffff') < contrastRatio('#000000', '#ffffff'));
});

test('every audit pair references real tokens', () => {
  const keys = new Set(Object.keys(colorTokens.light));
  for (const pair of AUDIT_PAIRS) {
    assert.ok(keys.has(pair.fg), `unknown fg token ${pair.fg}`);
    assert.ok(keys.has(pair.bg), `unknown bg token ${pair.bg}`);
    assert.ok(AA[pair.level], `unknown level ${pair.level}`);
  }
});

for (const theme of ['dark', 'light']) {
  test(`${theme} theme: every pair meets WCAG AA`, () => {
    const failures = auditTheme(theme).filter((row) => !row.pass);
    assert.deepEqual(
      failures.map((f) => `${f.fg} on ${f.bg}: ${f.ratio.toFixed(2)} < ${f.required}`),
      [],
    );
  });
}

test('the audit covers the key screens in both themes', () => {
  const rows = auditAll();
  assert.equal(rows.length, AUDIT_PAIRS.length * 2);
  const screens = new Set(rows.map((r) => r.screen));
  for (const screen of ['App shell', 'Dashboard', 'Lending', 'Actions', 'Feedback']) {
    assert.ok(screens.has(screen), `audit is missing ${screen}`);
  }
});
