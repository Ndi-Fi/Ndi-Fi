import { buildCardConfig, cardAriaAttrs } from './card-config.js';

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ENTITIES[char]);
}

/**
 * Skeleton HTML shown while the card is in the loading state.
 * Uses aria-hidden so the shimmer bars are invisible to assistive technology;
 * the aria-busy="true" on the card root communicates the loading state.
 */
function renderSkeleton() {
  return `
    <div class="ndi-card__skeleton" aria-hidden="true">
      <div class="ndi-card__skeleton-bar ndi-card__skeleton-bar--title"></div>
      <div class="ndi-card__skeleton-bar ndi-card__skeleton-bar--line"></div>
      <div class="ndi-card__skeleton-bar ndi-card__skeleton-bar--line"></div>
      <div class="ndi-card__skeleton-bar ndi-card__skeleton-bar--line-short"></div>
      <div class="ndi-card__skeleton-bar ndi-card__skeleton-bar--action"></div>
    </div>`;
}

/**
 * Error banner HTML. The message is escaped before insertion; an empty message
 * renders a generic fallback so the error state is always visible.
 */
function renderError(message) {
  const displayMessage = message || 'Something went wrong. Please try again.';
  return `
    <div class="ndi-card__error" role="alert">
      <svg class="ndi-card__error-icon" viewBox="0 0 20 20" aria-hidden="true" focusable="false" fill="currentColor">
        <path fill-rule="evenodd" clip-rule="evenodd"
          d="M10 2a8 8 0 1 0 0 16A8 8 0 0 0 10 2Zm0 4.5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6.5Zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
      <p class="ndi-card__error-message">${escapeHtml(displayMessage)}</p>
    </div>`;
}

/**
 * <ndi-card> — a general-purpose card for the Ndi-Fi UI.
 *
 * ## Slots
 * - `header` — card heading / title area
 * - (default) — main body content
 * - `footer` — actions or supplementary information
 *
 * ## Attributes
 * | Attribute | Behaviour |
 * |---|---|
 * | `loading` | Shows an animated skeleton overlay; sets aria-busy="true". |
 * | `error`   | Shows an error banner; value is used as the error message. |
 * | `compact` | Reduces internal padding via CSS attribute selector. |
 * | `label`   | Accessible name forwarded to the card's aria-label. |
 *
 * ## Example
 * ```html
 * <ndi-card label="Lending position">
 *   <h2 slot="header">My position</h2>
 *   <p>Collateral: 1 ETH</p>
 *   <button slot="footer">Withdraw</button>
 * </ndi-card>
 * ```
 */
export class NdiCard extends HTMLElement {
  static get observedAttributes() {
    return ['loading', 'error', 'compact', 'label'];
  }

  constructor() {
    super();

    const root = this.attachShadow({ mode: 'open' });

    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = new URL('./ndi-card.css', import.meta.url).href;

    const content = document.createElement('div');
    content.setAttribute('data-card-root', '');

    root.append(stylesheet, content);
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  #getAttrs() {
    return {
      loading: this.hasAttribute('loading') ? (this.getAttribute('loading') ?? '') : undefined,
      error:   this.hasAttribute('error')   ? (this.getAttribute('error')   ?? '') : undefined,
      compact: this.hasAttribute('compact') ? (this.getAttribute('compact') ?? '') : undefined,
      label:   this.getAttribute('label'),
    };
  }

  #render() {
    const root = this.shadowRoot?.querySelector('[data-card-root]');
    if (!root) return;

    const config = buildCardConfig(this.#getAttrs());
    const ariaAttrs = cardAriaAttrs(config);

    // Build the aria attribute string for the card root element.
    const ariaStr = Object.entries(ariaAttrs)
      .map(([key, value]) => `${key}="${escapeHtml(value)}"`)
      .join(' ');

    // Error and loading states replace the slotted content area.
    let bodyHtml;
    if (config.hasError) {
      bodyHtml = renderError(config.error);
    } else {
      bodyHtml = `
        <div class="ndi-card__header">
          <slot name="header"></slot>
        </div>
        <div class="ndi-card__body">
          <slot></slot>
        </div>
        <div class="ndi-card__footer">
          <slot name="footer"></slot>
        </div>
        ${config.loading ? renderSkeleton() : ''}`;
    }

    const cardClass = [
      'ndi-card',
      config.hasError ? 'ndi-card--error' : '',
    ]
      .filter(Boolean)
      .join(' ');

    root.innerHTML = `
      <article class="${cardClass}" ${ariaStr}>
        ${bodyHtml}
      </article>`;
  }
}

if (!customElements.get('ndi-card')) {
  customElements.define('ndi-card', NdiCard);
}

export default NdiCard;
