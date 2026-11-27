/**
 * NdiBorrowRiskExplainer — pre-borrow liquidation risk gate.
 *
 * Renders a plain-language explainer about health factor and liquidation
 * price with concrete numeric examples. The user must check an
 * acknowledgement checkbox before the "Continue to borrow" button activates.
 * Once acknowledged, the acknowledgement is stored per-session so the gate
 * does not repeat on the same page load. A "Learn more" link is always
 * visible for returning users.
 *
 * Attributes:
 *   collateral-factor   — number 0–100 (e.g. "75")
 *   liquidation-threshold — number 0–100 (e.g. "85")
 *   locale              — BCP-47 locale code (defaults to en)
 *
 * Events (bubbles):
 *   ndi-borrow-acknowledged — fired when the user checks the box and the
 *                             continue button is activated for the first time.
 *   ndi-borrow-proceed      — fired when the continue button is clicked.
 *
 * Usage:
 *   <ndi-borrow-risk-explainer
 *     collateral-factor="75"
 *     liquidation-threshold="85"
 *   ></ndi-borrow-risk-explainer>
 *
 *   Listen for `ndi-borrow-proceed` to open the borrow form.
 */

const SESSION_KEY = 'ndi-borrow-risk-ack';

function wasAcknowledged() {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function persistAck() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1');
  } catch { /* session storage unavailable */ }
}

function el(doc, tag, attrs = {}, text) {
  const node = doc.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Clamp to [min, max] and return as a number. */
function clamp(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
}

/**
 * Build the copy object from attributes. All numbers are illustrative and
 * kept intentionally simple to aid comprehension.
 */
function buildCopy(collateralFactor, liquidationThreshold) {
  const cf = clamp(collateralFactor, 1, 99);
  const lt = clamp(liquidationThreshold, cf + 1, 100);

  // Example: $1,000 of collateral
  const exampleCollateral = 1000;
  const maxBorrow = Math.round((exampleCollateral * cf) / 100);
  const liquidationCollateralValue = Math.round((maxBorrow * 100) / lt);
  const priceDrop = Math.round(((exampleCollateral - liquidationCollateralValue) / exampleCollateral) * 100);

  return {
    collateralFactor: cf,
    liquidationThreshold: lt,
    exampleCollateral,
    maxBorrow,
    liquidationCollateralValue,
    priceDrop,
  };
}

const LEARN_MORE_URL = 'https://github.com/Ndi-Fi/Ndi-Fi/blob/main/docs/VAULT_ERC4626.md';

export class NdiBorrowRiskExplainer extends HTMLElement {
  static get observedAttributes() {
    return ['collateral-factor', 'liquidation-threshold', 'locale'];
  }

  constructor() {
    super();
    this._built = false;
    this._acknowledged = false;
  }

  get isAcknowledged() {
    return this._acknowledged;
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#sync();
  }

  attributeChangedCallback() {
    if (this._built) this.#sync();
  }

  #build() {
    const doc = this.ownerDocument;
    this.classList.add('ndi-borrow-risk');
    this.setAttribute('role', 'region');
    this.setAttribute('aria-label', 'Liquidation risk explainer');

    // ── Header ──────────────────────────────────────────────────────────
    this._header = el(doc, 'div', { className: 'ndi-borrow-risk__header' });
    this._titleEl = el(doc, 'h2', { className: 'ndi-borrow-risk__title' },
      'Understand your liquidation risk');
    this._header.append(this._titleEl);

    // ── Body ─────────────────────────────────────────────────────────────
    this._body = el(doc, 'div', { className: 'ndi-borrow-risk__body' });

    // Health factor section
    this._hfSection = el(doc, 'section', { className: 'ndi-borrow-risk__section' });
    this._hfTitle = el(doc, 'h3', { className: 'ndi-borrow-risk__section-title' }, 'Health factor');
    this._hfDesc = el(doc, 'p', { className: 'ndi-borrow-risk__section-body' });
    this._hfSection.append(this._hfTitle, this._hfDesc);

    // Liquidation section
    this._liqSection = el(doc, 'section', { className: 'ndi-borrow-risk__section' });
    this._liqTitle = el(doc, 'h3', { className: 'ndi-borrow-risk__section-title' }, 'When liquidation happens');
    this._liqDesc = el(doc, 'p', { className: 'ndi-borrow-risk__section-body' });
    this._liqSection.append(this._liqTitle, this._liqDesc);

    // Example box
    this._exampleBox = el(doc, 'div', { className: 'ndi-borrow-risk__example', role: 'note' });
    this._exampleTitle = el(doc, 'strong', { className: 'ndi-borrow-risk__example-title' }, 'Example');
    this._exampleText = el(doc, 'p', { className: 'ndi-borrow-risk__example-text' });
    this._exampleBox.append(this._exampleTitle, this._exampleText);

    // Tips list
    this._tipsTitle = el(doc, 'p', { className: 'ndi-borrow-risk__tips-title' },
      'To stay safe:');
    this._tipsList = el(doc, 'ul', { className: 'ndi-borrow-risk__tips' });

    this._body.append(
      this._hfSection,
      this._liqSection,
      this._exampleBox,
      this._tipsTitle,
      this._tipsList,
    );

    // ── Footer ───────────────────────────────────────────────────────────
    this._footer = el(doc, 'div', { className: 'ndi-borrow-risk__footer' });

    // Acknowledgement row (shown only before first ack)
    this._ackRow = el(doc, 'label', { className: 'ndi-borrow-risk__ack-row' });
    const ackId = `ndi-borrow-ack-${Math.random().toString(36).slice(2)}`;
    this._ackCheckbox = el(doc, 'input', {
      className: 'ndi-borrow-risk__ack-checkbox',
      type: 'checkbox',
      id: ackId,
    });
    this._ackLabel = el(doc, 'span', { className: 'ndi-borrow-risk__ack-label' },
      'I understand that my collateral can be liquidated if my health factor drops to 1 or below.');
    this._ackRow.append(this._ackCheckbox, this._ackLabel);
    this._ackCheckbox.setAttribute('aria-required', 'true');

    // Continue button
    this._continueBtn = el(doc, 'button', {
      className: 'ndi-borrow-risk__continue',
      type: 'button',
      disabled: '',
      'aria-disabled': 'true',
    }, 'Continue to borrow');

    // Always-visible learn more link
    this._learnMoreLink = el(doc, 'a', {
      className: 'ndi-borrow-risk__learn-more',
      href: LEARN_MORE_URL,
      target: '_blank',
      rel: 'noopener noreferrer',
    }, 'Learn more about liquidation');

    this._footer.append(this._ackRow, this._continueBtn, this._learnMoreLink);
    this.append(this._header, this._body, this._footer);

    // ── Event listeners ──────────────────────────────────────────────────
    this._ackCheckbox.addEventListener('change', () => this.#onAckChange());
    this._continueBtn.addEventListener('click', () => this.#onContinue());

    this._built = true;
  }

  #sync() {
    const cf = this.getAttribute('collateral-factor') ?? '75';
    const lt = this.getAttribute('liquidation-threshold') ?? '85';
    const copy = buildCopy(cf, lt);

    // Health factor description
    this._hfDesc.textContent =
      `Your health factor measures how safely your collateral covers your loan. ` +
      `It is calculated as: (collateral value × liquidation threshold) ÷ debt value. ` +
      `A health factor above 1 means you are safe. ` +
      `When it reaches 1 or below, your position can be liquidated by the protocol.`;

    // Liquidation description
    this._liqDesc.textContent =
      `Liquidation happens automatically when your collateral's value falls or your ` +
      `debt grows relative to that value. The protocol sells enough collateral to cover ` +
      `your debt, plus a liquidation penalty. You keep the remaining collateral, but you ` +
      `lose the penalty amount on top of your debt.`;

    // Example box
    this._exampleText.textContent =
      `You deposit $${copy.exampleCollateral} of collateral. ` +
      `With a ${copy.collateralFactor}% collateral factor you can borrow up to $${copy.maxBorrow}. ` +
      `Your liquidation threshold is ${copy.liquidationThreshold}%, so if your collateral value ` +
      `drops to around $${copy.liquidationCollateralValue} — a drop of about ${copy.priceDrop}% — ` +
      `your health factor hits 1 and liquidation can begin.`;

    // Tips
    while (this._tipsList.firstChild) this._tipsList.removeChild(this._tipsList.firstChild);
    const tips = [
      'Borrow less than the maximum to give yourself a safety buffer.',
      'Monitor your health factor regularly, especially when markets are volatile.',
      'Add more collateral or repay part of your loan to increase your health factor.',
      'Set up price alerts for your collateral assets.',
    ];
    for (const tip of tips) {
      const li = el(this.ownerDocument, 'li', { className: 'ndi-borrow-risk__tip' }, tip);
      this._tipsList.append(li);
    }

    // Handle already-acknowledged (returning user in same session)
    if (wasAcknowledged()) {
      this._acknowledged = true;
      this._ackRow.hidden = true;
      this._continueBtn.removeAttribute('disabled');
      this._continueBtn.removeAttribute('aria-disabled');
    }
  }

  #onAckChange() {
    const checked = this._ackCheckbox.checked ?? false;
    if (checked && !this._acknowledged) {
      this._acknowledged = true;
      persistAck();
      this._continueBtn.removeAttribute('disabled');
      this._continueBtn.removeAttribute('aria-disabled');
      this.dispatchEvent(new CustomEvent('ndi-borrow-acknowledged', { bubbles: true }));
    } else if (!checked) {
      // Allow un-checking within the same session (but ack is still in sessionStorage)
      this._continueBtn.setAttribute('disabled', '');
      this._continueBtn.setAttribute('aria-disabled', 'true');
    }
  }

  #onContinue() {
    if (!this._acknowledged) return;
    this.dispatchEvent(new CustomEvent('ndi-borrow-proceed', { bubbles: true }));
  }
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-borrow-risk-explainer')) {
    customElements.define('ndi-borrow-risk-explainer', NdiBorrowRiskExplainer);
  }
}
