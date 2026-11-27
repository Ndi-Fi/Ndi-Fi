/**
 * <ndi-empty-state> — framework-agnostic empty-state component for Ndi-Fi.
 *
 * Renders a centred illustration, headline, body copy, and one or two CTAs
 * for the three key screens: no positions, no rewards, and no loans.
 * Designed to be dropped into any host page without a build step.
 *
 * ## Usage
 *
 * ```html
 * <ndi-empty-state
 *   variant="positions"
 *   heading="No open positions"
 *   body="Deposit into a lending vault or stake your LP tokens to get started."
 *   cta-label="Open a position"
 *   cta-href="/deposit"
 * ></ndi-empty-state>
 * ```
 *
 * ## Attributes
 *
 * | Attribute       | Default         | Description |
 * |---|---|---|
 * | `variant`       | `"positions"`   | `"positions"`, `"rewards"`, or `"loans"`. Controls the built-in icon. |
 * | `heading`       | (see defaults)  | Primary headline text. |
 * | `body`          | (see defaults)  | Supporting copy. Keep to 1–2 short sentences. |
 * | `cta-label`     | (see defaults)  | Primary CTA button/link label. |
 * | `cta-href`      | `""`            | If set, the CTA renders as an `<a>`; otherwise a `<button>`. |
 * | `secondary-label` | `""`          | Optional secondary CTA label. |
 * | `secondary-href`  | `""`          | Optional secondary CTA href. |
 * | `bordered`      | absent          | Add to draw a dashed border around the state. |
 *
 * ## Events
 *
 * `ndi-empty-state:cta` — fired on the host element when the **primary** CTA
 * is activated as a button (no href).  `detail.variant` carries the variant.
 *
 * `ndi-empty-state:secondary` — same, for the secondary button.
 *
 * ## Slots
 *
 * No slots are used; the component is entirely attribute-driven so it can be
 * used in HTML templates, server-rendered pages, and React/Vue/Svelte JSX
 * without special wiring.
 *
 * ## Accessibility
 *
 * The region is wrapped in a `<section aria-label>` so it appears in the page
 * landmark list.  The heading is an `<h2>` by default, appropriate for a main
 * content section.  Both CTAs meet 3:1 contrast in forced-colours mode.
 */

const ICONS = {
  positions: /* svg */ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <!-- Layered squares suggesting a portfolio / stacked positions -->
      <rect x="3" y="7" width="14" height="10" rx="2"/>
      <rect x="7" y="3" width="14" height="10" rx="2"/>
    </svg>`,

  rewards: /* svg */ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <!-- Star with a small sparkle -->
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/>
      <line x1="12" y1="2" x2="12" y2="2.5"/>
    </svg>`,

  loans: /* svg */ `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <!-- Document with a coin / currency symbol -->
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <circle cx="12" cy="14" r="2.5"/>
    </svg>`,
};

const DEFAULTS = {
  positions: {
    heading: 'No open positions',
    body: 'Deposit into the lending vault or stake your LP tokens to open your first position.',
    ctaLabel: 'Get started',
  },
  rewards: {
    heading: 'No rewards yet',
    body: 'Stake LP tokens and claim NDI rewards once they start accruing.',
    ctaLabel: 'Stake now',
  },
  loans: {
    heading: 'No active loans',
    body: 'Borrow from the vault once a borrower address is approved by the protocol owner.',
    ctaLabel: 'Learn how borrowing works',
  },
};

const KNOWN_VARIANTS = new Set(['positions', 'rewards', 'loans']);

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * <ndi-empty-state> custom element.
 */
export class NdiEmptyState extends HTMLElement {
  static get observedAttributes() {
    return [
      'variant',
      'heading',
      'body',
      'cta-label',
      'cta-href',
      'secondary-label',
      'secondary-href',
      'bordered',
    ];
  }

  connectedCallback() {
    this.#render();
  }

  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  get #variant() {
    const v = (this.getAttribute('variant') || 'positions').toLowerCase();
    return KNOWN_VARIANTS.has(v) ? v : 'positions';
  }

  get #defaults() {
    return DEFAULTS[this.#variant];
  }

  #attr(name, fallback = '') {
    return this.hasAttribute(name) ? this.getAttribute(name) : fallback;
  }

  #buildCta(label, href, eventName, variant = 'primary') {
    if (!label) return '';

    const cls = `ndi-es__cta ndi-es__cta--${variant}`;

    if (href) {
      return `<a class="${cls}" href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    }

    return `<button type="button" class="${cls}" data-event="${escapeHtml(eventName)}">${escapeHtml(label)}</button>`;
  }

  #render() {
    const variant = this.#variant;
    const defaults = this.#defaults;

    const heading = this.#attr('heading', defaults.heading);
    const body = this.#attr('body', defaults.body);
    const ctaLabel = this.#attr('cta-label', defaults.ctaLabel);
    const ctaHref = this.#attr('cta-href');
    const secondaryLabel = this.#attr('secondary-label');
    const secondaryHref = this.#attr('secondary-href');
    const bordered = this.hasAttribute('bordered');

    const icon = ICONS[variant] ?? ICONS.positions;

    const primaryCta = this.#buildCta(ctaLabel, ctaHref, 'ndi-empty-state:cta', 'primary');
    const secondaryCta = this.#buildCta(secondaryLabel, secondaryHref, 'ndi-empty-state:secondary', 'secondary');

    const actionsHtml =
      primaryCta || secondaryCta
        ? `<div class="ndi-es__actions">${primaryCta}${secondaryCta}</div>`
        : '';

    const sectionClass = ['ndi-es', bordered ? 'ndi-es--bordered' : ''].filter(Boolean).join(' ');

    this.innerHTML = /* html */ `
      <section class="${sectionClass}" aria-label="${escapeHtml(heading)}" data-variant="${escapeHtml(variant)}">
        <div class="ndi-es__icon" aria-hidden="true">${icon}</div>
        <h2 class="ndi-es__title">${escapeHtml(heading)}</h2>
        <p class="ndi-es__body">${escapeHtml(body)}</p>
        ${actionsHtml}
      </section>
    `;

    // Attach button click handlers after re-render.
    this.querySelectorAll('button[data-event]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.dispatchEvent(
          new CustomEvent(btn.dataset.event, {
            bubbles: true,
            composed: true,
            detail: { variant },
          }),
        );
      });
    });
  }
}

// Guard against SSR / Node environments that have no DOM.
if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-empty-state')) {
    customElements.define('ndi-empty-state', NdiEmptyState);
  }
}
