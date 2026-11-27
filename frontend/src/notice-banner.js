/**
 * NdiNoticeBanner — dismissible system-notice banner.
 *
 * Severity levels: info | warning | critical
 * Dismiss state is persisted to localStorage keyed by notice id.
 * The element is non-blocking: it inserts before the first child of its
 * parent and never interrupts focus or form flows.
 *
 * Accessible role and semantics:
 *   - role="alert" for warning/critical (live region, announced immediately)
 *   - role="status" for info (polite live region)
 *   - Dismiss button has an aria-label; the banner has aria-live
 *   - Closing respects focus: focus returns to the element that had it
 */

const STORAGE_KEY_PREFIX = 'ndi-notice-dismissed-';

const SEVERITY_DEFAULTS = {
  info: { icon: 'ℹ', label: 'Information' },
  warning: { icon: '⚠', label: 'Warning' },
  critical: { icon: '✕', label: 'Critical notice' },
};

function wasDismissed(id) {
  if (!id) return false;
  try {
    return localStorage.getItem(STORAGE_KEY_PREFIX + id) === '1';
  } catch {
    return false;
  }
}

function persist(id) {
  if (!id) return;
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + id, '1');
  } catch {
    /* storage unavailable — dismiss is session-only */
  }
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

/**
 * <ndi-notice-banner>
 *
 * Attributes:
 *   notice-id   — unique string; dismissed state is stored under this key
 *   severity    — "info" | "warning" | "critical" (default: "info")
 *   headline    — short title text
 *   message     — longer body text (optional)
 *   dismissible — present/absent boolean; default true
 *
 * Example:
 *   <ndi-notice-banner
 *     notice-id="v2-upgrade-2026-08"
 *     severity="warning"
 *     headline="Scheduled upgrade on 25 Aug"
 *     message="Deposits and withdrawals will be paused for ~10 minutes."
 *   ></ndi-notice-banner>
 */
export class NdiNoticeBanner extends HTMLElement {
  static get observedAttributes() {
    return ['notice-id', 'severity', 'headline', 'message', 'dismissible'];
  }

  constructor() {
    super();
    this._built = false;
    this._dismissed = false;
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#sync();
  }

  attributeChangedCallback() {
    if (this._built) this.#sync();
  }

  get isDismissed() {
    return this._dismissed;
  }

  dismiss() {
    if (this._dismissed) return;
    this._dismissed = true;
    const id = this.getAttribute('notice-id');
    persist(id);
    // Return focus to whatever had focus before interacting with the banner
    const prior = this._priorFocus;
    this.hidden = true;
    this.setAttribute('aria-hidden', 'true');
    if (prior && typeof prior.focus === 'function') prior.focus();
    this.dispatchEvent(new CustomEvent('ndi-notice-dismissed', { bubbles: true, detail: { id } }));
  }

  #build() {
    const doc = this.ownerDocument;
    this.classList.add('ndi-notice-banner');

    this._inner = el(doc, 'div', { className: 'ndi-notice-banner__inner' });

    this._iconEl = el(doc, 'span', { className: 'ndi-notice-banner__icon', 'aria-hidden': 'true' });

    this._textWrap = el(doc, 'div', { className: 'ndi-notice-banner__text' });
    this._headlineEl = el(doc, 'strong', { className: 'ndi-notice-banner__headline' });
    this._messageEl = el(doc, 'span', { className: 'ndi-notice-banner__message' });
    this._textWrap.append(this._headlineEl, this._messageEl);

    this._closeBtn = el(doc, 'button', {
      className: 'ndi-notice-banner__close',
      type: 'button',
    });
    this._closeBtnIcon = el(doc, 'span', { 'aria-hidden': 'true' }, '×');
    this._closeBtnLabel = el(doc, 'span', { className: 'ndi-notice-banner__sr-only' }, 'Dismiss notice');
    this._closeBtn.append(this._closeBtnIcon, this._closeBtnLabel);

    this._inner.append(this._iconEl, this._textWrap, this._closeBtn);
    this.append(this._inner);

    this._closeBtn.addEventListener('click', () => {
      this._priorFocus = this.ownerDocument.activeElement;
      this.dismiss();
    });

    this.addEventListener('focusin', () => {
      this._priorFocus = null; // reset — focus came in, so we don't redirect on dismiss
    });

    this._built = true;
  }

  #sync() {
    const id = this.getAttribute('notice-id') || '';
    const severity = this.getAttribute('severity') || 'info';
    const headline = this.getAttribute('headline') || '';
    const message = this.getAttribute('message') || '';
    const canDismiss = this.getAttribute('dismissible') !== 'false';

    // If previously dismissed (persisted), hide immediately
    if (id && wasDismissed(id)) {
      this._dismissed = true;
      this.hidden = true;
      this.setAttribute('aria-hidden', 'true');
      return;
    }

    this._dismissed = false;
    this.hidden = false;
    this.removeAttribute('aria-hidden');

    // Severity class and ARIA role
    for (const sev of Object.keys(SEVERITY_DEFAULTS)) {
      this.classList.toggle(`ndi-notice-banner--${sev}`, sev === severity);
    }

    const role = severity === 'info' ? 'status' : 'alert';
    this.setAttribute('role', role);
    this.setAttribute('aria-live', severity === 'info' ? 'polite' : 'assertive');
    this.setAttribute('aria-atomic', 'true');

    const { icon, label } = SEVERITY_DEFAULTS[severity] ?? SEVERITY_DEFAULTS.info;
    this._iconEl.textContent = icon;
    this._iconEl.setAttribute('title', label);

    this._headlineEl.textContent = headline;

    if (message) {
      this._messageEl.textContent = message;
      this._messageEl.hidden = false;
    } else {
      this._messageEl.textContent = '';
      this._messageEl.hidden = true;
    }

    this._closeBtn.hidden = !canDismiss;
    this._closeBtn.setAttribute(
      'aria-label',
      `Dismiss: ${headline || label}`,
    );
  }
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-notice-banner')) {
    customElements.define('ndi-notice-banner', NdiNoticeBanner);
  }
}
