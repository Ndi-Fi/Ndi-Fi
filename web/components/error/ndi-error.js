/**
 * <ndi-error> — the one error state component used across Ndi-Fi.
 *
 * Shows what happened, what to do next, and a single recovery action, with
 * the raw error tucked behind a "Technical details" disclosure.
 *
 * ```html
 * <!-- From a thrown error (classified automatically) -->
 * <ndi-error id="deposit-error" contract="vault" hidden></ndi-error>
 * <script type="module">
 *   const box = document.getElementById('deposit-error');
 *   try { await deposit(); } catch (err) { box.error = err; box.hidden = false; }
 *   box.addEventListener('ndi-error-action', (e) => {
 *     if (e.detail.kind === 'retry') deposit();
 *     if (e.detail.kind === 'switch-network') switchChain();
 *   });
 * </script>
 *
 * <!-- From a known template code -->
 * <ndi-error code="wrong-network" network="Ethereum Sepolia"></ndi-error>
 *
 * <!-- From a raw message string, French, compact -->
 * <ndi-error error="execution reverted: Too early" locale="fr" compact></ndi-error>
 * ```
 *
 * Attributes
 * ----------
 * code          template code (see error-templates.js TEMPLATES)
 * error         raw error message to classify (or set the `.error` property
 *               to any thrown value — Error, RPC error object, string)
 * contract      'lending' | 'staking' | … — disambiguates Soroban error codes
 * locale        'en' (default) | 'es' | 'fr'; region tags fall back (fr-CA → fr)
 * network       fills {network} in copy, e.g. "Ethereum Sepolia"
 * token         fills {token} in copy, e.g. "ETH" or "XLM"
 * heading       overrides the title
 * message       overrides the message
 * action        overrides the action kind (retry | switch-network |
 *               connect-wallet | edit | dismiss | none)
 * action-label  overrides the button label
 * compact       one-line inline variant (for form fields and table rows)
 * dismissible   adds a close button alongside the action
 *
 * Events (bubbling, composed)
 * ------
 * ndi-error-action   detail: { kind, code, category } — the CTA was pressed.
 *                    For kind "dismiss" the element hides itself afterwards
 *                    unless the listener calls preventDefault().
 * ndi-error-dismiss  detail: { code } — the element hid itself.
 */

import { describeError, getErrorTemplate } from './error-templates.js';
import { getMessages } from './error-messages.js';
import { iconSvg } from '../icon/icons.js';

const SEVERITY_ICON = Object.freeze({ error: 'error', warning: 'warning', info: 'info' });

export class NdiError extends HTMLElement {
  static get observedAttributes() {
    return ['code', 'error', 'contract', 'locale', 'network', 'token', 'heading', 'message', 'action', 'action-label', 'compact', 'dismissible'];
  }

  constructor() {
    super();
    this._built = false;
    this._error = undefined;
    this._description = null;
    this.attachShadow({ mode: 'open' });
  }

  /** The thrown value to describe. Takes precedence over the `error`/`code` attributes. */
  get error() {
    return this._error;
  }

  set error(value) {
    this._error = value;
    if (this._built) this.#sync();
  }

  /** The resolved, localised description currently shown. */
  get description() {
    return this._description;
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#sync();
  }

  attributeChangedCallback() {
    if (this._built) this.#sync();
  }

  /** Hide the element and emit `ndi-error-dismiss`. */
  dismiss() {
    this.setAttribute('hidden', '');
    this.dispatchEvent(
      new CustomEvent('ndi-error-dismiss', { bubbles: true, composed: true, detail: { code: this._description?.code } }),
    );
  }

  #build() {
    const doc = this.ownerDocument;
    const el = (tag, cls) => {
      const node = doc.createElement(tag);
      if (cls) node.setAttribute('class', cls);
      return node;
    };

    const link = el('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', new URL('./ndi-error.css', import.meta.url).href);

    this._wrapper = el('div', 'ndi-error');
    this._icon = el('span', 'ndi-error__icon');
    this._icon.setAttribute('aria-hidden', 'true');

    this._body = el('div', 'ndi-error__body');
    this._title = el('p', 'ndi-error__title');
    this._message = el('p', 'ndi-error__message');
    this._body.append(this._title, this._message);

    this._actions = el('div', 'ndi-error__actions');
    this._cta = el('button', 'ndi-error__cta');
    this._cta.setAttribute('type', 'button');
    this._cta.addEventListener('click', this.#onCta);
    this._close = el('button', 'ndi-error__close');
    this._close.setAttribute('type', 'button');
    this._close.innerHTML = iconSvg('close', { size: 'sm' });
    this._close.addEventListener('click', () => this.dismiss());
    this._actions.append(this._cta, this._close);

    this._details = el('details', 'ndi-error__details');
    this._summary = el('summary');
    this._raw = el('pre', 'ndi-error__raw');
    this._details.append(this._summary, this._raw);

    this._wrapper.append(this._icon, this._body, this._actions, this._details);
    this.shadowRoot.append(link, this._wrapper);
    this._built = true;
  }

  #source() {
    if (this._error !== undefined && this._error !== null) return this._error;
    const code = this.getAttribute('code');
    if (code && getErrorTemplate(code).code === code) {
      // A known code, optionally with the raw error string as technical detail.
      return code;
    }
    return this.getAttribute('error') || code || 'unknown';
  }

  #sync() {
    const locale = this.getAttribute('locale') || this.ownerDocument?.documentElement?.getAttribute?.('lang') || 'en';
    const vars = {};
    for (const key of ['network', 'token']) {
      const value = this.getAttribute(key);
      if (value) vars[key] = value;
    }
    const base = describeError(this.#source(), { locale, contract: this.getAttribute('contract') || undefined, vars });
    const ui = getMessages(locale);

    const kind = this.getAttribute('action') || base.action.kind;
    const label =
      this.getAttribute('action-label') ||
      (kind === base.action.kind ? base.action.label : ui.actions[kind] ?? '');
    const rawAttr = this.getAttribute('code') && this.getAttribute('error') ? this.getAttribute('error') : '';
    const technical = base.technical || rawAttr;

    const d = (this._description = Object.freeze({
      ...base,
      title: this.getAttribute('heading') || base.title,
      message: this.getAttribute('message') || base.message,
      action: Object.freeze({ kind, label: kind === 'none' ? '' : label }),
      technical,
    }));

    this._wrapper.setAttribute('data-severity', d.severity);
    this._wrapper.setAttribute('data-category', d.category);
    this._wrapper.setAttribute('data-code', d.code);
    // Errors interrupt; warnings and info wait their turn.
    this._wrapper.setAttribute('role', d.severity === 'error' ? 'alert' : 'status');
    this._wrapper.setAttribute('lang', ui.locale);

    this._icon.innerHTML = iconSvg(SEVERITY_ICON[d.severity] ?? 'error', { size: this.hasAttribute('compact') ? 'sm' : 'md' });
    this._title.textContent = d.title;
    this._message.textContent = d.message;

    if (d.action.kind !== 'none' && d.action.label) {
      this._cta.textContent = d.action.label;
      this._cta.setAttribute('data-kind', d.action.kind);
      this._cta.setAttribute('class', `ndi-error__cta ndi-error__cta--${d.action.kind === 'dismiss' ? 'ghost' : 'primary'}`);
      this._cta.removeAttribute('hidden');
    } else {
      this._cta.textContent = '';
      this._cta.removeAttribute('data-kind');
      this._cta.setAttribute('hidden', '');
    }

    const showClose = this.hasAttribute('dismissible') && d.action.kind !== 'dismiss';
    if (showClose) this._close.removeAttribute('hidden');
    else this._close.setAttribute('hidden', '');
    this._close.setAttribute('aria-label', ui.ui.dismiss);

    const hasActions = !this._cta.hasAttribute('hidden') || showClose;
    if (hasActions) this._actions.removeAttribute('hidden');
    else this._actions.setAttribute('hidden', '');

    this._summary.textContent = ui.ui.details;
    this._raw.textContent = d.technical;
    if (d.technical) this._details.removeAttribute('hidden');
    else this._details.setAttribute('hidden', '');
  }

  #onCta = (event) => {
    event.stopPropagation();
    const d = this._description;
    if (!d) return;
    const action = new CustomEvent('ndi-error-action', {
      bubbles: true,
      composed: true,
      cancelable: true,
      detail: { kind: d.action.kind, code: d.code, category: d.category },
    });
    const notCancelled = this.dispatchEvent(action);
    if (d.action.kind === 'dismiss' && notCancelled) this.dismiss();
  };
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-error')) customElements.define('ndi-error', NdiError);
}

export default NdiError;
