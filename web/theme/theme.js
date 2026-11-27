/**
 * Theme preference handling for Ndi-Fi — dark-first, light-compatible, and
 * free of a flash of the wrong theme.
 *
 * Preferences:
 *   'system' (default) — follow `prefers-color-scheme`; no `data-theme` set,
 *                        so `tokens.css` picks the palette via media query.
 *   'dark' / 'light'   — explicit choice, stored and stamped as
 *                        `<html data-theme="…">`.
 *
 * ## Avoiding the flash
 *
 * The stored choice must be applied before the first paint. Inline
 * `THEME_INIT_SCRIPT` in `<head>`, *before* any stylesheet:
 *
 * ```html
 * <meta name="color-scheme" content="dark light" />
 * <script>/* paste THEME_INIT_SCRIPT here (or render it server-side) *\/</script>
 * <link rel="stylesheet" href="/web/design-tokens/tokens.css" />
 * ```
 *
 * A deferred or module script runs after first paint and is too late — the
 * page would render in the system theme, then switch.
 */

export const THEME_STORAGE_KEY = 'ndi-theme';
export const THEME_PREFERENCES = Object.freeze(['system', 'dark', 'light']);

/**
 * Self-contained, dependency-free snippet to inline in `<head>`. It mirrors
 * `applyTheme()` but cannot import anything, so keep the two in sync
 * (`theme.test.js` executes this string to check it).
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);document.documentElement.style.colorScheme=t;}}catch(e){}})();`;

function safeStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access can throw in private windows / sandboxed frames
  }
}

/** Normalise any value to a known preference. */
export function normalizePreference(value) {
  return THEME_PREFERENCES.includes(value) ? value : 'system';
}

/** Read the stored preference (falls back to 'system'). */
export function getThemePreference(storage) {
  const store = safeStorage(storage);
  try {
    return normalizePreference(store?.getItem(THEME_STORAGE_KEY));
  } catch {
    return 'system';
  }
}

/**
 * Resolve a preference to the palette actually shown.
 * @param {string} preference
 * @param {(query: string) => { matches: boolean }} [matchMedia]
 * @returns {'dark'|'light'}
 */
export function resolveTheme(preference, matchMedia = globalThis.matchMedia?.bind(globalThis)) {
  const pref = normalizePreference(preference);
  if (pref !== 'system') return pref;
  // Dark-first: when the system preference is unknown, default to dark.
  if (typeof matchMedia !== 'function') return 'dark';
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/** Stamp a preference onto the root element without storing it. */
export function applyTheme(preference, root = globalThis.document?.documentElement) {
  if (!root) return;
  const pref = normalizePreference(preference);
  if (pref === 'system') {
    root.removeAttribute('data-theme');
    if (root.style) root.style.colorScheme = '';
  } else {
    root.setAttribute('data-theme', pref);
    if (root.style) root.style.colorScheme = pref;
  }
}

/**
 * Persist and apply a preference, then announce it with an
 * `ndi-theme-change` event on the root (detail: `{ preference, theme }`).
 */
export function setThemePreference(preference, { root = globalThis.document?.documentElement, storage, matchMedia } = {}) {
  const pref = normalizePreference(preference);
  const store = safeStorage(storage);
  try {
    if (pref === 'system') store?.removeItem(THEME_STORAGE_KEY);
    else store?.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the choice still applies for this page view.
  }
  applyTheme(pref, root);
  const theme = resolveTheme(pref, matchMedia);
  if (root && typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
    root.dispatchEvent(new CustomEvent('ndi-theme-change', { detail: { preference: pref, theme } }));
  }
  return theme;
}

/** Cycle system → dark → light → system (for a single toggle button). */
export function nextPreference(current) {
  const index = THEME_PREFERENCES.indexOf(normalizePreference(current));
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length];
}
