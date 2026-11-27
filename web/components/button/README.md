# `<ndi-button>`

The standard Ndi-Fi button — the most-used component in the dApp. It
normalises variants, sizes and loading/disabled states so every action looks
and behaves consistently.

## Quick start

```bash
cd web && npm test          # node --test — no dependencies
```

Preview it in a browser:

```html
<link rel="stylesheet" href="../design-tokens/tokens.css" />
<ndi-button variant="primary">Submit</ndi-button>
<script type="module" src="./ndi-button.js"></script>
```

The design-token stylesheet is required once on the page; the component's own
styles are loaded automatically inside its shadow root.

## Attributes

| Attribute | Values | Default | Purpose |
| --- | --- | --- | --- |
| `variant` | `primary` \| `secondary` \| `ghost` \| `danger` | `primary` | Visual style |
| `size` | `sm` \| `md` \| `lg` | `md` | Height and padding |
| `loading` | boolean (presence) | off | Shows a spinner, sets `aria-busy`, disables interaction |
| `disabled` | boolean (presence) | off | Disabled styling; native `disabled` on the inner button |
| `full-width` | boolean (presence) | off | Stretches to the available width |
| `type` | `button` \| `submit` \| `reset` | `button` | Native button `type` |

## Slots

| Slot | Purpose |
| --- | --- |
| default | The button label |
| `leading` | Icon/element rendered before the label |
| `trailing` | Icon/element rendered after the label |

Empty icon slots collapse (no extra gap) thanks to a `slotchange` check that
toggles an `is-filled` class on the wrapper.

```html
<ndi-button variant="secondary">
  <svg slot="leading" width="16" height="16" aria-hidden="true">…</svg>
  Deposit
</ndi-button>

<ndi-button variant="ghost">
  Continue
  <svg slot="trailing" width="16" height="16" aria-hidden="true">…</svg>
</ndi-button>
```

## Loading and disabled states

- **Loading** shows an accessible spinner (`aria-hidden`), sets `aria-busy="true"`
  on the button, and disables it so no click fires. Clear the attribute to
  restore interactivity.
- **Disabled** sets the native `disabled` attribute; the click guard prevents
  any click from reaching listeners (and native `disabled` already suppresses it
  in browsers).

```html
<ndi-button loading>Working…</ndi-button>
<ndi-button variant="danger" disabled>Cannot withdraw</ndi-button>
```

## Accessibility

- Renders a real `<button>` inside a shadow root with `delegatesFocus`, so it has
  native semantics, focus, and form participation.
- A visible focus ring via `:focus-visible` using the `focus-ring` token.
- `aria-busy="true"` while loading; `aria-hidden` spinner glyph.
- Respects `prefers-reduced-motion` (spinner stops animating) and
  `forced-colors`.

## Styling with the design tokens

All colours, spacing, radii and typography come from the [design tokens](../../design-tokens/README.md).
They inherit through the shadow boundary, so the button automatically follows
the active light/dark theme. CSS `::part()` exposes `button`, `spinner` for
deep overrides when truly necessary.

## Tests

```bash
cd web && node --test components/button/ndi-button.test.js
```

Covers variant/size/width/type reflection, disabled and loading states
(`aria-busy`, spinner visibility, click suppression), focus delegation, icon
slots, and programmatic `click()`.
