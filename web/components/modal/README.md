# Shared modal (`<ndi-modal>`)

A framework-agnostic modal/dialog component for Ndi-Fi pages. It renders an
accessible dialog with a focus trap, scroll lock, and optional bottom-sheet
layout for mobile, so every page gets consistent behaviour with no extra code.

There is no build step. The component uses standard custom elements, shadow DOM,
and ES modules.

## Usage

```html
<ndi-modal label="Confirm action">
  <span slot="header">Confirm action</span>
  <p>Are you sure you want to continue?</p>
  <div slot="footer">
    <button type="button" id="ok">OK</button>
    <button type="button" id="cancel">Cancel</button>
  </div>
</ndi-modal>

<script type="module" src="/components/modal/ndi-modal.js"></script>
<script type="module">
  const modal = document.querySelector('ndi-modal');
  document.getElementById('open-btn').addEventListener('click', () => modal.show());
  document.getElementById('cancel').addEventListener('click', () => modal.hide());
</script>
```

### Attributes

| Attribute           | Default | Purpose |
|---|---|---|
| `open`              | absent  | Present when the modal is visible. Add/remove to show/hide. |
| `size`              | `md`    | Dialog width cap: `sm` (400 px), `md` (600 px), `lg` (800 px). |
| `sheet`             | absent  | Enables the bottom-sheet slide-up style on screens narrower than 48 rem. |
| `label`             | `Dialog` | Accessible name for the dialog. Use the same text as the visible heading. |
| `no-backdrop-close` | absent  | When present, clicking the backdrop does not close the modal. |

### Slots

| Slot name | Purpose |
|---|---|
| `header`  | Dialog title, placed inside the header bar next to the close button. |
| *(default)* | Main body content. |
| `footer`  | Action buttons or supplementary content below the body. Hidden when empty. |

### Methods

```js
modal.show();   // adds the `open` attribute
modal.hide();   // removes the `open` attribute
```

### Events

| Event      | Fired when |
|---|---|
| `ndi-open`  | The modal finishes opening (synchronous, before paint). |
| `ndi-close` | The modal finishes closing (after the exit animation). |

Both events bubble and are composed, so they cross shadow DOM boundaries.

```js
modal.addEventListener('ndi-close', () => console.log('closed'));
```

### Bottom-sheet on mobile

Add the `sheet` attribute to slide the panel up from the bottom of the screen
on viewports narrower than 48 rem. On wider screens the sheet attribute has no
visual effect and the dialog centres normally.

```html
<ndi-modal sheet label="Options">
  <span slot="header">Options</span>
  <p>Choose one of the following options.</p>
</ndi-modal>
```

### Keyboard behaviour

| Key | Action |
|---|---|
| `Esc` | Close the modal. |
| `Tab` | Move focus forward through focusable elements inside the dialog. Wraps at the last item. |
| `Shift+Tab` | Move focus backward. Wraps at the first item. |

## Accessibility

- The dialog panel carries `role="dialog"` and `aria-modal="true"`.
- `aria-labelledby` points to the header slot title.
- Focus is moved into the dialog on open and restored to the previously focused
  element on close.
- Scroll is locked to the dialog while it is open.
- The backdrop and close button are reachable by keyboard.
- Animations are suppressed when `prefers-reduced-motion: reduce` is active.

## Tests

```bash
cd web && npm test
```

The tests cover `modal-config.js` pure functions: default config, all three size
variants, bottom-sheet config, label/aria config, and robustness against
malformed input.
