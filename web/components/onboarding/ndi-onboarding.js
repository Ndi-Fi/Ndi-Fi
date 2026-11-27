/**
 * <ndi-onboarding-tour> and <ndi-hint> — first-run experience for Ndi-Fi.
 *
 * ```html
 * <link rel="stylesheet" href="/web/components/onboarding/onboarding.css" />
 * <script type="module" src="/web/components/onboarding/ndi-onboarding.js"></script>
 *
 * <!-- Mark the things the tour points at -->
 * <button data-tour="connect-wallet">Connect wallet</button>
 * <a data-tour="deposit" href="/deposit">Deposit</a>
 *
 * <!-- The tour: opens by itself for first-time visitors only -->
 * <ndi-onboarding-tour autostart></ndi-onboarding-tour>
 *
 * <!-- Replay control, anywhere on the page (e.g. in the Help menu) -->
 * <button type="button" data-ndi-tour-replay>Replay tour</button>
 *
 * <!-- One-time contextual hint -->
 * <ndi-hint hint-id="borrow-health-factor"></ndi-hint>
 * ```
 *
 * Both elements share one controller (see `getOnboarding()`), so dismissing
 * a hint or finishing the tour is remembered everywhere.
 *
 * <ndi-onboarding-tour>
 *   attributes  autostart          open on load if the user hasn't seen the tour
 *               wallet-connected   reflect wallet state (hides the connect step)
 *   methods     start() · replay() · skip()
 *   events      ndi-onboarding-change         detail: { status, stepId, reason }
 *               ndi-onboarding-connect-wallet the step's "Connect wallet" CTA
 *   keyboard    Esc skips the tour · focus moves to each step's heading
 *
 * <ndi-hint>
 *   attributes  hint-id  key from DEFAULT_HINTS
 *   events      ndi-hint-dismiss  detail: { id }
 */

import { createOnboarding, TOUR_STATUS } from './onboarding-model.js';
import { iconSvg } from '../icon/icons.js';

let shared = null;

/** The page-wide onboarding controller shared by every element. */
export function getOnboarding() {
  shared ??= createOnboarding();
  return shared;
}

/** Replace the shared controller (tests, or apps that build their own). */
export function setOnboarding(controller) {
  shared = controller;
}

const TARGET_ATTR = 'data-ndi-tour-target';
let uid = 0;

function el(doc, tag, cls, attrs = {}) {
  const node = doc.createElement(tag);
  if (cls) node.setAttribute('class', cls);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

function show(node, visible) {
  if (visible) node.removeAttribute('hidden');
  else node.setAttribute('hidden', '');
}

export class NdiOnboardingTour extends HTMLElement {
  static get observedAttributes() {
    return ['wallet-connected'];
  }

  constructor() {
    super();
    this._built = false;
    this._controller = null;
    this._unsubscribe = null;
    this._target = null;
    this.attachShadow({ mode: 'open' });
  }

  /** The controller in use (defaults to the shared one). */
  get controller() {
    return (this._controller ??= getOnboarding());
  }

  set controller(value) {
    this._unsubscribe?.();
    this._controller = value;
    if (this.isConnected || this._built) this.#subscribe();
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#subscribe();
    this.ownerDocument.addEventListener('click', this.#onDocumentClick);
    this.#syncWallet();
    if (this.hasAttribute('autostart') && this.controller.shouldAutoStart()) this.controller.start();
    else this.#render();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    this._unsubscribe = null;
    this.ownerDocument.removeEventListener('click', this.#onDocumentClick);
    this.#highlight(null);
  }

  attributeChangedCallback(name) {
    if (name === 'wallet-connected' && this._built) this.#syncWallet();
  }

  start() {
    return this.controller.start();
  }

  replay() {
    return this.controller.replay();
  }

  skip() {
    return this.controller.skip();
  }

  #subscribe() {
    this._unsubscribe?.();
    this._unsubscribe = this.controller.subscribe((snap, reason) => this.#render(snap, reason));
    if (this._built) this.#render();
  }

  #syncWallet() {
    const connected = this.hasAttribute('wallet-connected');
    if (this.controller.state.context.walletConnected !== connected) {
      this.controller.setContext({ walletConnected: connected });
    }
  }

  #build() {
    const doc = this.ownerDocument;
    const id = `ndi-tour-${++uid}`;

    const link = el(doc, 'link', null, { rel: 'stylesheet', href: new URL('./ndi-onboarding.css', import.meta.url).href });

    this._panel = el(doc, 'div', 'ndi-tour', {
      role: 'dialog',
      'aria-modal': 'false',
      'aria-labelledby': `${id}-title`,
      'aria-describedby': `${id}-body`,
      hidden: '',
    });

    const header = el(doc, 'div', 'ndi-tour__header');
    this._icon = el(doc, 'span', 'ndi-tour__icon', { 'aria-hidden': 'true' });
    this._progress = el(doc, 'p', 'ndi-tour__progress');
    this._close = el(doc, 'button', 'ndi-tour__close', { type: 'button', 'aria-label': 'Skip tour' });
    this._close.innerHTML = iconSvg('close', { size: 'sm' });
    header.append(this._icon, this._progress, this._close);

    this._title = el(doc, 'h2', 'ndi-tour__title', { id: `${id}-title`, tabindex: '-1' });
    this._body = el(doc, 'p', 'ndi-tour__body', { id: `${id}-body` });
    this._points = el(doc, 'ul', 'ndi-tour__points');

    this._ack = el(doc, 'label', 'ndi-tour__ack');
    this._ackBox = el(doc, 'input', null, { type: 'checkbox' });
    this._ackText = el(doc, 'span');
    this._ackText.textContent = 'I understand how borrowing, health factor and liquidation work.';
    this._ack.append(this._ackBox, this._ackText);

    this._cta = el(doc, 'button', 'ndi-tour__btn ndi-tour__btn--secondary ndi-tour__cta', { type: 'button' });

    const footer = el(doc, 'div', 'ndi-tour__footer');
    this._skip = el(doc, 'button', 'ndi-tour__btn ndi-tour__btn--ghost', { type: 'button' });
    this._skip.textContent = 'Skip tour';
    const nav = el(doc, 'div', 'ndi-tour__nav');
    this._back = el(doc, 'button', 'ndi-tour__btn ndi-tour__btn--secondary', { type: 'button' });
    this._back.textContent = 'Back';
    this._next = el(doc, 'button', 'ndi-tour__btn ndi-tour__btn--primary', { type: 'button' });
    nav.append(this._back, this._next);
    footer.append(this._skip, nav);

    this._panel.append(header, this._title, this._body, this._points, this._ack, this._cta, footer);
    this.shadowRoot.append(link, this._panel);

    this._close.addEventListener('click', () => this.controller.skip());
    this._skip.addEventListener('click', () => this.controller.skip());
    this._back.addEventListener('click', () => this.controller.back());
    this._next.addEventListener('click', () => this.controller.next());
    this._ackBox.addEventListener('change', () => this.controller.acknowledgeRisk(Boolean(this._ackBox.checked)));
    this._cta.addEventListener('click', () => {
      this.dispatchEvent(new CustomEvent('ndi-onboarding-connect-wallet', { bubbles: true, composed: true }));
    });
    this._panel.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault?.();
        this.controller.skip();
      }
    });

    this._built = true;
  }

  #render(snap = this.controller.state, reason = 'render') {
    if (!this._built) return;
    const step = snap.step;
    show(this._panel, Boolean(step));

    if (reason !== 'render') {
      this.dispatchEvent(
        new CustomEvent('ndi-onboarding-change', {
          bubbles: true,
          composed: true,
          detail: { status: snap.status, stepId: step?.id ?? null, reason },
        }),
      );
    }

    if (!step) {
      this.#highlight(null);
      if (reason === 'skip' || reason === 'complete') this.#restoreFocus();
      return;
    }

    this._icon.innerHTML = iconSvg(step.icon || 'info', { size: 'lg' });
    this._progress.textContent = `Step ${snap.index + 1} of ${snap.total}`;
    this._title.textContent = step.title;
    this._body.textContent = step.body;

    this._points.textContent = '';
    for (const point of step.points ?? []) {
      const li = this.ownerDocument.createElement('li');
      li.textContent = point;
      this._points.append(li);
    }
    show(this._points, Boolean(step.points?.length));

    show(this._ack, Boolean(step.requiresAcknowledgement));
    this._ackBox.checked = snap.riskAcknowledged;

    show(this._cta, step.action === 'connect-wallet' && !snap.context.walletConnected);
    this._cta.textContent = 'Connect wallet';

    show(this._back, !snap.isFirst);
    this._next.textContent = snap.isLast ? 'Finish' : 'Next';
    if (snap.canAdvance) {
      this._next.removeAttribute('disabled');
      this._next.removeAttribute('aria-disabled');
    } else {
      this._next.setAttribute('disabled', '');
      this._next.setAttribute('aria-disabled', 'true');
    }
    show(this._skip, !snap.isLast);

    this.#highlight(step.target ? this.ownerDocument.querySelector(step.target) : null);

    if (['start', 'next', 'back', 'replay'].includes(reason)) {
      if (reason === 'start' || reason === 'replay') this._returnFocus ??= this.ownerDocument.activeElement;
      this._title.focus?.();
    }
  }

  #highlight(target) {
    if (this._target && this._target !== target) this._target.removeAttribute(TARGET_ATTR);
    this._target = target;
    if (!target) {
      this._panel?.removeAttribute('data-placement');
      if (this._panel?.style) {
        this._panel.style.top = '';
        this._panel.style.left = '';
      }
      return;
    }
    target.setAttribute(TARGET_ATTR, '');
    target.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    this.#position(target);
  }

  #position(target) {
    const view = this.ownerDocument.defaultView;
    const rect = target.getBoundingClientRect?.();
    if (!rect || !view || view.innerWidth < 640) {
      // Narrow screens: CSS docks the panel to the bottom as a sheet.
      this._panel.setAttribute('data-placement', 'sheet');
      return;
    }
    const below = rect.bottom + 12;
    const fitsBelow = below + 260 < view.innerHeight;
    const top = fitsBelow ? below : Math.max(12, rect.top - 12 - 260);
    const left = Math.min(Math.max(12, rect.left), view.innerWidth - 12 - 360);
    this._panel.setAttribute('data-placement', fitsBelow ? 'below' : 'above');
    this._panel.style.top = `${Math.round(top)}px`;
    this._panel.style.left = `${Math.round(left)}px`;
  }

  #restoreFocus() {
    const back = this._returnFocus;
    this._returnFocus = null;
    if (back && typeof back.focus === 'function' && back !== this.ownerDocument.body) back.focus();
  }

  #onDocumentClick = (event) => {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
    if (path.some((node) => node?.hasAttribute?.('data-ndi-tour-replay'))) {
      this._returnFocus = event.target;
      this.controller.replay();
    }
  };
}

export class NdiHint extends HTMLElement {
  static get observedAttributes() {
    return ['hint-id'];
  }

  constructor() {
    super();
    this._built = false;
    this._controller = null;
    this._unsubscribe = null;
    this.attachShadow({ mode: 'open' });
  }

  get controller() {
    return (this._controller ??= getOnboarding());
  }

  set controller(value) {
    this._unsubscribe?.();
    this._controller = value;
    if (this._built) this.#subscribe();
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#subscribe();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    this._unsubscribe = null;
  }

  attributeChangedCallback() {
    if (this._built) this.#render();
  }

  dismiss() {
    const id = this.getAttribute('hint-id');
    this.controller.dismissHint(id);
    this.dispatchEvent(new CustomEvent('ndi-hint-dismiss', { bubbles: true, composed: true, detail: { id } }));
  }

  #subscribe() {
    this._unsubscribe?.();
    this._unsubscribe = this.controller.subscribe(() => this.#render());
    this.#render();
  }

  #build() {
    const doc = this.ownerDocument;
    const link = el(doc, 'link', null, { rel: 'stylesheet', href: new URL('./ndi-onboarding.css', import.meta.url).href });
    this._box = el(doc, 'aside', 'ndi-hint', { hidden: '' });
    this._icon = el(doc, 'span', 'ndi-hint__icon', { 'aria-hidden': 'true' });
    const text = el(doc, 'div', 'ndi-hint__text');
    this._title = el(doc, 'p', 'ndi-hint__title');
    this._body = el(doc, 'p', 'ndi-hint__body');
    text.append(this._title, this._body);
    this._dismiss = el(doc, 'button', 'ndi-hint__dismiss', { type: 'button' });
    this._dismiss.textContent = 'Got it';
    this._dismiss.addEventListener('click', () => this.dismiss());
    this._box.append(this._icon, text, this._dismiss);
    this.shadowRoot.append(link, this._box);
    this._built = true;
  }

  #render() {
    const id = this.getAttribute('hint-id');
    const hint = this.controller.getHint(id);
    const visible = Boolean(hint) && this.controller.shouldShowHint(id, { ignoreTrigger: true });
    show(this._box, visible);
    if (visible) this.removeAttribute('hidden');
    else this.setAttribute('hidden', '');
    if (!hint) return;
    this._box.setAttribute('aria-label', hint.title);
    this._icon.innerHTML = iconSvg(hint.icon || 'lightbulb', { size: 'md' });
    this._title.textContent = hint.title;
    this._body.textContent = hint.body;
  }
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-onboarding-tour')) customElements.define('ndi-onboarding-tour', NdiOnboardingTour);
  if (!customElements.get('ndi-hint')) customElements.define('ndi-hint', NdiHint);
}

export { TOUR_STATUS };
