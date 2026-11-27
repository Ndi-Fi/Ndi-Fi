/**
 * Pure configuration helpers for the Ndi-Fi toast notification system.
 *
 * All functions are side-effect-free so they can be tested in Node without a
 * DOM, mirroring the same separation used by footer-config.js.
 */

export const DEFAULT_DURATION = 5000;
export const MAX_TOASTS = 5;

export const TOAST_TYPES = Object.freeze(['info', 'success', 'warning', 'error']);

/**
 * Inline SVG strings for each toast type. The paths are simple, well-known
 * shapes that do not depend on any icon library.
 */
const ICONS = Object.freeze({
  info: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M10 9v5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="10" cy="6.5" r="0.875" fill="currentColor"/>
  </svg>`,

  success: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M6.5 10.5l2.5 2.5 4.5-5" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,

  warning: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <path d="M9.134 3.546c.38-.728 1.352-.728 1.732 0l6.866 13.158c.367.703-.106 1.546-.866 1.546H3.134c-.76 0-1.233-.843-.866-1.546L9.134 3.546z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M10 8.5v4" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
    <circle cx="10" cy="14.5" r="0.875" fill="currentColor"/>
  </svg>`,

  error: `<svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
    <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>
  </svg>`,
});

/**
 * Return the inline SVG icon string for a toast type. Falls back to the info
 * icon for unrecognised types so callers never receive an empty string.
 *
 * @param {string} type
 * @returns {string}
 */
export function getToastIcon(type) {
  return ICONS[type] ?? ICONS.info;
}

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asNonNegativeNumber(value, fallback) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return value < 0 ? fallback : value;
}

/**
 * Build a fully-normalised toast config from caller-supplied options.
 *
 * Invalid or missing values fall back to safe defaults so a bad dispatch can
 * never break the page.
 *
 * @param {object} [options]
 * @param {string} [options.message]
 * @param {string} [options.title]
 * @param {'info'|'success'|'warning'|'error'} [options.type]
 * @param {number} [options.duration]  milliseconds; 0 = persistent
 * @returns {{ message: string, title: string, type: string, duration: number }}
 */
export function buildToastConfig(options = {}) {
  const source = options && typeof options === 'object' && !Array.isArray(options) ? options : {};

  const rawType = typeof source.type === 'string' ? source.type.trim() : '';
  const type = TOAST_TYPES.includes(rawType) ? rawType : 'info';

  const duration = asNonNegativeNumber(source.duration, DEFAULT_DURATION);

  return Object.freeze({
    message: asText(source.message, ''),
    title: asText(source.title, ''),
    type,
    duration,
  });
}
