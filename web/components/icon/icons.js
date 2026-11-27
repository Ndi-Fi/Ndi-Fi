/**
 * Icon definitions for the Ndi-Fi design system.
 *
 * Every icon is a stroke-only outline drawn on a 24×24 grid:
 *   - live area 20×20 (2px padding on every side); circles use r=9
 *   - stroke="currentColor", stroke-width="1.75"
 *   - stroke-linecap="round", stroke-linejoin="round", fill="none"
 *   - a dot is a zero-length segment (`h.01`), which round caps render as a dot
 *
 * Those presentation attributes are applied by `<ndi-icon>` / `iconSvg()` at
 * render time, so the path data stays pure geometry. See README.md for the
 * full drawing and usage rules.
 *
 * Adding a new icon: add an entry to ICONS (lowercase kebab-case key, a
 * `title` and a `path`). `icons.test.js` checks the rest.
 */

/** A 9-radius circle centred on the grid, shared by the status icons. */
const CIRCLE = 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z';

/** @type {Readonly<Record<string, Readonly<{ path: string; title: string }>>>} */
export const ICONS = Object.freeze({
  // ── DeFi actions ─────────────────────────────────────────────────────────
  deposit: { title: 'Deposit', path: 'M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' },
  withdraw: { title: 'Withdraw', path: 'M12 15V3m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2' },
  borrow: { title: 'Borrow', path: 'M3 12h10m0 0-4-4m4 4-4 4M16 4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2' },
  repay: { title: 'Repay', path: 'M21 12H11m0 0 4-4m-4 4 4 4M8 4H6a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h2' },
  stake: { title: 'Stake', path: 'M12 3 2 8l10 5 10-5-10-5zM2 12.5l10 5 10-5M2 16.5l10 5 10-5' },
  rewards: {
    title: 'Rewards',
    path: 'M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M3 8h18v4H3zM12 8v13M12 8H8.5a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8zm0 0h3.5a2.5 2.5 0 1 0 0-5C13 3 12 8 12 8z',
  },
  swap: { title: 'Swap', path: 'M7 20V4m0 0L3 8m4-4 4 4M17 4v16m0 0 4-4m-4 4-4-4' },

  // ── Wallet & network ─────────────────────────────────────────────────────
  wallet: {
    title: 'Wallet',
    path: 'M19 8V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V6M16 14h.01',
  },
  'connect-wallet': {
    title: 'Connect wallet',
    path: 'M19 8V5a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v3M3 6v12a2 2 0 0 0 2 2h7M18 15v6m-3-3h6',
  },
  network: {
    title: 'Network',
    path: `${CIRCLE}M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18`,
  },
  'switch-network': { title: 'Switch network', path: 'M4 8h14m0 0-3-3m3 3-3 3M20 16H6m0 0 3-3m-3 3 3 3' },

  // ── Positions & risk ─────────────────────────────────────────────────────
  dashboard: { title: 'Dashboard', path: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  positions: {
    title: 'Positions',
    path: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 12h6m-6 4h4',
  },
  history: { title: 'History', path: 'M3 12a9 9 0 1 0 2.64-6.36L3 8M3 3v5h5M12 7v5l3 2' },
  health: {
    title: 'Health factor',
    path: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21l8.84-8.61a5.5 5.5 0 0 0 0-7.78z',
  },
  liquidation: { title: 'Liquidation', path: 'M3 7l6 6 4-4 8 8m0 0v-6m0 6h-6' },
  risk: { title: 'Risk', path: 'M12 3l8 3.5V12c0 4.5-3.4 8.6-8 10-4.6-1.4-8-5.5-8-10V6.5L12 3zM12 8v5m0 3h.01' },
  lock: { title: 'Locked', path: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4' },
  unlock: { title: 'Unlocked', path: 'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 9.9-1' },

  // ── Status & feedback ────────────────────────────────────────────────────
  info: { title: 'Information', path: `${CIRCLE}M12 8h.01M11 12h1v5h1` },
  success: { title: 'Success', path: `${CIRCLE}M8.5 12.5l2.5 2.5 4.5-5` },
  warning: {
    title: 'Warning',
    path: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01',
  },
  error: { title: 'Error', path: `${CIRCLE}M15 9l-6 6M9 9l6 6` },
  help: { title: 'Help', path: `${CIRCLE}M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6M12 17h.01` },
  lightbulb: {
    title: 'Tip',
    path: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z',
  },
  book: { title: 'Learn', path: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5' },
  sparkle: {
    title: 'New',
    path: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
  },

  // ── Interface ────────────────────────────────────────────────────────────
  check: { title: 'Done', path: 'M5 12.5l4.5 4.5L19 7.5' },
  close: { title: 'Close', path: 'M18 6 6 18M6 6l12 12' },
  plus: { title: 'Add', path: 'M12 5v14M5 12h14' },
  minus: { title: 'Remove', path: 'M5 12h14' },
  menu: { title: 'Menu', path: 'M4 6h16M4 12h16M4 18h16' },
  refresh: { title: 'Retry', path: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5' },
  'arrow-left': { title: 'Back', path: 'M19 12H5m7 7-7-7 7-7' },
  'arrow-right': { title: 'Next', path: 'M5 12h14m-7-7 7 7-7 7' },
  'chevron-up': { title: 'Collapse', path: 'M18 15l-6-6-6 6' },
  'chevron-down': { title: 'Expand', path: 'M6 9l6 6 6-6' },
  'chevron-left': { title: 'Previous', path: 'M15 18l-6-6 6-6' },
  'chevron-right': { title: 'Next', path: 'M9 18l6-6-6-6' },
  'external-link': { title: 'Opens in a new tab', path: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3' },
  copy: {
    title: 'Copy',
    path: 'M10 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3',
  },
  search: { title: 'Search', path: 'M21 21l-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0z' },
  settings: { title: 'Settings', path: 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h11m4 0h1M15 4v4M9 10v4M17 16v4' },
  user: { title: 'Account', path: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8z' },
  sun: {
    title: 'Light theme',
    path: 'M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
  },
  moon: { title: 'Dark theme', path: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z' },
});

/** Sorted list of every icon name — for docs, galleries and validation. */
export const ICON_NAMES = Object.freeze(Object.keys(ICONS).sort());

/** Named sizes (px). Keep in step with the sizing table in README.md. */
export const ICON_SIZES = Object.freeze({ xs: 12, sm: 16, md: 20, lg: 24, xl: 32, '2xl': 48 });

/** Default size when none (or an invalid one) is given. */
export const DEFAULT_ICON_SIZE = 'md';

/** Presentation attributes every icon is rendered with. */
export const ICON_SVG_ATTRIBUTES = Object.freeze({
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.75',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
});

/** Resolve a named or numeric size to pixels (falls back to the default). */
export function resolveIconSize(value) {
  if (value === undefined || value === null || value === '') return ICON_SIZES[DEFAULT_ICON_SIZE];
  if (Object.prototype.hasOwnProperty.call(ICON_SIZES, value)) return ICON_SIZES[value];
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= 512) return numeric;
  return ICON_SIZES[DEFAULT_ICON_SIZE];
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Render an icon as an SVG string, for components that build their markup
 * as a template string (e.g. `<ndi-error>`, `<ndi-onboarding-tour>`).
 *
 * Without `label` the icon is decorative (`aria-hidden="true"`); with one it
 * is announced as an image with that name.
 *
 * @param {string} name
 * @param {{ size?: string|number, label?: string, className?: string }} [options]
 * @returns {string}
 */
export function iconSvg(name, { size, label, className } = {}) {
  const icon = ICONS[name] ?? ICONS.help;
  const px = resolveIconSize(size);
  const attrs = Object.entries(ICON_SVG_ATTRIBUTES)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  const a11y = label
    ? `role="img" aria-label="${escapeAttr(label)}"`
    : 'aria-hidden="true" focusable="false"';
  const cls = className ? ` class="${escapeAttr(className)}"` : '';
  const title = label ? `<title>${escapeAttr(label)}</title>` : '';
  return `<svg ${attrs} width="${px}" height="${px}" ${a11y}${cls}>${title}<path d="${icon.path}"/></svg>`;
}
