import en from './locales/en.js';
import es from './locales/es.js';
import fr from './locales/fr.js';

/** All bundled locales. English is the fallback for unknown locales and keys. */
export const LOCALES = Object.freeze({ en, es, fr });
export const DEFAULT_LOCALE = 'en';

let activeLocale = DEFAULT_LOCALE;

/**
 * Map a BCP-47 / POSIX tag (for example `es-MX` or `fr_CA`) to a bundled
 * locale code. Returns null when no translation is available.
 */
export function normalizeLocale(locale) {
  if (typeof locale !== 'string') return null;
  const base = locale.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  return Object.hasOwn(LOCALES, base) ? base : null;
}

/** Like normalizeLocale, but falls back to English instead of null. */
export function resolveLocale(locale) {
  return normalizeLocale(locale) ?? DEFAULT_LOCALE;
}

/** Metadata for every language a UI can offer. */
export function listLocales() {
  return Object.entries(LOCALES).map(([code, data]) => ({ code, name: data.name }));
}

/**
 * Replace `{name}` placeholders. Unknown placeholders are left untouched so
 * missing translation data is visible instead of silently disappearing.
 */
export function formatString(template, values = {}) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{([\w-]+)\}/g, (match, key) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

/** Localised UI labels (trigger, disclosure button, etc.). */
export function getUiString(key, locale = activeLocale, values = {}) {
  const code = resolveLocale(locale);
  const template = LOCALES[code].ui?.[key] ?? LOCALES[DEFAULT_LOCALE].ui?.[key];
  return formatString(template, values);
}

/**
 * Return the plain-language entry for a concept.
 * Individual fields fall back to English, so a partially translated locale
 * never renders empty copy. Unknown concepts return null.
 */
export function getTerm(key, locale = activeLocale) {
  if (typeof key !== 'string' || key.trim() === '') return null;

  const code = resolveLocale(locale);
  const translated = LOCALES[code].terms?.[key];
  const fallback = LOCALES[DEFAULT_LOCALE].terms?.[key];
  if (!translated && !fallback) return null;

  const source = translated ?? fallback;
  const get = (field) => translated?.[field] ?? fallback?.[field] ?? '';

  return {
    key,
    locale: translated ? code : DEFAULT_LOCALE,
    term: get('term'),
    summary: get('summary'),
    details: get('details'),
  };
}

/** Every known concept, in the order defined by the English source file. */
export function listTerms(locale = activeLocale) {
  const code = resolveLocale(locale);
  return Object.keys(LOCALES[DEFAULT_LOCALE].terms)
    .map((key) => getTerm(key, code))
    .filter(Boolean);
}

/** Process-wide default used by components that do not set a `locale`. */
export function setActiveLocale(locale) {
  activeLocale = resolveLocale(locale);
  return activeLocale;
}

export function getActiveLocale() {
  return activeLocale;
}
