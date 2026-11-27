/**
 * Configuration helpers for the <ndi-input> web component.
 *
 * All helpers are pure functions with no DOM dependency so they can be
 * imported and tested in Node.js without a browser environment.
 */

const VALID_TYPES = ['text', 'number', 'email', 'password', 'search', 'tel', 'url'];
const MAX_DECIMALS_UPPER = 18;
const MAX_DECIMALS_LOWER = 0;

/** Types that need decimal/numeric keyboard handling in buildInputConfig. */
const NUMERIC_TYPES = new Set(['number', 'decimal']);

function asText(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === '' || value === 'true') return true;
  if (value === 'false' || value === null || value === undefined) return fallback;
  return Boolean(value);
}

function clampInt(value, min, max, fallback) {
  if (value === null || value === undefined) return fallback;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// ── High-level config (createInputConfig) ────────────────────────────────────

/**
 * Validate and normalise options for a single <ndi-input> instance.
 *
 * @param {object} [options]
 * @param {string} [options.type]         - Input type (default: 'text')
 * @param {string} [options.label]        - Visible label text (default: '')
 * @param {string} [options.helper]       - Helper text below the input (default: '')
 * @param {string} [options.error]        - Error message; non-empty triggers error state (default: '')
 * @param {string} [options.suffix]       - Suffix label, e.g. 'ETH' (default: '')
 * @param {string} [options.placeholder]  - Input placeholder (default: '')
 * @param {number} [options.maxDecimals]  - Max decimal places 0–18 (default: 18)
 * @param {boolean} [options.showMax]     - Whether to show the MAX button (default: false)
 * @returns {Readonly<object>} Frozen config object.
 */
export function createInputConfig(options = {}) {
  const source = options && typeof options === 'object' && !Array.isArray(options) ? options : {};

  const rawType = asText(source.type, 'text').toLowerCase();
  const type = VALID_TYPES.includes(rawType) ? rawType : 'text';

  const label = asText(source.label, '');
  const helper = asText(source.helper, '');
  const error = asText(source.error, '');
  const suffix = asText(source.suffix, '');
  const placeholder = asText(source.placeholder, '');
  const maxDecimals = clampInt(source.maxDecimals, MAX_DECIMALS_LOWER, MAX_DECIMALS_UPPER, MAX_DECIMALS_UPPER);
  const showMax = asBoolean(source.showMax, false);

  return Object.freeze({
    type,
    label,
    helper,
    error,
    suffix,
    placeholder,
    maxDecimals,
    showMax,
  });
}

/**
 * Returns `true` when the config represents an error state.
 *
 * @param {Readonly<object>} config - A config object returned by {@link createInputConfig}.
 * @returns {boolean}
 */
export function isErrorState(config) {
  return typeof config?.error === 'string' && config.error.length > 0;
}

/**
 * Sanitise a raw string so it is safe to place in a numeric input.
 *
 * Rules:
 * - Strip every character that is not a digit or a `.`
 * - Allow at most one `.`
 * - Truncate the decimal part to `maxDecimals` places
 *
 * @param {string} value
 * @param {number} [maxDecimals=18]
 * @returns {string}
 */
export function formatDecimalInput(value, maxDecimals = MAX_DECIMALS_UPPER) {
  const safeMax = clampInt(maxDecimals, MAX_DECIMALS_LOWER, MAX_DECIMALS_UPPER, MAX_DECIMALS_UPPER);
  const stripped = String(value ?? '').replace(/[^\d.]/g, '');

  const dotIndex = stripped.indexOf('.');
  if (dotIndex === -1) return stripped;

  const intPart = stripped.slice(0, dotIndex);
  const rawFrac = stripped.slice(dotIndex + 1).replace(/\./g, '');
  const fracPart = safeMax > 0 ? rawFrac.slice(0, safeMax) : '';

  return safeMax > 0 ? `${intPart}.${fracPart}` : intPart;
}

// ── Attribute-level config (buildInputConfig) ────────────────────────────────
//
// Used by the ndi-input.js web component, which reads raw HTML attribute
// strings rather than a typed JS options object.  This layer handles HTML
// boolean-attribute conventions ('', null) and the 'decimal' pseudo-type that
// maps to a text input with decimal inputmode.

/**
 * Return true when `type` calls for numeric input handling.
 *
 * @param {string} type
 * @returns {boolean}
 */
export function isNumericType(type) {
  return NUMERIC_TYPES.has(typeof type === 'string' ? type.toLowerCase().trim() : '');
}

/**
 * Coerce a raw attribute value to a boolean presence flag following HTML
 * boolean-attribute semantics.
 *
 * `null`, `undefined`, and the boolean `false` are treated as absent.
 * Everything else — including `''` and `'false'` — is present.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function asBoolAttr(value) {
  return value !== null && value !== undefined && value !== false;
}

/**
 * Build a fully-normalised config object from a map of raw HTML attribute
 * values as supplied by `element.getAttribute()` / `element.hasAttribute()`.
 *
 * All keys are optional.  Unknown keys are ignored.  Invalid or absent values
 * fall back to safe defaults so a misconfigured attribute can never break the
 * rendered component.
 *
 * @param {Record<string, unknown>} [attrs]
 * @returns {{
 *   label: string,
 *   type: string,
 *   inputMode: string,
 *   pattern: string,
 *   placeholder: string,
 *   value: string,
 *   helper: string,
 *   error: string,
 *   hasError: boolean,
 *   suffix: string,
 *   showMax: boolean,
 *   disabled: boolean,
 *   required: boolean,
 *   name: string,
 *   inputId: string,
 *   min: string,
 *   max: string,
 *   step: string,
 * }}
 */
export function buildInputConfig(attrs = {}) {
  const src = attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};

  const rawType = asText(src.type, 'text');
  const numeric = isNumericType(rawType);

  // 'decimal' becomes a text input with the decimal keyboard so that mobile
  // users get a numeric keypad without the native number-input quirks (locale-
  // dependent decimal separators, hidden value on invalid input, etc.).
  const resolvedType = rawType === 'decimal' ? 'text' : rawType;
  const inputMode = numeric ? 'decimal' : '';
  // Pattern is applied only on decimal inputs; native number inputs keep their
  // own built-in constraint validation.
  const pattern = rawType === 'decimal' ? '[\\-]?[0-9]*(\\.[0-9]*)?' : '';

  const error = asText(src.error, '');
  const hasError = error.length > 0;

  return Object.freeze({
    label: asText(src.label, ''),
    type: resolvedType,
    inputMode,
    pattern,
    placeholder: asText(src.placeholder, ''),
    value: asText(src.value, ''),
    helper: asText(src.helper, ''),
    error,
    hasError,
    suffix: asText(src.suffix, ''),
    showMax: asBoolAttr(src['show-max']),
    disabled: asBoolAttr(src.disabled),
    required: asBoolAttr(src.required),
    name: asText(src.name, ''),
    inputId: asText(src.id, ''),
    min: asText(src.min, ''),
    max: asText(src.max, ''),
    step: asText(src.step, ''),
  });
}
