/**
 * Tailwind theme configuration derived from the Ndi-Fi design tokens.
 *
 * Theme-aware tokens (colour, shadow) are exposed as CSS-variable references so
 * utilities like `bg-primary` or `shadow-md` automatically follow the light/dark
 * switch defined in `tokens.css` — no `dark:` variant needed for them. Static
 * tokens (spacing, radius, typography) use their literal values.
 *
 * Requires Tailwind CSS v3.4.1+ (for the `darkMode: ['selector', ...]` form).
 * The CSS-variable theming works independently of the `dark:` variant.
 *
 * Usage in a Tailwind project (tailwind.config.js at your project root):
 *   import ndiConfig from './web/design-tokens/tailwind.config.js';
 *   export default { ...ndiConfig, content: ['./src/'] };
 */
import {
  colorTokens,
  spacingTokens,
  radiusTokens,
  shadowTokens,
  typographyTokens,
} from './tokens.js';

/** Flat colour map where each value points to its CSS variable. */
function themeColors() {
  const colors = {};
  for (const key of Object.keys(colorTokens.light)) {
    colors[key] = `var(--ndi-color-${key})`;
  }
  return colors;
}

/** Flat shadow map referencing the theme-aware CSS variables. */
function themeShadows() {
  const shadows = { none: 'var(--ndi-shadow-none)' };
  for (const key of Object.keys(shadowTokens.light)) {
    if (key === 'none') continue;
    shadows[key] = `var(--ndi-shadow-${key})`;
  }
  shadows.DEFAULT = 'var(--ndi-shadow-md)'; // `shadow` with no suffix
  return shadows;
}

const config = {
  // Match the manual theme attribute used by tokens.css. With CSS-variable
  // colours this is optional, but keeps `dark:` variants consistent.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: themeColors(),
      spacing: { ...spacingTokens },
      borderRadius: {
        none: 'var(--ndi-radius-none)',
        sm: 'var(--ndi-radius-sm)',
        DEFAULT: 'var(--ndi-radius-md)',
        md: 'var(--ndi-radius-md)',
        lg: 'var(--ndi-radius-lg)',
        xl: 'var(--ndi-radius-xl)',
        full: 'var(--ndi-radius-full)',
      },
      boxShadow: themeShadows(),
      fontFamily: {
        sans: 'var(--ndi-font-sans)',
        mono: 'var(--ndi-font-mono)',
      },
      fontSize: { ...typographyTokens.fontSize },
      fontWeight: { ...typographyTokens.fontWeight },
      lineHeight: { ...typographyTokens.lineHeight },
      // Token-driven focus ring, reusable as `ring-focus` / `outline-focus`.
      ringColor: { focus: 'var(--ndi-color-focus-ring)' },
      outlineColor: { focus: 'var(--ndi-color-accent)' },
    },
  },
};

export default config;
