# `<ndi-card>`

A shadow-DOM custom element for protocol panel surfaces. It provides a consistent card layout with optional heading, loading shimmer, and error states. All content regions are exposed as named slots so the parent controls the markup.

## Usage

### Default card

```html
<script type="module" src="/web/components/card/ndi-card.js"></script>

<ndi-card heading="Staking Overview" label="Staking panel">
  <p>Your staked balance: <strong>1,200 NDI</strong></p>
  <div slot="footer">
    <button>Stake more</button>
  </div>
</ndi-card>
```

### Compact card

```html
<ndi-card variant="compact" heading="APY">
  <p>Current rate: 8.4%</p>
</ndi-card>
```

### Loading card

Applies an animated shimmer overlay. Screen readers receive `aria-busy="true"` on the card root.

```html
<ndi-card heading="Lending Pool" loading>
  <p>Loading pool data…</p>
</ndi-card>
```

### Error card

Renders an accessible `role="alert"` panel below the body.

```html
<ndi-card heading="Lending Pool" error error-message="Failed to fetch pool data. Please try again.">
  <!-- body content still visible behind the error panel -->
</ndi-card>
```

Default message when `error-message` is omitted:

```html
<ndi-card error></ndi-card>
<!-- shows "Something went wrong." -->
```

### Card with named slots

All three regions accept slotted content:

```html
<ndi-card label="Vault summary">
  <div slot="header">
    <h3>Vault #1</h3>
    <span class="badge">Active</span>
  </div>

  <dl>
    <dt>Total deposits</dt>
    <dd>42,000 DAI</dd>
  </dl>

  <div slot="footer">
    <a href="/vault/1">View details →</a>
  </div>
</ndi-card>
```

> **Note:** when the `heading` attribute is set, it replaces the `header` slot with an auto-rendered `<h3>`. To use custom header markup, omit the `heading` attribute and populate the `header` slot instead.

---

## Attributes

| Attribute       | Type    | Default                  | Description |
|-----------------|---------|--------------------------|-------------|
| `variant`       | string  | `"default"`              | `"default"` or `"compact"`. Unknown values fall back to `"default"`. |
| `heading`       | string  | —                        | Renders an `<h3>` in the header region. When set, the `header` slot is not rendered. |
| `label`         | string  | —                        | Sets `aria-label` on the card's `<article>` root. |
| `loading`       | boolean | `false`                  | Shows an animated shimmer overlay and sets `aria-busy="true"`. |
| `error`         | boolean | `false`                  | Shows an error panel with `role="alert"`. |
| `error-message` | string  | `"Something went wrong."` | Message text shown inside the error panel. |

---

## Slots

| Slot name | Description |
|-----------|-------------|
| `header`  | Header region. Ignored when the `heading` attribute is set. Hidden when empty. |
| *(default)* | Body content of the card. |
| `footer`  | Footer region. Hidden when empty. |

---

## CSS custom properties

Override these on the element or any ancestor to theme the card.

| Property                    | Default (dark)                      | Default (light)                     | Description |
|-----------------------------|-------------------------------------|-------------------------------------|-------------|
| `--ndi-card-bg`             | `#111b2e`                           | `#ffffff`                           | Card background colour. |
| `--ndi-card-border`         | `rgba(226,236,255,0.16)`            | `rgba(19,32,51,0.12)`               | Border and divider colour. |
| `--ndi-card-fg`             | `#edf3ff`                           | `#132033`                           | Primary text colour. |
| `--ndi-card-muted`          | `#aab8d0`                           | `#4a5b74`                           | Secondary / muted text colour. |
| `--ndi-card-accent`         | `#7dd3fc`                           | `#0369a1`                           | Accent / link colour. |
| `--ndi-card-radius`         | `12px`                              | `12px`                              | Border radius. |
| `--ndi-card-shadow`         | `0 2px 12px rgba(0,0,0,0.3)`        | `0 2px 8px rgba(19,32,51,0.08)`     | Box shadow. |
| `--ndi-card-padding`        | `1.5rem`                            | `1.5rem`                            | Padding for `default` variant. |
| `--ndi-card-padding-compact`| `0.875rem`                          | `0.875rem`                          | Padding for `compact` variant. |

Example override:

```css
ndi-card {
  --ndi-card-bg: #1a2744;
  --ndi-card-radius: 8px;
}
```

---

## Running the tests

```bash
node --test web/components/card/ndi-card.test.js
```

The test file covers `createCardConfig` from `card-config.js`. It has no browser dependency and runs directly in Node.js.
