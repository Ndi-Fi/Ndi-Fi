# Icons and iconography guidelines

One outline icon set for the whole dApp, shipped as SVG path data
(`icons.js`), a Web Component (`<ndi-icon>`) and a string helper
(`iconSvg()`) for components that render template strings. No icon font, no
sprite sheet, no runtime dependency.

Open [`../../icons.html`](../../icons.html) to see every icon at every size
in both themes.

## Quick start

```html
<link rel="stylesheet" href="/web/design-tokens/tokens.css" />
<script type="module" src="/web/components/icon/ndi-icon.js"></script>

<button class="ndi-button">
  <ndi-icon name="deposit"></ndi-icon>
  Deposit
</button>
```

```js
import { iconSvg } from '/web/components/icon/icons.js';

element.innerHTML = `${iconSvg('warning', { size: 'sm' })} Health factor is low`;
```

## The set (46 icons)

| Group | Icons |
| --- | --- |
| DeFi actions | `deposit` `withdraw` `borrow` `repay` `stake` `rewards` `swap` |
| Wallet & network | `wallet` `connect-wallet` `network` `switch-network` |
| Positions & risk | `dashboard` `positions` `history` `health` `liquidation` `risk` `lock` `unlock` |
| Status & feedback | `info` `success` `warning` `error` `help` `lightbulb` `book` `sparkle` |
| Interface | `check` `close` `plus` `minus` `menu` `refresh` `arrow-left` `arrow-right` `chevron-up` `chevron-down` `chevron-left` `chevron-right` `external-link` `copy` `search` `settings` `user` `sun` `moon` |

Every icon's `title` in `icons.js` is the suggested accessible name when the
icon has to carry meaning on its own.

## Sizing

| Size | px | Use for |
| --- | --- | --- |
| `xs` | 12 | Inside dense badges and chips only |
| `sm` | 16 | Inline with `--ndi-text-sm`/`md` copy, table cells, input adornments |
| `md` *(default)* | 20 | Buttons, menu items, nav, toasts, banners |
| `lg` | 24 | Icon-only buttons, page-level alerts, section headers |
| `xl` | 32 | Empty states, error states, onboarding steps |
| `2xl` | 48 | Hero / feature illustrations |

- Stick to the named sizes. A pixel value (`size="18"`) is an escape hatch for
  third-party layouts, not a design choice.
- Match icon size to the type it sits next to: `sm` with 14–16px text, `md`
  with 16–18px text, `lg` with headings.
- Never scale icons with CSS `transform` — set `size`. The stroke is defined in
  viewBox units, so it scales with the icon (1.75px at `lg`/24px, ~1.46px at
  `md`, ~2.3px at `xl`), which keeps the weight proportional at every size.

## Alignment and spacing

- `<ndi-icon>` is `inline-flex` with `line-height: 0`, so in a flex row use
  `align-items: center`; it will not add line-height of its own.
- Gap between an icon and its label is `--ndi-space-2` (8px) for `md`/`lg` and
  `--ndi-space-1` (4px) for `xs`/`sm`.
- Leading icons go before the label (*Deposit*, *Connect wallet*). Trailing
  icons are reserved for direction and destination: `arrow-right`,
  `chevron-down`, `external-link`.
- Icon-only buttons need a 44×44px minimum hit area even when the icon is
  `lg` (24px) — pad the button, not the icon.

## Colour

- Icons draw with `currentColor`. Set `color` on the parent (or nothing at
  all); never hard-code a fill or stroke.
- Status icons take the matching semantic token: `success` →
  `--ndi-color-success`, `warning` → `--ndi-color-warning`, `error` →
  `--ndi-color-danger`, `info` → `--ndi-color-info`. Every one of these meets
  3:1 non-text contrast on `background`, `surface` and its `-soft` tint in both
  themes (enforced by `design-tokens/contrast.test.js`).
- Never use colour as the only signal: a red `error` icon still sits next to
  text that says what went wrong.

## Accessibility

An icon is either **decorative** or **meaningful**. Decide per use, not per
icon.

| Situation | Markup | Result |
| --- | --- | --- |
| Icon next to a text label | `<ndi-icon name="deposit">` | `aria-hidden="true"` — the label already says it |
| Icon-only button or link | `<button aria-label="Close"><ndi-icon name="close"></ndi-icon></button>` | Name lives on the control; the icon stays hidden |
| Icon conveys information on its own (status column, legend) | `<ndi-icon name="warning" label="At risk">` | `role="img"`, `aria-label`, and a `<title>` tooltip |
| Label given but text repeats it | `<ndi-icon name="warning" label="Warning" decorative>` | `decorative` forces `aria-hidden` |

Rules:

1. Decorative is the default. Only add `label` when removing the icon would
   lose information.
2. Put the accessible name on the interactive element, not the icon inside it.
3. Labels describe meaning, not shape: `label="At risk"`, not
   `label="Red triangle"`.
4. `external-link` icons on links that open a new tab should be paired with
   visually hidden text *"(opens in a new tab)"*.
5. All SVGs are rendered with `focusable="false"` so legacy Edge/IE never puts
   them in the tab order.

## Drawing rules (for new icons)

- 24×24 grid, 2px padding → 20×20 live area. Circles use `r="9"`.
- Outline only: `stroke-width: 1.75`, round caps and joins, no fills. A dot is
  a zero-length segment (`h.01`).
- One `<path>` per icon. Start with an absolute `M`; keep every absolute
  coordinate within 0–24 (`icons.test.js` enforces this).
- Optical, not mathematical, balance: wide shapes (wallet, rewards) may touch
  the 2px padding; circles stay at r=9.
- Name icons by **what they mean in Ndi-Fi** (`borrow`, `liquidation`), not by
  what they depict (`arrow-into-bracket`, `trend-down`).

To add an icon: add `{ title, path }` to `ICONS` in `icons.js`, add it to the
table above and to the gallery group in `icons.html`, then run `npm test` from
`web/`.

## API

### `<ndi-icon>`

| Attribute | Default | Description |
| --- | --- | --- |
| `name` | — | Icon key. Unknown names render `help` and warn once in the console. |
| `size` | `md` | `xs`/`sm`/`md`/`lg`/`xl`/`2xl`, or a pixel integer (1–512). |
| `label` | — | Accessible name. Makes the icon meaningful. |
| `decorative` | absent | Forces `aria-hidden` even if `label` is set. |

### `icons.js`

| Export | Description |
| --- | --- |
| `ICONS` | Frozen map of `name → { title, path }`. |
| `ICON_NAMES` | Sorted list of names. |
| `ICON_SIZES` | Named size → px. |
| `resolveIconSize(value)` | Named or numeric size → px, with fallback. |
| `iconSvg(name, { size, label, className })` | SVG markup string, decorative unless `label` is given. |
