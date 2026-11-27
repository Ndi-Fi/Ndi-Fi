# `ndi-toast` — Toast / Notification Component System

Two Web Components that together give the Ndi-Fi UI a fully-accessible, zero-dependency toast notification system built on vanilla custom elements and Shadow DOM.

---

## Components

| Element | Role |
|---|---|
| `<ndi-toast-provider>` | Fixed-position stack that owns the queue and exposes the programmatic API. |
| `<ndi-toast>` | Individual notification card, also usable as a standalone element. |

---

## Quick start

```html
<!-- 1. Load the module once per page (or bundle it) -->
<script type="module" src="/web/components/toast/ndi-toast.js"></script>

<!-- 2. Place the provider somewhere in <body> -->
<ndi-toast-provider position="top-right" id="toasts"></ndi-toast-provider>
```

```js
// 3. Show a toast programmatically
const provider = document.getElementById('toasts');

provider.show({ type: 'success', title: 'Staked!', message: 'Your NDI tokens are now earning rewards.' });
provider.show({ type: 'error',   message: 'Transaction failed. Check your wallet and try again.', duration: 0 });
provider.show({ type: 'info',    message: 'Network switched to testnet.', duration: 3000 });
provider.show({ type: 'warning', title: 'Low balance', message: 'You have less than 10 NDI remaining.' });
```

---

## Standalone `<ndi-toast>`

You can place `<ndi-toast>` elements in HTML without a provider when you only need a static notification:

```html
<ndi-toast type="info" message="Wallet connected." open></ndi-toast>

<ndi-toast type="warning" title="Heads up" message="Rates may change." open></ndi-toast>
```

Removing the `open` attribute (or setting it to absent) plays the exit animation and removes the element from the DOM.

---

## Attributes

### `<ndi-toast-provider>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `position` | string | `top-right` | Where the stack is anchored. See [Position values](#position-values). |

### `<ndi-toast>`

| Attribute | Type | Default | Description |
|---|---|---|---|
| `type` | string | `info` | Visual style and ARIA role. See [Type values](#type-values). |
| `message` | string | `''` | Body text of the notification. |
| `title` | string | `''` | Optional bold heading displayed above the message. |
| `open` | boolean (presence) | — | Presence = visible. Removing it triggers the exit animation. |

---

## Methods (`<ndi-toast-provider>`)

| Method | Signature | Description |
|---|---|---|
| `show` | `(options) → string` | Push a new toast. Returns the toast's string ID. |
| `dismiss` | `(id: string) → void` | Trigger exit animation on a specific toast by ID. |
| `dismissAll` | `() → void` | Trigger exit animation on every visible toast. |

### `show(options)` options

| Key | Type | Default | Description |
|---|---|---|---|
| `type` | string | `'info'` | One of the [type values](#type-values). Invalid values fall back to `'info'`. |
| `message` | string | `''` | Body text. |
| `title` | string | `''` | Bold heading. |
| `duration` | number (ms) | `5000` | Auto-dismiss delay. `0` disables auto-dismiss. |
| `id` | string | auto | Caller-supplied ID; a unique one is generated when omitted. |

---

## Events

| Event | Fired by | Bubbles | Composed | Detail |
|---|---|---|---|---|
| `ndi:dismiss` | `<ndi-toast>` | ✓ | ✓ | — (use `event.target.dataset.toastId` on the provider to identify which toast) |

```js
document.getElementById('toasts').addEventListener('ndi:dismiss', (event) => {
  console.log('dismissed toast id:', event.target.dataset.toastId);
});
```

---

## Position values

| Value | Description |
|---|---|
| `top-right` | Top-right corner (default) |
| `top-left` | Top-left corner |
| `top-center` | Top edge, horizontally centred |
| `bottom-right` | Bottom-right corner |
| `bottom-left` | Bottom-left corner |
| `bottom-center` | Bottom edge, horizontally centred |

All positions respect mobile safe areas via `env(safe-area-inset-*)`.

---

## Type values

| Value | Icon | Accent | ARIA |
|---|---|---|---|
| `info` | ⓘ circle | sky blue | `role="status"` |
| `success` | ✓ circle | green | `role="status"` |
| `warning` | △ triangle | amber | `role="status"` |
| `error` | ✕ circle | red | `role="alert"` + `aria-live="assertive"` |

---

## CSS custom properties

All tokens are set on `:host` inside the shadow root and can be overridden from outside using `::part` or by inheriting from a parent that sets the same property names.

| Property | Dark default | Light default | Description |
|---|---|---|---|
| `--ndi-toast-bg` | `#111b2e` | `#ffffff` | Card background |
| `--ndi-toast-border` | `rgba(226,236,255,0.16)` | `rgba(19,32,51,0.12)` | Card border and close-button hover background |
| `--ndi-toast-fg` | `#edf3ff` | `#132033` | Primary text colour |
| `--ndi-toast-muted` | `#aab8d0` | `#4a5b74` | Secondary text and close-button colour |
| `--ndi-toast-radius` | `10px` | `10px` | Card border radius |
| `--ndi-toast-shadow` | `0 4px 16px rgba(0,0,0,0.4)` | `0 4px 12px rgba(19,32,51,0.12)` | Card drop shadow |
| `--ndi-toast-info-color` | `#7dd3fc` | `#0369a1` | Accent for info toasts |
| `--ndi-toast-success-color` | `#4ade80` | `#16a34a` | Accent for success toasts |
| `--ndi-toast-warning-color` | `#fbbf24` | `#d97706` | Accent for warning toasts |
| `--ndi-toast-error-color` | `#f87171` | `#dc2626` | Accent for error toasts |

---

## Accessibility

- `<ndi-toast-provider>` contains a visually hidden `aria-live="polite"` region that announces info/success/warning toasts to screen readers.
- Error toasts use `role="alert"` and `aria-live="assertive"` on the individual element for immediate interruption.
- The close button carries a descriptive `aria-label="Dismiss notification"` and is keyboard-focusable.
- The provider's `aria-live` region uses `aria-atomic="false"` so each individual addition is announced separately rather than the entire list.

---

## File layout

```
web/components/toast/
├── ndi-toast.js        # Custom element definitions
├── ndi-toast.css       # Shared styles for both elements
├── ndi-toast.test.js   # Node.js unit tests (node:test)
├── toast-config.js     # Pure config helpers (no DOM dependency)
└── README.md           # This file
```

Run the tests with:

```sh
node --test web/components/toast/ndi-toast.test.js
```
