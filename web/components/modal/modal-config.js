/**
 * Pure configuration helpers for the shared Ndi-Fi modal component.
 *
 * These functions are framework-agnostic and have no DOM dependencies, so
 * they can be tested in plain Node.js.
 */

/** All recognised size tokens. The first entry is the default. */
export const VALID_SIZES = Object.freeze(['md', 'sm', 'lg']);

const DEFAULT_SIZE = 'md';

function asText(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function asBoolean(value) {
  // Attribute presence is signalled by an empty string or the string 'true'.
  // A missing attribute arrives as null/undefined.
  return value !== null && value !== undefined && value !== false;
}

/**
 * Build a complete, normalised modal config from a raw attribute map.
 *
 * Unknown size tokens fall back to `md`. All fields are present on the
 * returned object so callers never need to guard for undefined.
 *
 * @param {Record<string, string | null | boolean>} attrs
 * @returns {{ size: string, sheet: boolean, label: string, noBackdropClose: boolean }}
 */
export function buildModalConfig(attrs = {}) {
  const source = attrs && typeof attrs === 'object' && !Array.isArray(attrs) ? attrs : {};

  const rawSize = asText(source.size, DEFAULT_SIZE);
  const size = VALID_SIZES.includes(rawSize) ? rawSize : DEFAULT_SIZE;

  return Object.freeze({
    size,
    sheet: asBoolean(source.sheet),
    label: asText(source.label, 'Dialog'),
    noBackdropClose: asBoolean(source['no-backdrop-close']),
  });
}
