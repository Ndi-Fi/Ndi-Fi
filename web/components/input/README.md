# `<ndi-input>` — Accessible Input & FormField

A shadow-DOM custom element that wraps a native `<input>` with an accessible label, helper text, error messaging, an optional token-symbol suffix, and an optional MAX button for DeFi amount fields.

No external dependencies. Works in any page that loads the file as an ES module.

---

## Usage

```html
<script type="module" src="/web/components/input/ndi-input.js"></script>

<!-- Plain text field -->
<ndi-input
  label="Wallet address"
  placeholder="0x…"
  name="address"
  helper="Enter your Ethereum address"
></ndi-input>

<!-- Number field with suffix and MAX button -->
<ndi-input
  type="number"
  label="Amount"
  placeholder="0.00"
  suffix="ETH"
  max-decimals="6"
  show-max
  helper="Enter the amount to deposit"
></ndi-input>

<!-- Error state -->
<ndi-input
  label="Amount"
  value="999999"
  error="Exceeds available balance"
  suffix="USDC"
></ndi-input>

<!-- Disabled -->
<ndi-input
  label="Amount"
  value="100"
  disabled
></ndi-input>
```

---

## Attributes

| Attribute      | Type    | Default | Description |
|----------------|---------|---------|-------------|
| `type`         | string  | `text`  | Input type. Accepts `text`, `number`, `email`, `password`, `search`, `tel`, `url`. When `number`, the field validates decimal input client-side and shows a decimal keyboard on mobile. |
| `label`        | string  | `""`    | Visible label text rendered above the input. |
| `placeholder`  | string  | `""`    | Native input placeholder. |
| `value`        | string  | `""`    | Initial value. Also settable via the `value` JS property. |
| `name`         | string  | `""`    | Maps to the native `name` attribute for form submission. |
| `helper`       | string  | `""`    | Helper text displayed below the input. Hidden when empty. |
| `error`        | string  | `""`    | Error message displayed below the input. Non-empty value triggers the error state (red border, `aria-invalid`). Takes visual precedence over helper text. |
| `suffix`       | string  | `""`    | Short label shown at the right of the input row (e.g. `ETH`, `USDC`). Hidden when empty. |
| `max-decimals` | integer | `18`    | Maximum decimal places allowed when `type="number"`. Clamped to 0–18. |
| `show-max`     | boolean | absent  | When present, shows a MAX button that fires `ndi:max`. |
| `disabled`     | boolean | absent  | Disables the input and MAX button; reduces opacity. |
| `readonly`     | boolean | absent  | Maps to the native `readonly` attribute. |

---

## Events

| Event        | Bubbles | Composed | Detail              | Description |
|--------------|---------|----------|---------------------|-------------|
| `ndi:input`  | ✓       | ✓        | `{ value: string }` | Fired on every keystroke. For `type="number"` the value is already sanitised to `max-decimals` precision. |
| `ndi:change` | ✓       | ✓        | `{ value: string }` | Fired when the input loses focus after a value change (native `change` event semantics). |
| `ndi:max`    | ✓       | ✓        | _(none)_            | Fired when the MAX button is clicked. The parent is responsible for setting the value. |

```js
document.querySelector('ndi-input').addEventListener('ndi:input', (e) => {
  console.log(e.detail.value); // sanitised string
});

document.querySelector('ndi-input').addEventListener('ndi:max', () => {
  document.querySelector('ndi-input').value = getMaxBalance();
});
```

---

## JS Property

```js
const input = document.querySelector('ndi-input');

// Read current value
console.log(input.value);

// Set value programmatically
input.value = '1.5';
```

---

## CSS Custom Properties

All properties are set on `:host` and can be overridden per-instance with inline styles or a parent selector.

| Property                    | Dark default                    | Light default                  | Description |
|-----------------------------|---------------------------------|--------------------------------|-------------|
| `--ndi-input-bg`            | `#0b1220`                       | `#ffffff`                      | Input background colour. |
| `--ndi-input-border`        | `rgba(226,236,255,0.16)`        | `rgba(19,32,51,0.16)`          | Default border colour. |
| `--ndi-input-border-focus`  | `#7dd3fc`                       | `#0369a1`                      | Border colour when the field has focus. |
| `--ndi-input-fg`            | `#edf3ff`                       | `#132033`                      | Input text colour. |
| `--ndi-input-muted`         | `#aab8d0`                       | `#4a5b74`                      | Colour for placeholder, suffix, and helper text. |
| `--ndi-input-error`         | `#f87171`                       | `#dc2626`                      | Error border and error message colour. |
| `--ndi-input-accent`        | `#7dd3fc`                       | `#0369a1`                      | MAX button text colour. |
| `--ndi-input-radius`        | `8px`                           | `8px`                          | Border-radius of the input wrapper. |
| `--ndi-input-surface`       | `#111b2e`                       | `#f5f8fd`                      | Background colour of the MAX button. |

```css
/* Example: override per component instance */
ndi-input.stake-field {
  --ndi-input-accent: #a78bfa;
  --ndi-input-border-focus: #a78bfa;
}
```

---

## Accessibility

- The `<label>` element is linked to the `<input>` via matching `for`/`id` attributes generated per instance (`ndi-input-1-control`, etc.).
- When `error` is non-empty: `aria-invalid="true"` is set on the input, the error `<p>` has `role="alert"` and `aria-live="polite"`, and `aria-describedby` points to it.
- When only `helper` is set: `aria-describedby` points to the helper paragraph.
- The MAX button carries `aria-label="Set maximum value"` and is `disabled` when the field itself is disabled.
- The suffix is `aria-hidden="true"` and `pointer-events: none` — it is decorative.
- All interactive elements have a visible `:focus-visible` outline using the accent colour.
- `@media (prefers-reduced-motion: reduce)` removes transitions.
- `@media (prefers-contrast: more)` forces the border to `currentColor`.

---

## Helper module

`input-config.js` exports three pure functions usable independently of the DOM:

```js
import { createInputConfig, isErrorState, formatDecimalInput } from './input-config.js';

const config = createInputConfig({ type: 'number', label: 'Amount', maxDecimals: 6 });
console.log(isErrorState(config));                    // false
console.log(formatDecimalInput('1.1234567', 4));      // '1.1234'
```
