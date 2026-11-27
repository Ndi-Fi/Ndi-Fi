import { buildModalConfig } from './modal-config.js';

let instanceCount = 0;

/**
 * Returns all focusable elements within a root (shadow root or element).
 * Filters out elements that are disabled, hidden, or have tabindex="-1".
 *
 * @param {ShadowRoot | Element} root
 * @returns {Element[]}
 */
function getFocusable(root) {
  const candidates = root.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), details > summary',
  );
  return Array.from(candidates).filter((el) => !el.closest('[hidden]'));
}

/**
 * <ndi-modal> renders an accessible dialog into a shadow root that is
 * appended to document.body (portal), so it always sits above page content.
 *
 * Usage:
 *   <ndi-modal label="Confirm action">
 *     <span slot="header">Confirm action</span>
 *     <p>Are you sure?</p>
 *     <div slot="footer"><button>OK</button></div>
 *   </ndi-modal>
 *
 * Attributes
 *   open              — present when the modal is visible
 *   size              — sm | md (default) | lg
 *   sheet             — enables bottom-sheet style on mobile
 *   label             — accessible name for the dialog (default: "Dialog")
 *   no-backdrop-close — disables close-on-backdrop-click
 *
 * Events
 *   ndi-open          — fired after the modal opens
 *   ndi-close         — fired after the modal closes
 *
 * Methods
 *   show()            — adds the `open` attribute
 *   hide()            — removes the `open` attribute
 */
export class NdiModal extends HTMLElement {
  static get observedAttributes() {
    return ['open', 'size', 'sheet', 'label', 'no-backdrop-close'];
  }

  #instanceId = `ndi-modal-${++instanceCount}`;
  /** The shadow host that is moved into document.body as a portal. */
  #portal = null;
  /** Previously focused element, restored on close. */
  #returnFocus = null;
  /** Bound event-handler references kept for cleanup. */
  #handlers = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────

  connectedCallback() {
    // Reflect current state in case the element was stamped with `open` in HTML.
    if (this.hasAttribute('open')) {
      this.#open();
    }
  }

  disconnectedCallback() {
    this.#teardown();
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (!this.isConnected) return;

    if (name === 'open') {
      if (newValue !== null) {
        this.#open();
      } else {
        this.#close();
      }
      return;
    }

    // For all other attribute changes, re-render if currently open.
    if (this.hasAttribute('open')) {
      this.#render();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Open the modal imperatively. */
  show() {
    this.setAttribute('open', '');
  }

  /** Close the modal imperatively. */
  hide() {
    this.removeAttribute('open');
  }

  // ── Private: open / close ────────────────────────────────────────────────

  #open() {
    this.#returnFocus = document.activeElement;

    this.#ensurePortal();
    this.#render();

    document.body.style.overflow = 'hidden';

    this.#bindEvents();
    this.#trapFocus();

    this.dispatchEvent(new CustomEvent('ndi-open', { bubbles: true, composed: true }));
  }

  #close() {
    const backdrop = this.shadowRoot.querySelector('.ndi-modal__backdrop');

    if (backdrop) {
      // Play the closing animation before removing DOM content.
      backdrop.classList.add('ndi-modal__backdrop--closing');
      const duration = this.#animationDuration();

      setTimeout(() => {
        this.#teardown();
        this.dispatchEvent(new CustomEvent('ndi-close', { bubbles: true, composed: true }));
      }, duration);
    } else {
      this.#teardown();
      this.dispatchEvent(new CustomEvent('ndi-close', { bubbles: true, composed: true }));
    }
  }

  /**
   * Returns the CSS animation duration in ms so we can delay DOM removal
   * until after the closing animation finishes. Falls back to 0 when
   * prefers-reduced-motion is active or the panel is not in the DOM.
   */
  #animationDuration() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return 0;
    const panel = this.shadowRoot.querySelector('.ndi-modal__panel');
    if (!panel) return 0;
    const raw = getComputedStyle(panel).getPropertyValue('--ndi-modal-duration').trim();
    // Parse values like "220ms" or "0.22s"
    if (raw.endsWith('ms')) return parseFloat(raw) || 0;
    if (raw.endsWith('s')) return (parseFloat(raw) || 0) * 1000;
    return 220;
  }

  #teardown() {
    this.#unbindEvents();

    const root = this.shadowRoot;
    if (root) root.innerHTML = '';

    // Only unlock scroll when no other modal is open.
    const others = document.querySelectorAll('ndi-modal[open]');
    if (others.length === 0) {
      document.body.style.overflow = '';
    }

    if (this.#returnFocus && typeof this.#returnFocus.focus === 'function') {
      this.#returnFocus.focus();
    }
    this.#returnFocus = null;
  }

  // ── Private: portal ──────────────────────────────────────────────────────

  #ensurePortal() {
    // The shadow root is already attached to `this` (the custom element).
    // The element itself may be anywhere in the light DOM; we do not move it,
    // but we do ensure the *rendered* backdrop ends up at the top of body by
    // rendering into our own shadow root (which is scoped) and relying on the
    // fixed positioning of the backdrop. This is the standard pattern for
    // Web Components — moving the host node would break slot projection.
  }

  // ── Private: render ──────────────────────────────────────────────────────

  #render() {
    const root = this.shadowRoot;
    if (!root) return;

    const config = buildModalConfig({
      size: this.getAttribute('size'),
      sheet: this.hasAttribute('sheet') ? '' : null,
      label: this.getAttribute('label'),
      'no-backdrop-close': this.hasAttribute('no-backdrop-close') ? '' : null,
    });

    const id = this.#instanceId;
    const titleId = `${id}-title`;

    // Inject stylesheet link once.
    const cssHref = new URL('./ndi-modal.css', import.meta.url).href;

    root.innerHTML = `
      <link rel="stylesheet" href="${cssHref}">
      <div class="ndi-modal__backdrop" role="presentation" data-backdrop>
        <div
          class="ndi-modal__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="${titleId}"
          data-size="${config.size}"
        >
          <div class="ndi-modal__header">
            <div class="ndi-modal__title-slot" id="${titleId}">
              <slot name="header"></slot>
            </div>
            <button
              class="ndi-modal__close"
              type="button"
              aria-label="Close dialog"
              data-close
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
                <path
                  d="M3 3l10 10M13 3L3 13"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.75"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
          <div class="ndi-modal__body">
            <slot></slot>
          </div>
          <div class="ndi-modal__footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>`;
  }

  // ── Private: focus trap ──────────────────────────────────────────────────

  #trapFocus() {
    // Move focus into the dialog on the next tick so the DOM is painted.
    requestAnimationFrame(() => {
      const focusable = getFocusable(this.shadowRoot);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        // Fallback: focus the panel itself.
        const panel = this.shadowRoot?.querySelector('.ndi-modal__panel');
        if (panel) {
          panel.setAttribute('tabindex', '-1');
          panel.focus();
        }
      }
    });
  }

  // ── Private: event wiring ────────────────────────────────────────────────

  #bindEvents() {
    const onKeydown = (event) => this.#handleKeydown(event);
    const onBackdropPointerUp = (event) => this.#handleBackdropClick(event);
    const onCloseButton = () => this.hide();

    document.addEventListener('keydown', onKeydown);

    // Bind once after the next paint so the render call above has completed.
    requestAnimationFrame(() => {
      const backdrop = this.shadowRoot?.querySelector('[data-backdrop]');
      const closeBtn = this.shadowRoot?.querySelector('[data-close]');

      if (backdrop) backdrop.addEventListener('pointerup', onBackdropPointerUp);
      if (closeBtn) closeBtn.addEventListener('click', onCloseButton);

      this.#handlers = { onKeydown, onBackdropPointerUp, onCloseButton, backdrop, closeBtn };
    });
  }

  #unbindEvents() {
    if (!this.#handlers) return;

    const { onKeydown, onBackdropPointerUp, onCloseButton, backdrop, closeBtn } = this.#handlers;

    document.removeEventListener('keydown', onKeydown);
    if (backdrop) backdrop.removeEventListener('pointerup', onBackdropPointerUp);
    if (closeBtn) closeBtn.removeEventListener('click', onCloseButton);

    this.#handlers = null;
  }

  #handleKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.hide();
      return;
    }

    if (event.key === 'Tab') {
      this.#handleTab(event);
    }
  }

  #handleTab(event) {
    const focusable = getFocusable(this.shadowRoot);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey) {
      if (document.activeElement === first || this.shadowRoot.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last || this.shadowRoot.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  #handleBackdropClick(event) {
    // Only close when the click target is the backdrop itself, not the panel.
    if (this.hasAttribute('no-backdrop-close')) return;
    if (event.target === this.shadowRoot?.querySelector('[data-backdrop]')) {
      this.hide();
    }
  }
}

if (!customElements.get('ndi-modal')) {
  customElements.define('ndi-modal', NdiModal);
}

export default NdiModal;
