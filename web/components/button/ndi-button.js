/**
 * <ndi-button> — the standard Ndi-Fi button.
 *
 * Variants:  primary | secondary | ghost | danger
 * Sizes:     sm | md | lg
 * States:    loading (spinner + aria-busy) and disabled
 * Layout:    full-width, plus leading/trailing icon slots
 * A11y:      visible focus ring, aria-busy while loading, native disabled
 *
 * It renders a real <button> inside a shadow root (with delegatesFocus) so it
 * carries native semantics, focus and form participation. CSS custom
 * properties from the design tokens inherit through the shadow boundary, so
 * styling follows the active light/dark theme automatically.
 *
 * @example
 * <ndi-button variant="primary" size="md">Submit</ndi-button>
 * <ndi-button variant="ghost" loading>Working…</ndi-button>
 * <ndi-button variant="secondary">
 *   <svg slot="leading" ...></svg>
 *   With icon
 * </ndi-button>
 */

const VARIANTS = ['primary', 'secondary', 'ghost', 'danger'];
const SIZES = ['sm', 'md', 'lg'];
const TYPES = ['button', 'submit', 'reset'];

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export class NdiButton extends HTMLElement {
  static get observedAttributes() {
    return ['variant', 'size', 'loading', 'disabled', 'full-width', 'type'];
  }

  constructor() {
    super();
    this._built = false;
    this.attachShadow({ mode: 'open', delegatesFocus: true });
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#sync();
  }

  attributeChangedCallback() {
    if (this._built) this.#sync();
  }

  /** Whether the button is currently non-interactive. */
  get isDisabled() {
    return this.hasAttribute('loading') || this.hasAttribute('disabled');
  }

  get isLoading() {
    return this.hasAttribute('loading');
  }

  /** Forward focus to the inner native button (also handled by delegatesFocus). */
  focus(options) {
    this._button?.focus(options);
  }

  blur() {
    this._button?.blur();
  }

  /** Click the underlying button when interactive; no-op when disabled/loading. */
  click() {
    if (this.isDisabled) return;
    this._button?.click();
  }

  #build() {
    const doc = this.ownerDocument;
    const root = this.shadowRoot;

    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('./ndi-button.css', import.meta.url).href;

    this._button = doc.createElement('button');
    this._button.className = 'ndi-btn';
    this._button.setAttribute('part', 'button');

    this._spinner = doc.createElement('span');
    this._spinner.className = 'ndi-btn__spinner';
    this._spinner.setAttribute('part', 'spinner');
    this._spinner.setAttribute('aria-hidden', 'true');
    this._spinner.hidden = true;

    this._leadingWrap = doc.createElement('span');
    this._leadingWrap.className = 'ndi-btn__icon ndi-btn__icon--leading';
    this._leadingSlot = doc.createElement('slot');
    this._leadingSlot.setAttribute('name', 'leading');
    this._leadingSlot.addEventListener('slotchange', () => this.#syncIcons());
    this._leadingWrap.append(this._leadingSlot);

    this._label = doc.createElement('span');
    this._label.className = 'ndi-btn__label';
    this._labelSlot = doc.createElement('slot');
    this._label.append(this._labelSlot);

    this._trailingWrap = doc.createElement('span');
    this._trailingWrap.className = 'ndi-btn__icon ndi-btn__icon--trailing';
    this._trailingSlot = doc.createElement('slot');
    this._trailingSlot.setAttribute('name', 'trailing');
    this._trailingSlot.addEventListener('slotchange', () => this.#syncIcons());
    this._trailingWrap.append(this._trailingSlot);

    this._button.append(this._spinner, this._leadingWrap, this._label, this._trailingWrap);

    // Guard: never let a click escape while disabled/loading. Native disabled
    // already suppresses it in browsers; this makes the behaviour explicit and
    // testable.
    this._button.addEventListener('click', this.#onClickGuard);

    root.append(link, this._button);
    this._built = true;
  }

  #sync() {
    if (!this._built) return;
    const variant = oneOf(this.getAttribute('variant'), VARIANTS, 'primary');
    const size = oneOf(this.getAttribute('size'), SIZES, 'md');
    const type = oneOf(this.getAttribute('type'), TYPES, 'button');
    const fullWidth = this.hasAttribute('full-width');
    const loading = this.hasAttribute('loading');
    const disabled = this.hasAttribute('disabled');
    const inactive = loading || disabled;

    this._button.className = [
      'ndi-btn',
      `ndi-btn--${variant}`,
      `ndi-btn--${size}`,
      fullWidth ? 'ndi-btn--full' : '',
      loading ? 'is-loading' : '',
      disabled ? 'is-disabled' : '',
    ]
      .filter(Boolean)
      .join(' ');

    this._button.setAttribute('type', type);

    if (inactive) this._button.setAttribute('disabled', '');
    else this._button.removeAttribute('disabled');

    if (loading) this._button.setAttribute('aria-busy', 'true');
    else this._button.removeAttribute('aria-busy');

    this._spinner.hidden = !loading;
    this.classList.toggle('ndi-button--full-width', fullWidth);
  }

  #syncIcons() {
    const leadingAssigned = this._leadingSlot.assignedNodes?.()?.length > 0;
    const trailingAssigned = this._trailingSlot.assignedNodes?.()?.length > 0;
    this._leadingWrap.classList.toggle('is-filled', leadingAssigned);
    this._trailingWrap.classList.toggle('is-filled', trailingAssigned);
  }

  #onClickGuard = (event) => {
    if (this.isDisabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-button')) customElements.define('ndi-button', NdiButton);
}

export default NdiButton;
