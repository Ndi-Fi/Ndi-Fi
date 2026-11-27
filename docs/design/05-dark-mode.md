# 05 — Dark mode and WCAG AA contrast

> Issue #147 · Status: implemented in `web/design-tokens/` and `web/theme/`

DeFi users mostly run dark mode, so Ndi-Fi is **dark-first**: the dark palette
is the default when the system preference is unknown. The light palette uses the
same semantic tokens, so every component works in both themes without
theme-specific code.

## What ships

| Piece | Path | Purpose |
| --- | --- | --- |
| Tokens | `web/design-tokens/tokens.{js,css}` | Semantic colours with paired light/dark values |
| Contrast audit | `web/design-tokens/contrast.js` | WCAG 2.x ratio maths + every fg/bg pair the UI renders, grouped by screen |
| Contrast test | `web/design-tokens/contrast.test.js` | Fails CI if any pair drops below AA in either theme |
| Theme runtime | `web/theme/theme.js` | Stored preference, `system`/`dark`/`light`, no-flash init script |

## Rules

1. **Text** meets 4.5:1 against its background; large text (≥ 24px, or ≥ 18.66px
   bold) meets 3:1.
2. **Meaningful graphics** — icons, focus rings, health-gauge arcs, borders that
   carry state — meet 3:1 (WCAG 1.4.11).
3. Use only semantic tokens (`--ndi-color-*`). A raw hex in a component is a
   bug: it won't flip with the theme and isn't covered by the audit.
4. Status is never colour-only: health factor, toasts and errors pair the colour
   with an icon and words.
5. A new colour pairing goes into `AUDIT_PAIRS` in `contrast.js` in the same PR.

## Audit results

Run it yourself:

```bash
node web/design-tokens/contrast.js        # pass/fail per pair
node web/design-tokens/contrast.js --md   # this table
```

Every pair the design system renders, grouped by the key screen that shows it
(ratios are `x:1`):

| Screen | Use | Foreground / background | Light | Dark | Needs |
| --- | --- | --- | --- | --- | --- |
| App shell | Body copy | `foreground` / `background` | 14.98 | 17.11 | 4.5:1 |
| App shell | Secondary copy | `muted` / `background` | 6.94 | 10.45 | 4.5:1 |
| App shell | Links | `accent` / `background` | 5.69 | 9.29 | 4.5:1 |
| App shell | Focus ring | `focus-ring` / `background` | 3.85 | 3.59 | 3:1 |
| Dashboard | Card text | `foreground` / `surface` | 15.93 | 15.90 | 4.5:1 |
| Dashboard | Card labels | `muted` / `surface` | 7.38 | 9.71 | 4.5:1 |
| Dashboard | Table header | `muted` / `surface-muted` | 6.57 | 8.09 | 4.5:1 |
| Dashboard | Popover / modal | `foreground` / `surface-raised` | 15.93 | 14.20 | 4.5:1 |
| Dashboard | Popover / tour body | `muted` / `surface-raised` | 7.38 | 8.67 | 4.5:1 |
| Dashboard | Tour step icon | `accent` / `surface-raised` | 6.05 | 7.71 | 3:1 |
| Dashboard | Links in cards | `accent` / `surface` | 6.05 | 8.63 | 4.5:1 |
| Dashboard | Focus ring on cards | `focus-ring` / `surface` | 4.02 | 3.52 | 3:1 |
| Lending | Healthy factor value | `success` / `surface` | 5.02 | 10.00 | 4.5:1 |
| Lending | Near-threshold value | `warning` / `surface` | 5.02 | 10.44 | 4.5:1 |
| Lending | Liquidatable value | `danger` / `surface` | 4.83 | 6.30 | 4.5:1 |
| Lending | Informational value | `info` / `surface` | 5.93 | 8.13 | 4.5:1 |
| Lending | Health gauge (safe) | `success` / `background` | 4.72 | 10.76 | 3:1 |
| Lending | Health gauge (caution) | `warning` / `background` | 4.72 | 11.23 | 3:1 |
| Lending | Health gauge (danger) | `danger` / `background` | 4.54 | 6.78 | 3:1 |
| Actions | Primary button | `primary-contrast` / `primary` | 6.05 | 6.56 | 4.5:1 |
| Actions | Secondary button | `secondary-contrast` / `secondary` | 7.58 | 12.62 | 4.5:1 |
| Actions | Destructive button | `danger-contrast` / `danger` | 4.83 | 6.78 | 4.5:1 |
| Actions | Success button | `success-contrast` / `success` | 5.02 | 10.76 | 4.5:1 |
| Actions | Warning button | `warning-contrast` / `warning` | 5.02 | 11.23 | 4.5:1 |
| Actions | Info button | `info-contrast` / `info` | 5.93 | 8.75 | 4.5:1 |
| Actions | Ghost / outline button | `primary` / `surface` | 6.05 | 6.10 | 4.5:1 |
| Actions | Soft button | `primary` / `primary-soft` | 5.41 | 4.96 | 4.5:1 |
| Feedback | Error banner text | `foreground` / `danger-soft` | 13.04 | 13.96 | 4.5:1 |
| Feedback | Error icon | `danger` / `danger-soft` | 3.95 | 5.53 | 3:1 |
| Feedback | Warning banner text | `foreground` / `warning-soft` | 14.31 | 12.16 | 4.5:1 |
| Feedback | Warning icon | `warning` / `warning-soft` | 4.51 | 7.98 | 3:1 |
| Feedback | Success banner text | `foreground` / `success-soft` | 14.51 | 12.30 | 4.5:1 |
| Feedback | Success icon | `success` / `success-soft` | 4.57 | 7.73 | 3:1 |
| Feedback | Info banner text | `foreground` / `info-soft` | 13.88 | 13.62 | 4.5:1 |
| Feedback | Info icon | `info` / `info-soft` | 5.17 | 6.96 | 3:1 |
| Feedback | Neutral chip | `foreground` / `secondary-soft` | 12.92 | 9.45 | 4.5:1 |

### What the audit changed

The dark palette already passed. Ten light-theme pairs failed; four token
values were darkened to fix all of them:

| Token (light) | Before | After | Failing pairs fixed |
| --- | --- | --- | --- |
| `success` | `#16a34a` | `#15803d` | text on surface 3.30 → 5.02; white button text 3.30 → 5.02 |
| `warning` | `#d97706` | `#b45309` | text on surface 3.19 → 5.02; white button text 3.19 → 5.02; gauge on background 3.00 → 4.72; icon on `warning-soft` 2.86 → 4.51 |
| `info` | `#0284c7` | `#0369a1` | text on surface 4.10 → 5.93; white button text 4.10 → 5.93 |
| `focus-ring` | `rgba(52,87,213,.5)` | `rgba(52,87,213,.8)` | ring on background 2.19 → 3.85; on surface 2.24 → 4.02 |

Translucent colours (the focus ring) are composited over the background before
the ratio is calculated, the same way the browser paints them.

## Theme switching without a flash

Preferences are `system` (default), `dark` and `light`. `system` leaves
`<html>` without `data-theme`, and `tokens.css` picks the palette with
`prefers-color-scheme`, so CSS alone handles it before any script runs. An
explicit choice is stored in `localStorage` (`ndi-theme`) and stamped as
`<html data-theme="…">`.

To avoid painting the wrong theme first, the stored choice is applied by a tiny
**synchronous inline script in `<head>`, before the stylesheet**:

```html
<head>
  <meta name="color-scheme" content="dark light" />
  <script>/* THEME_INIT_SCRIPT from web/theme/theme.js */</script>
  <link rel="stylesheet" href="/web/design-tokens/tokens.css" />
</head>
```

- `THEME_INIT_SCRIPT` is exported as a string so a server or build step can
  inline it. It has no imports, and it catches storage errors (private windows,
  blocked cookies), so it can't break page load.
- A `type="module"`, `defer` or bundled script runs after first paint, which is
  too late. Only the inline script prevents the flash.
- `meta[name=color-scheme]` and `style.colorScheme` keep native form controls
  and scrollbars in the right theme from the first frame.
- `theme.test.js` runs the exact string in a VM to check it applies a stored
  theme, ignores invalid values and survives a throwing `localStorage`.

Runtime API (`web/theme/theme.js`): `getThemePreference()`,
`setThemePreference(pref)` (persists, applies and fires `ndi-theme-change`),
`resolveTheme(pref)` (dark-first when the system preference is unknown),
`nextPreference(pref)` for a single toggle button. `web/icons.html` shows a
working toggle.

## Checking a screen by hand

The automated audit covers token pairs. When reviewing a new screen, also:

1. Toggle `system → dark → light` and reload in each. There should be no flash,
   and nothing unstyled or hard-coded.
2. Run a contrast checker (browser DevTools' *Contrast* panel, or axe) on any
   text over images, gradients or charts. The token audit can't see those.
3. Check that charts use token colours and that adjacent series differ by more
   than hue.
4. Turn on forced colours (Windows High Contrast). Components use system
   colours under `@media (forced-colors: active)`.

## Acceptance criteria

- [x] All colours meet WCAG AA for text and meaningful graphics — 36 pairs × 2
      themes enforced in CI by `contrast.test.js`.
- [x] Dark-first components that also work in light mode — semantic tokens, and
      `resolveTheme()` defaults to dark.
- [x] No flash of incorrect theme — synchronous `THEME_INIT_SCRIPT`, plus CSS
      `prefers-color-scheme` for the `system` default.
- [x] Audit key screens with a contrast checker — table above, grouped by
      screen, regenerated with `contrast.js --md`.
