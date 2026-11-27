import { buildToastConfig, getToastIcon, MAX_TOASTS } from './toast-config.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/**
 * <ndi-toast> — container element for the Ndi-Fi toast notification system.
 *
 * Place it once anywhere in the page (usually just before </body>):
 *
 *   <ndi-toast></ndi-toast>
 *   <script type="module" src="/components/toast/ndi-toast.js"></script>
 *
 * Show a toast imperatively:
 *
 *   document.querySelector('ndi-toast').toast('Saved!', { type: 'success' });
 *
 * Or from anywhere in the app via a window event:
 *
 *   window.dispatchEvent(new CustomEvent('ndi-toast', {
 *     detail: { message: 'Connection lost', type: 'error', title: 'Network' }
 *   }));
 */
export class NdiToast extends HTMLElement {
  // Tracks active toast entries: { id, element, timerId }
  #toasts = [];
  #nextId = 0;
  #globalHandler = null;

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./ndi-toast.css', import.meta.url).href;

    // Visual container for stacking toast cards
    const container = document.createElement('div');
    container.className = 'ndi-toast__container';
    container.setAttribute('data-toast-container', '');

    // aria-live region for non-error toasts (polite — does not interrupt)
    const politeRegion = document.createElement('div');
    politeRegion.setAttribute('aria-live', 'polite');
    politeRegion.setAttribute('aria-atomic', 'false');
    politeRegion.setAttribute('aria-relevant', 'additions');
    politeRegion.style.cssText =
      'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';

    // aria-live region for error toasts (assertive — interrupts AT immediately)
    const assertiveRegion = document.createElement('div');
    assertiveRegion.setAttribute('aria-live', 'assertive');
    assertiveRegion.setAttribute('aria-atomic', 'true');
    assertiveRegion.style.cssText = politeRegion.style.cssText;

    root.append(stylesheet, container, politeRegion, assertiveRegion);
  }

  connectedCallback() {
    this.#globalHandler = (event) => {
      const detail =
        event.detail && typeof event.detail === 'object' ? event.detail : {};
      this.toast(detail.message, {
        type: detail.type,
        duration: detail.duration,
        title: detail.title,
      });
    };
    window.addEventListener('ndi-toast', this.#globalHandler);
  }

  disconnectedCallback() {
    if (this.#globalHandler) {
      window.removeEventListener('ndi-toast', this.#globalHandler);
      this.#globalHandler = null;
    }
    // Clean up any pending timers
    this.#toasts.forEach((entry) => clearTimeout(entry.timerId));
    this.#toasts = [];
  }

  /**
   * Display a toast notification.
   *
   * @param {string} message  The body text of the toast.
   * @param {object} [options]
   * @param {'info'|'success'|'warning'|'error'} [options.type]  Default 'info'.
   * @param {number}  [options.duration]  Auto-dismiss ms. 0 = persistent.
   * @param {string}  [options.title]     Optional bold heading above the message.
   * @returns {string}  The id of the new toast (useful for programmatic close).
   */
  toast(message, options = {}) {
    const config = buildToastConfig({ message, ...options });
    const id = `ndi-toast-${++this.#nextId}`;

    // Enforce the max-stack limit — evict the oldest toast first
    if (this.#toasts.length >= MAX_TOASTS) {
      this.#dismiss(this.#toasts[0].id, true);
    }

    const element = this.#createToastElement(id, config);
    const container = this.shadowRoot.querySelector('[data-toast-container]');
    container.prepend(element);

    let timerId = null;
    if (config.duration > 0) {
      timerId = setTimeout(() => this.#dismiss(id), config.duration);
    }

    this.#toasts.push({ id, element, timerId });
    this.#announceToAT(config);

    return id;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  #createToastElement(id, config) {
    const isError = config.type === 'error';
    const hasTitle = Boolean(config.title);

    const item = document.createElement('div');
    item.className = 'ndi-toast__item';
    item.setAttribute('data-type', config.type);
    item.setAttribute('role', isError ? 'alert' : 'status');
    item.setAttribute('aria-label', [config.title, config.message].filter(Boolean).join(' — '));
    item.setAttribute('data-toast-id', id);
    if (hasTitle) item.setAttribute('data-has-title', '');

    item.innerHTML = `
      <span class="ndi-toast__icon">${getToastIcon(config.type)}</span>
      <div class="ndi-toast__body">
        ${hasTitle ? `<p class="ndi-toast__title">${escapeHtml(config.title)}</p>` : ''}
        <p class="ndi-toast__message">${escapeHtml(config.message)}</p>
      </div>
      <button
        class="ndi-toast__close"
        type="button"
        aria-label="Close notification"
      >×</button>`;

    item.querySelector('.ndi-toast__close').addEventListener('click', () => {
      this.#dismiss(id);
    });

    return item;
  }

  #announceToAT(config) {
    const root = this.shadowRoot;
    const region = config.type === 'error'
      ? root.querySelector('[aria-live="assertive"]')
      : root.querySelector('[aria-live="polite"]');

    if (!region) return;

    // Replace text to trigger a fresh AT announcement even for identical messages
    region.textContent = '';
    // A tiny timeout ensures the DOM mutation is registered as a change
    setTimeout(() => {
      region.textContent = [config.title, config.message].filter(Boolean).join(': ');
    }, 50);
  }

  /**
   * Dismiss a toast by its id.
   *
   * @param {string}  id
   * @param {boolean} [immediate]  Skip the exit animation.
   */
  #dismiss(id, immediate = false) {
    const index = this.#toasts.findIndex((entry) => entry.id === id);
    if (index === -1) return;

    const [entry] = this.#toasts.splice(index, 1);
    clearTimeout(entry.timerId);

    if (immediate || !entry.element.isConnected) {
      entry.element.remove();
      return;
    }

    // Trigger the CSS exit animation, then remove from DOM once it finishes
    entry.element.setAttribute('data-dismissing', '');

    const onEnd = () => {
      entry.element.removeEventListener('animationend', onEnd);
      entry.element.remove();
    };
    entry.element.addEventListener('animationend', onEnd);

    // Safety net: if the animation never fires (e.g. display:none), remove anyway
    const fallback = setTimeout(() => {
      entry.element.removeEventListener('animationend', onEnd);
      entry.element.remove();
    }, 500);

    entry.element.addEventListener('animationend', () => clearTimeout(fallback), { once: true });
  }
}

if (!customElements.get('ndi-toast')) {
  customElements.define('ndi-toast', NdiToast);
}

export default NdiToast;
