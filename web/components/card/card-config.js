/**
 * Pure configuration helpers for the <ndi-card> component.
 *
 * All functions are side-effect-free so they can be tested in Node without a
 * DOM. The Web Component calls these at render time to get a normalised,
 * frozen config object.
 */

export const VALID_VARIANTS = Object.freeze(['default', 'compact']);

export const DEFAULT_CARD_CONFIG = Object.freeze({
  label: '',
  variant: 'default',
  loading: false,
  error: '',
  compact: false,
});

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asBool(value) {
  // Present-but-empty HTML attributes arrive as '' or null; both are truthy
  // when the attribute is set. The JS boolean false means "not present".
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return false;
  // A string value of exactly "false" is treated as absent (consistent with
  // how frameworks serialise boolean props to attributes).
  return String(value).toLowerCase() !== 'false';
}

/**
 * Derive a normalised card config from an attribute map.
 *
 * `attrs` is a plain object whose keys mirror the observed HTML attributes:
 *   - loading  — string | null  (attribute value; presence = true)
 *   - error    — string | null  (error message when present)
 *   - compact  — string | null  (attribute value; presence = true)
 *   - label    — string | null  (accessible label for the card)
 *
 * Unknown keys are ignored. All fields fall back to the defaults so a missing
 * or malformed value never breaks a render.
 */
export function buildCardConfig(attrs) {
  const source =
    attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};

  const loading = asBool(source.loading !== undefined ? source.loading : null);
  const compact = asBool(source.compact !== undefined ? source.compact : null);

  // The error attribute doubles as a boolean flag and a message string.
  // If present but empty we still consider the card in an error state.
  const rawError = source.error;
  const hasError = rawError !== null && rawError !== undefined;
  const errorMessage = hasError ? asText(rawError, '') : '';

  return Object.freeze({
    label: asText(source.label, DEFAULT_CARD_CONFIG.label),
    loading,
    error: hasError ? errorMessage : DEFAULT_CARD_CONFIG.error,
    compact,
    // Convenience boolean so callers don't need to inspect the error string.
    hasError,
  });
}

/**
 * Return the ARIA attributes that the card root element should carry for the
 * given config. The return value is a frozen plain object; apply the keys with
 * individual setAttribute calls or Object.assign.
 */
export function cardAriaAttrs(config) {
  const attrs = {};

  if (config.label) attrs['aria-label'] = config.label;
  if (config.loading) attrs['aria-busy'] = 'true';
  if (config.hasError) attrs['aria-invalid'] = 'true';

  return Object.freeze(attrs);
}
