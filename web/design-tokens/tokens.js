/**
 * Ndi-Fi design tokens — the single source of truth for visual style.
 *
 * Every other piece of the UI (components, Tailwind config, CSS variables in
 * `tokens.css`) derives from the values defined here. The structure mirrors
 * what a consumer needs:
 *
 *   color     -> semantic tokens, each with a `light` and `dark` set
 *   spacing   -> a 4px-based scale
 *   radius     -> corner radii
 *   shadow    -> elevation, each with a `light` and `dark` set
 *   typography -> font families, sizes, weights and line heights
 *
 * Theme-aware categories (`color`, `shadow`) carry paired light/dark sets that
 * MUST keep identical keys so a switch never leaves a token unstyled.
 */

/**
 * Semantic colour tokens. Names describe intent, not hue, so the same token
 * can flip between light and dark without components hard-coding a value.
 */
export const colorTokens = Object.freeze({
  light: Object.freeze({
    background: '#f6f8fc',
    surface: '#ffffff',
    'surface-raised': '#ffffff',
    'surface-muted': '#eef2f9',
    foreground: '#1b2230',
    muted: '#4c566a',
    border: '#d8dee9',
    primary: '#3457d5',
    'primary-contrast': '#ffffff',
    'primary-soft': '#eef2ff',
    secondary: '#475569',
    'secondary-contrast': '#ffffff',
    'secondary-soft': '#e2e8f0',
    danger: '#dc2626',
    'danger-contrast': '#ffffff',
    'danger-soft': '#fee2e2',
    success: '#16a34a',
    'success-contrast': '#ffffff',
    'success-soft': '#dcfce7',
    warning: '#d97706',
    'warning-contrast': '#ffffff',
    'warning-soft': '#fef3c7',
    info: '#0284c7',
    'info-contrast': '#ffffff',
    'info-soft': '#e0f2fe',
    accent: '#3457d5',
    'focus-ring': 'rgba(52, 87, 213, 0.5)',
  }),
  dark: Object.freeze({
    background: '#0d121c',
    surface: '#141a26',
    'surface-raised': '#1c2433',
    'surface-muted': '#1e2a3a',
    foreground: '#f1f5f9',
    muted: '#b8c2d4',
    border: '#3a465c',
    primary: '#7c93f5',
    'primary-contrast': '#0d121c',
    'primary-soft': '#1e2a49',
    secondary: '#cbd5e1',
    'secondary-contrast': '#0d121c',
    'secondary-soft': '#334155',
    danger: '#f87171',
    'danger-contrast': '#0d121c',
    'danger-soft': '#3a1d1d',
    success: '#4ade80',
    'success-contrast': '#0d121c',
    'success-soft': '#14351f',
    warning: '#fbbf24',
    'warning-contrast': '#0d121c',
    'warning-soft': '#3a2e0e',
    info: '#38bdf8',
    'info-contrast': '#0d121c',
    'info-soft': '#0c2a3a',
    accent: '#9db4ff',
    'focus-ring': 'rgba(157, 180, 255, 0.55)',
  }),
});

/** 4px-based spacing scale. */
export const spacingTokens = Object.freeze({
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.5rem',
  6: '2rem',
  8: '3rem',
  10: '4rem',
  12: '6rem',
  16: '8rem',
});

/** Corner radii. `md` is the default used across components. */
export const radiusTokens = Object.freeze({
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  full: '9999px',
});

/** Elevation. Dark shadows use black at higher alpha so they read on dark UI. */
export const shadowTokens = Object.freeze({
  light: Object.freeze({
    none: 'none',
    sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
    md: '0 4px 12px rgba(15, 23, 42, 0.10)',
    lg: '0 10px 30px rgba(15, 23, 42, 0.14)',
    xl: '0 20px 50px rgba(15, 23, 42, 0.18)',
  }),
  dark: Object.freeze({
    none: 'none',
    sm: '0 1px 2px rgba(0, 0, 0, 0.40)',
    md: '0 4px 12px rgba(0, 0, 0, 0.50)',
    lg: '0 10px 30px rgba(0, 0, 0, 0.60)',
    xl: '0 20px 50px rgba(0, 0, 0, 0.70)',
  }),
});

/** Typography tokens. Sizes use rem so they scale with the root font size. */
export const typographyTokens = Object.freeze({
  fontFamily: Object.freeze({
    sans: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Code", Consolas, monospace',
  }),
  fontSize: Object.freeze({
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
  }),
  fontWeight: Object.freeze({
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }),
  lineHeight: Object.freeze({
    tight: '1.2',
    normal: '1.5',
    relaxed: '1.65',
  }),
});

/** Complete token catalogue. */
export const tokens = Object.freeze({
  color: colorTokens,
  spacing: spacingTokens,
  radius: radiusTokens,
  shadow: shadowTokens,
  typography: typographyTokens,
});

export default tokens;
