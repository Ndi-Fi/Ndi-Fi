# Ndi-Fi design tokens

The single source of truth for the dApp's visual style. Every screen and
component should consume these tokens instead of hard-coded values, so the
UI stays consistent and light/dark themes stay in sync.

| File | Role |
| --- | --- |
| `tokens.js` | Canonical token source (JS). The Tailwind config and tests derive from this. |
| `tokens.css` | The same tokens as CSS custom properties — the runtime source for plain-CSS and Web-Component styling. |
| `tailwind.config.js` | A Tailwind theme built from `tokens.js`. Drop it into a Tailwind project to get token-backed utilities. |
| `tokens.test.js` | Asserts structure, light/dark parity, and that the CSS and JS stay in sync. |

## Quick start (no build step)

```html
<link rel="stylesheet" href="./design-tokens/tokens.css" />

<style>
  .card {
    background: var(--ndi-color-surface);
    color: var(--ndi-color-foreground);
    border: 1px solid var(--ndi-color-border);
    border-radius: var(--ndi-radius-lg);
    box-shadow: var(--ndi-shadow-md);
    padding: var(--ndi-space-4);
    font-family: var(--ndi-font-sans);
  }
</style>
```

CSS custom properties inherit through shadow-DOM boundaries, so a component
that lives in a shadow root can read the `--ndi-*` variables defined on
`:root` without re-declaring them.

## With Tailwind

```js
// tailwind.config.js
import ndiConfig from './web/design-tokens/tailwind.config.js';

export default {
  ...ndiConfig,
  content: ['./src/'],
};
```

Colour and shadow utilities reference the CSS variables, so `bg-primary`,
`text-danger`, and `shadow-md` all follow the active theme automatically — no
`dark:` variant required. `darkMode` is wired to `[data-theme="dark"]` so any
`dark:` utilities you add align with the manual toggle.

> Requires Tailwind CSS v3.4.1+ (for the `darkMode: ['selector', ...]` form).
> The CSS-variable theming works on its own regardless of Tailwind version.

## Theming

Two modes ship: **light** and **dark**. By default the theme follows the
user's system preference (`prefers-color-scheme`). Override it explicitly by
setting `data-theme` on the root element:

```html
<html data-theme="dark">  <!-- force dark -->
<html data-theme="light"> <!-- force light, even if the system is dark -->
```

Internally each theme-aware value is defined twice (`--ndi-color-light-*` /
`--ndi-color-dark-*`) and the active `--ndi-color-*` variable re-points to the
matching source. This keeps raw values in one place while supporting both
automatic and manual theming.

## Token reference

### Colour (semantic)

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#f6f8fc` | `#0d121c` | Page background |
| `surface` | `#ffffff` | `#141a26` | Cards, panels |
| `surface-raised` | `#ffffff` | `#1c2433` | Popovers, dialogs |
| `surface-muted` | `#eef2f9` | `#1e2a3a` | Inset / muted surfaces |
| `foreground` | `#1b2230` | `#f1f5f9` | Primary text |
| `muted` | `#4c566a` | `#b8c2d4` | Secondary text |
| `border` | `#d8dee9` | `#3a465c` | Hairlines, dividers |
| `primary` | `#3457d5` | `#7c93f5` | Primary actions |
| `primary-contrast` | `#ffffff` | `#0d121c` | Text on `primary` |
| `primary-soft` | `#eef2ff` | `#1e2a49` | Primary hover/background |
| `secondary` | `#475569` | `#cbd5e1` | Secondary actions |
| `secondary-contrast` / `-soft` | … | … | Secondary text/background |
| `danger` (+ `-contrast`, `-soft`) | `#dc2626` | `#f87171` | Destructive actions |
| `success` (+ `-contrast`, `-soft`) | `#16a34a` | `#4ade80` | Positive states |
| `warning` (+ `-contrast`, `-soft`) | `#d97706` | `#fbbf24` | Caution |
| `info` (+ `-contrast`, `-soft`) | `#0284c7` | `#38bdf8` | Information |
| `accent` | `#3457d5` | `#9db4ff` | Highlights, links |
| `focus-ring` | `rgba(52,87,213,.5)` | `rgba(157,180,255,.55)` | Focus outlines |

Each semantic colour is available as `--ndi-color-<name>` and (for Tailwind)
`bg-<name>`, `text-<name>`, `border-<name>`, etc.

### Spacing (`--ndi-space-<n>`)

4px-based scale: `0`, `1` (0.25rem), `2` (0.5rem), `3` (0.75rem), `4` (1rem),
`5` (1.5rem), `6` (2rem), `8` (3rem), `10` (4rem), `12` (6rem), `16` (8rem).

### Radius (`--ndi-radius-<n>`)

`none`, `sm` (4px), `md` (8px), `lg` (12px), `xl` (16px), `full` (9999px).
`--ndi-radius` is an alias for `md`.

### Shadow (`--ndi-shadow-<n>`)

`none`, `sm`, `md`, `lg`, `xl`. Dark-mode shadows use black at higher alpha so
elevation still reads on a dark background.

### Typography

| Category | Tokens |
| --- | --- |
| Font family | `--ndi-font-sans`, `--ndi-font-mono` |
| Font size | `--ndi-text-xs` … `--ndi-text-3xl` |
| Font weight | `--ndi-weight-normal`/`medium`/`semibold`/`bold` |
| Line height | `--ndi-leading-tight`/`normal`/`relaxed` |

## Keeping the source in sync

`tokens.js` and `tokens.css` are hand-maintained. `tokens.test.js` fails if a
token is added to one but not the other, or if the light and dark sets drift
apart, so the "single source of truth" guarantee is enforced in CI.
