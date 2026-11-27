# Ndi-Fi help UI: tooltips and inline help

Accessible, dependency-free help patterns for the DeFi concepts used across
Ndi-Fi. This folder is a standalone frontend module: the repository currently
contains contracts only, so nothing here depends on a particular framework and
it can be dropped into a future React, Svelte or plain-HTML app.

## Quick start

```bash
cd frontend
npm test          # node --test test — no npm install needed
npm run demo      # http://localhost:8080 — live examples of every pattern
```

## What is included

| Path | Purpose |
| --- | --- |
| `src/help-components.js` | `<ndi-tooltip>` and `<ndi-inline-help>` custom elements |
| `src/help-content.js` | Term catalogue, locale fallback and active-locale state |
| `src/locales/{en,es,fr}.js` | Plain-language definitions and UI labels |
| `src/styles.css` | Themeable styles, dark mode, reduced motion, forced colours |
| `index.html` | Demo page with a language switcher |
| `test/` | Content and component tests (minimal DOM shim, no dependencies) |

Covered terms include **APR**, **APY**, **collateral**, **collateral factor**,
**health factor**, **liquidation**, **LTV**, **borrow**, **yield**, **staking**,
**vault shares**, **utilization rate** and **oracle**. Definitions are generic
and are not a claim that every feature is live in the current contracts.

## Usage

```html
<link rel="stylesheet" href="/frontend/src/styles.css" />

<!-- Quick definition: tooltip on hover, focus or tap -->
<p>
  Depositors earn
  <ndi-tooltip term="apr" locale="en"></ndi-tooltip>
  on their lent assets.
</p>

<!-- Progressive disclosure: short summary now, longer explanation on demand -->
<ndi-inline-help term="healthFactor" locale="en"></ndi-inline-help>

<script type="module" src="/frontend/src/help-components.js"></script>
```

`locale` is optional: components use the active locale from `setActiveLocale()`.
`ndi-tooltip` also accepts `label` to override the screen-reader-only trigger
label (for example `label="Need help?"`).

```js
import { setActiveLocale, getTerm, listTerms, listLocales } from './src/help-content.js';

setActiveLocale('fr'); // components created afterwards use French
const entry = getTerm('collateralFactor', 'es'); // { term, summary, details, ... }
const terms = listTerms('en');
const languages = listLocales(); // [{ code: 'en', name: 'English' }, ...]
```

Unknown locales fall back to English (`es-MX` → `es`, `de-DE` → `en`), and
individual missing fields fall back to the English copy. An unknown term hides
the component instead of showing broken text.

## Accessibility

- The tooltip trigger is a real `<button type="button">` with an `aria-label`
  ("What is APR?", localised), `aria-expanded` and `aria-describedby` pointing
  at the `role="tooltip"` panel. The panel contains text only, never links or
  buttons, so it follows the ARIA tooltip pattern.
- Tooltips open on hover or keyboard focus, and close on Escape, blur or an
  outside pointer press. Escape leaves focus where it is (the trigger, for
  keyboard users) and focus is never trapped. Only one tooltip is open at a
  time.
- Inline help uses a disclosure button with `aria-expanded` /
  `aria-controls`; the revealed text is a labelled `role="region"`. The
  short summary remains visible at all times (progressive disclosure).
- Visible focus rings, `prefers-reduced-motion` and `forced-colors` support are
  in `src/styles.css`. The "?" icon is `aria-hidden`, with the accessible name
  on the button.

## Adding a language

1. Copy `src/locales/en.js` to `src/locales/<code>.js` and translate the copy.
2. Register it in the `LOCALES` map in `src/help-content.js`.
3. Add a test for the new locale's labels; the catalogue test automatically
   checks that term keys and copy stay in sync with English.
