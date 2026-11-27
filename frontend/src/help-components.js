import { getActiveLocale, getTerm, getUiString } from './help-content.js';

let nextId = 0;
const openTooltips = new Set();

function uid(prefix) {
  nextId += 1;
  return `ndi-${prefix}-${nextId}`;
}

function element(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function localeOf(node) {
  return node.getAttribute('locale') || getActiveLocale();
}

/**
 * A tooltip-style help affordance: a labelled button that reveals a short,
 * plain-language definition of a DeFi term.
 *
 * The panel is a non-interactive `role="tooltip"` and is referenced by the
 * trigger's `aria-describedby`. It opens on hover or focus, can be dismissed
 * with Escape or by moving focus away, and never traps focus. Use
 * `<ndi-inline-help>` when the explanation has a "Learn more" step.
 */
export class NdiTooltip extends HTMLElement {
  static get observedAttributes() {
    return ['term', 'locale', 'label'];
  }

  constructor() {
    super();
    this._id = uid('tooltip');
    this._open = false;
    this._built = false;
  }

  get isOpen() {
    return this._open;
  }

  connectedCallback() {
    if (!this._built) this.#build();
    this.#sync();
    this.ownerDocument.addEventListener('pointerdown', this.#onDocumentPointerDown, true);
  }

  disconnectedCallback() {
    this.close();
    this.ownerDocument.removeEventListener('pointerdown', this.#onDocumentPointerDown, true);
  }

  attributeChangedCallback() {
    if (this._built) this.#sync();
  }

  open() {
    if (this.hidden || !this._built || this._open) return;
    for (const other of openTooltips) {
      if (other !== this) other.close();
    }
    openTooltips.add(this);
    this._open = true;
    this._panel.hidden = false;
    this._trigger.setAttribute('aria-expanded', 'true');
    this.classList.add('is-open');

    // Flip below the trigger when there is not enough room above it.
    const rect = this._trigger.getBoundingClientRect();
    this.classList.toggle('is-below', Boolean(rect && rect.top < 140));
  }

  close() {
    if (!this._open) return;
    this._open = false;
    openTooltips.delete(this);
    this._panel.hidden = true;
    this._trigger.setAttribute('aria-expanded', 'false');
    this.classList.remove('is-open', 'is-below');
  }

  #build() {
    const doc = this.ownerDocument;
    this.classList.add('ndi-help');

    this._trigger = element(doc, 'button', 'ndi-help__trigger');
    this._trigger.setAttribute('type', 'button');
    this._trigger.setAttribute('aria-haspopup', 'true');
    this._trigger.setAttribute('aria-describedby', this._id);
    this._trigger.setAttribute('aria-expanded', 'false');

    this._icon = element(doc, 'span', 'ndi-help__icon', '?');
    this._icon.setAttribute('aria-hidden', 'true');
    this._label = element(doc, 'span', 'ndi-help__label');
    this._trigger.append(this._icon, this._label);

    this._panel = element(doc, 'span', 'ndi-help__panel');
    this._panel.id = this._id;
    this._panel.setAttribute('role', 'tooltip');
    this._panel.hidden = true;
    this._term = element(doc, 'strong', 'ndi-help__term');
    this._summary = element(doc, 'span', 'ndi-help__summary');
    this._panel.append(this._term, this._summary);

    this.append(this._trigger, this._panel);

    this.addEventListener('mouseenter', this.#onMouseEnter);
    this.addEventListener('mouseleave', this.#onMouseLeave);
    this.addEventListener('focusin', this.#onFocusIn);
    this.addEventListener('focusout', this.#onFocusOut);
    this.addEventListener('keydown', this.#onKeyDown);
    this._trigger.addEventListener('click', this.#onTriggerClick);
    this._built = true;
  }

  #sync() {
    const entry = getTerm(this.getAttribute('term'), localeOf(this));
    if (!entry) {
      this.close();
      this.hidden = true;
      return;
    }

    this.hidden = false;
    const locale = localeOf(this);
    const label = this.getAttribute('label') || getUiString('whatIs', locale, { term: entry.term });
    this._label.textContent = label;
    this._trigger.setAttribute('aria-label', label);
    this._term.textContent = entry.term;
    this._summary.textContent = entry.summary;
    if (this._open) this.close(); // copy changed; re-open on the next interaction
  }

  #onMouseEnter = () => this.open();

  #onMouseLeave = () => {
    if (!this.contains(this.ownerDocument.activeElement)) this.close();
  };

  #onFocusIn = () => this.open();

  #onFocusOut = (event) => {
    if (event.relatedTarget && this.contains(event.relatedTarget)) return;
    this.close();
  };

  #onTriggerClick = () => this.open();

  #onKeyDown = (event) => {
    if (event.key === 'Escape' || event.key === 'Esc') {
      event.preventDefault?.();
      this.close();
      // Keep the current focus: moving it here would re-trigger `focusin`
      // and immediately reopen the tooltip. The panel has no focusable
      // children, so a keyboard user's focus is already on the trigger.
    }
  };

  #onDocumentPointerDown = (event) => {
    if (this._open && !this.contains(event.target)) this.close();
  };
}

/**
 * Inline help with progressive disclosure: the short summary is always
 * visible, while the longer explanation is hidden until "Learn more" is
 * activated. The disclosure button owns `aria-expanded` / `aria-controls`,
 * and the revealed panel is a labelled region.
 */
export class NdiInlineHelp extends HTMLElement {
  static get observedAttributes() {
    return ['term', 'locale'];
  }

  constructor() {
    super();
    this._id = uid('inline-help');
    this._expanded = false;
    this._built = false;
  }

  get isExpanded() {
    return this._expanded;
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
    this.classList.add('ndi-inline-help');

    this._term = element(doc, 'span', 'ndi-inline-help__term');
    this._term.id = `${this._id}-title`;
    this._summary = element(doc, 'span', 'ndi-inline-help__summary');

    this._toggle = element(doc, 'button', 'ndi-inline-help__toggle');
    this._toggle.setAttribute('type', 'button');
    this._toggle.setAttribute('aria-expanded', 'false');
    this._toggle.setAttribute('aria-controls', this._id);
    this._toggle.addEventListener('click', this.#onToggleClick);

    this._details = element(doc, 'div', 'ndi-inline-help__details');
    this._details.id = this._id;
    this._details.setAttribute('role', 'region');
    this._details.setAttribute('aria-labelledby', this._term.id);
    this._details.hidden = true;
    this._body = element(doc, 'p', 'ndi-inline-help__body');
    this._details.append(this._body);

    this.append(this._term, this._summary, this._toggle, this._details);
    this._built = true;
  }

  #sync() {
    const locale = localeOf(this);
    const entry = getTerm(this.getAttribute('term'), locale);
    if (!entry) {
      this.#setExpanded(false);
      this.hidden = true;
      return;
    }

    this.hidden = false;
    this._term.textContent = entry.term;
    this._summary.textContent = entry.summary;
    this._body.textContent = entry.details;
    this._toggle.textContent = this._expanded
      ? getUiString('showLess', locale)
      : getUiString('learnMore', locale);
  }

  #setExpanded(expanded) {
    this._expanded = expanded;
    this._details.hidden = !expanded;
    this._toggle.setAttribute('aria-expanded', String(expanded));
    this.classList.toggle('is-expanded', expanded);
  }

  #onToggleClick = () => {
    this.#setExpanded(!this._expanded);
    this.#sync();
  };
}

// Registrations are guarded so the content module can be imported in Node
// tests (and by non-browser bundlers) without a DOM present.
if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-tooltip')) customElements.define('ndi-tooltip', NdiTooltip);
  if (!customElements.get('ndi-inline-help')) customElements.define('ndi-inline-help', NdiInlineHelp);
}
