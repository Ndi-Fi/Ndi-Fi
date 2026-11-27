/**
 * WCAG 2.x contrast helpers and the Ndi-Fi colour-pair audit.
 *
 * `AUDIT_PAIRS` lists every foreground/background combination the components
 * actually render, grouped by the key screen that shows it. `auditTheme()`
 * resolves those pairs against `colorTokens` and reports each ratio, so the
 * design tokens can be checked in CI (`contrast.test.js`) and from the command
 * line:
 *
 *   node web/design-tokens/contrast.js          # print the audit table
 *   node web/design-tokens/contrast.js --md     # print it as Markdown
 *
 * Thresholds (WCAG 2.2 AA):
 *   text      4.5:1 — body copy, labels, button text
 *   large     3:1   — text ≥ 24px, or ≥ 18.66px bold
 *   graphic   3:1   — icons, focus rings, borders that carry meaning (1.4.11)
 */

import { colorTokens } from './tokens.js';

export const AA = Object.freeze({ text: 4.5, large: 3, graphic: 3 });

/**
 * Parse `#rgb`, `#rrggbb` or `rgb()/rgba()` into `{ r, g, b, a }` (0–255, 0–1).
 * @param {string} value
 */
export function parseColor(value) {
  const input = String(value).trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(input);
  if (hex) {
    let digits = hex[1];
    if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
    return {
      r: parseInt(digits.slice(0, 2), 16),
      g: parseInt(digits.slice(2, 4), 16),
      b: parseInt(digits.slice(4, 6), 16),
      a: 1,
    };
  }
  const fn = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(input);
  if (fn) {
    return { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]), a: fn[4] === undefined ? 1 : Number(fn[4]) };
  }
  throw new TypeError(`Unsupported colour value: ${value}`);
}

/** Alpha-composite `top` over an opaque `bottom`. */
export function composite(top, bottom) {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

/** WCAG relative luminance of an opaque colour. */
export function relativeLuminance({ r, g, b }) {
  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Contrast ratio between two colours (1–21). A translucent foreground is
 * composited over the background first, which is how the browser paints it.
 */
export function contrastRatio(foreground, background) {
  const bg = parseColor(background);
  let fg = parseColor(foreground);
  if (fg.a < 1) fg = composite(fg, bg);
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Every colour pair rendered by the design system, grouped by key screen.
 * `level` picks the AA threshold from `AA`.
 */
export const AUDIT_PAIRS = Object.freeze([
  // App shell / landing
  { screen: 'App shell', fg: 'foreground', bg: 'background', level: 'text', use: 'Body copy' },
  { screen: 'App shell', fg: 'muted', bg: 'background', level: 'text', use: 'Secondary copy' },
  { screen: 'App shell', fg: 'accent', bg: 'background', level: 'text', use: 'Links' },
  { screen: 'App shell', fg: 'focus-ring', bg: 'background', level: 'graphic', use: 'Focus ring' },

  // Cards (dashboard, positions, staking)
  { screen: 'Dashboard', fg: 'foreground', bg: 'surface', level: 'text', use: 'Card text' },
  { screen: 'Dashboard', fg: 'muted', bg: 'surface', level: 'text', use: 'Card labels' },
  { screen: 'Dashboard', fg: 'muted', bg: 'surface-muted', level: 'text', use: 'Table header' },
  { screen: 'Dashboard', fg: 'foreground', bg: 'surface-raised', level: 'text', use: 'Popover / modal' },
  { screen: 'Dashboard', fg: 'muted', bg: 'surface-raised', level: 'text', use: 'Popover / tour body' },
  { screen: 'Dashboard', fg: 'accent', bg: 'surface-raised', level: 'graphic', use: 'Tour step icon' },
  { screen: 'Dashboard', fg: 'accent', bg: 'surface', level: 'text', use: 'Links in cards' },
  { screen: 'Dashboard', fg: 'focus-ring', bg: 'surface', level: 'graphic', use: 'Focus ring on cards' },

  // Lending & borrowing (health factor, risk)
  { screen: 'Lending', fg: 'success', bg: 'surface', level: 'text', use: 'Healthy factor value' },
  { screen: 'Lending', fg: 'warning', bg: 'surface', level: 'text', use: 'Near-threshold value' },
  { screen: 'Lending', fg: 'danger', bg: 'surface', level: 'text', use: 'Liquidatable value' },
  { screen: 'Lending', fg: 'info', bg: 'surface', level: 'text', use: 'Informational value' },
  { screen: 'Lending', fg: 'success', bg: 'background', level: 'graphic', use: 'Health gauge (safe)' },
  { screen: 'Lending', fg: 'warning', bg: 'background', level: 'graphic', use: 'Health gauge (caution)' },
  { screen: 'Lending', fg: 'danger', bg: 'background', level: 'graphic', use: 'Health gauge (danger)' },

  // Buttons (every action screen)
  { screen: 'Actions', fg: 'primary-contrast', bg: 'primary', level: 'text', use: 'Primary button' },
  { screen: 'Actions', fg: 'secondary-contrast', bg: 'secondary', level: 'text', use: 'Secondary button' },
  { screen: 'Actions', fg: 'danger-contrast', bg: 'danger', level: 'text', use: 'Destructive button' },
  { screen: 'Actions', fg: 'success-contrast', bg: 'success', level: 'text', use: 'Success button' },
  { screen: 'Actions', fg: 'warning-contrast', bg: 'warning', level: 'text', use: 'Warning button' },
  { screen: 'Actions', fg: 'info-contrast', bg: 'info', level: 'text', use: 'Info button' },
  { screen: 'Actions', fg: 'primary', bg: 'surface', level: 'text', use: 'Ghost / outline button' },
  { screen: 'Actions', fg: 'primary', bg: 'primary-soft', level: 'text', use: 'Soft button' },

  // Feedback (toasts, banners, error states)
  { screen: 'Feedback', fg: 'foreground', bg: 'danger-soft', level: 'text', use: 'Error banner text' },
  { screen: 'Feedback', fg: 'danger', bg: 'danger-soft', level: 'graphic', use: 'Error icon' },
  { screen: 'Feedback', fg: 'foreground', bg: 'warning-soft', level: 'text', use: 'Warning banner text' },
  { screen: 'Feedback', fg: 'warning', bg: 'warning-soft', level: 'graphic', use: 'Warning icon' },
  { screen: 'Feedback', fg: 'foreground', bg: 'success-soft', level: 'text', use: 'Success banner text' },
  { screen: 'Feedback', fg: 'success', bg: 'success-soft', level: 'graphic', use: 'Success icon' },
  { screen: 'Feedback', fg: 'foreground', bg: 'info-soft', level: 'text', use: 'Info banner text' },
  { screen: 'Feedback', fg: 'info', bg: 'info-soft', level: 'graphic', use: 'Info icon' },
  { screen: 'Feedback', fg: 'foreground', bg: 'secondary-soft', level: 'text', use: 'Neutral chip' },
]);

/**
 * Resolve every audit pair for one theme.
 * @param {'light'|'dark'} theme
 */
export function auditTheme(theme, palette = colorTokens[theme]) {
  return AUDIT_PAIRS.map((pair) => {
    const ratio = contrastRatio(palette[pair.fg], palette[pair.bg]);
    const required = AA[pair.level];
    return { ...pair, theme, ratio, required, pass: ratio >= required };
  });
}

/** Audit both themes. */
export function auditAll() {
  return [...auditTheme('light'), ...auditTheme('dark')];
}

function formatMarkdown(rows) {
  const lines = [
    '| Screen | Use | Foreground / background | Light | Dark | Needs |',
    '| --- | --- | --- | --- | --- | --- |',
  ];
  const light = rows.filter((r) => r.theme === 'light');
  const dark = rows.filter((r) => r.theme === 'dark');
  light.forEach((l, i) => {
    const d = dark[i];
    const cell = (r) => `${r.ratio.toFixed(2)}${r.pass ? '' : ' ✗'}`;
    lines.push(`| ${l.screen} | ${l.use} | \`${l.fg}\` / \`${l.bg}\` | ${cell(l)} | ${cell(d)} | ${l.required}:1 |`);
  });
  return lines.join('\n');
}

// CLI: `node contrast.js [--md]`
if (typeof process !== 'undefined' && process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const rows = auditAll();
  if (process.argv.includes('--md')) {
    console.log(formatMarkdown(rows));
  } else {
    for (const r of rows) {
      const mark = r.pass ? 'ok  ' : 'FAIL';
      console.log(`${mark} ${r.theme.padEnd(5)} ${r.ratio.toFixed(2).padStart(5)} / ${r.required}  ${r.fg} on ${r.bg}  (${r.screen}: ${r.use})`);
    }
  }
  const failures = rows.filter((r) => !r.pass).length;
  if (failures) {
    console.error(`\n${failures} pair(s) below WCAG AA.`);
    process.exitCode = 1;
  }
}
