/**
 * <ndi-icon> — inline SVG icon component for the Ndi-Fi design system.
 *
 * ```html
 * <!-- Decorative (default): hidden from assistive tech -->
 * <button><ndi-icon name="deposit"></ndi-icon> Deposit</button>
 *
 * <!-- Meaningful: announced as an image with this name -->
 * <ndi-icon name="warning" label="Warning"></ndi-icon>
 *
 * <!-- Icon-only button: the label belongs on the button, not the icon -->
 * <button aria-label="Close"><ndi-icon name="close"></ndi-icon></button>
 * ```
 *
 * Attributes
 * ----------
 * name        icon key from `icons.js` (unknown names fall back to `help`
 *             and warn once per name in the console)
 * size        xs | sm | md (default) | lg | xl | 2xl, or a pixel integer
 * label       accessible name; makes the icon meaningful (role="img")
 * decorative  forces aria-hidden even when a label is present
 *
 * Colour comes from `currentColor`, so icons follow the surrounding text and
 * the active theme. See README.md for the full iconography guidelines.
 */

import { ICONS, ICON_SVG_ATTRIBUTES, resolveIconSize } from './icons.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Unknown names already warned about, so each typo warns only once. */
const warned = new Set();

function resolveIcon(name) {
  if (name && Object.prototype.hasOwnProperty.call(ICONS, name)) return ICONS[name];
  if (name && !warned.has(name)) {
    warned.add(name);
    console.warn(`[ndi-icon] Unknown icon name "${name}". Falling back to "help".`);
  }
  return ICONS.help;
}

export class NdiIcon extends HTMLElement {
  static get observedAttributes() {
    return ['name', 'size', 'label', 'decorative'];
  }

  constructor() {
    super();
    this._built = false;
    this.attachShadow({ mode: 'open' });
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

    const link = doc.createElement('link');
    link.setAttribute('rel', 'stylesheet');
    link.setAttribute('href', new URL('./ndi-icon.css', import.meta.url).href);

    // SVG elements must be created in the SVG namespace or browsers render
    // them as unknown HTML elements (i.e. nothing).
    this._svg = doc.createElementNS(SVG_NS, 'svg');
    for (const [key, value] of Object.entries(ICON_SVG_ATTRIBUTES)) {
      if (key !== 'xmlns') this._svg.setAttribute(key, value);
    }
    this._svg.setAttribute('focusable', 'false');

    this._titleEl = doc.createElementNS(SVG_NS, 'title');
    this._path = doc.createElementNS(SVG_NS, 'path');
    this._svg.append(this._path);

    this.shadowRoot.append(link, this._svg);
    this._built = true;
  }

  #sync() {
    const icon = resolveIcon(this.getAttribute('name'));
    const px = String(resolveIconSize(this.getAttribute('size')));
    const label = (this.getAttribute('label') || '').trim();
    const decorative = this.hasAttribute('decorative') || !label;

    this._svg.setAttribute('width', px);
    this._svg.setAttribute('height', px);
    this._path.setAttribute('d', icon.path);

    if (decorative) {
      this._svg.setAttribute('aria-hidden', 'true');
      this._svg.removeAttribute('role');
      this._svg.removeAttribute('aria-label');
      if (this._titleEl.parentNode) this._titleEl.remove();
    } else {
      this._svg.removeAttribute('aria-hidden');
      this._svg.setAttribute('role', 'img');
      this._svg.setAttribute('aria-label', label);
      // <title> gives sighted mouse users the same name as a tooltip.
      this._titleEl.textContent = label;
      if (!this._titleEl.parentNode) this._svg.prepend(this._titleEl);
    }
  }
}

if (typeof HTMLElement === 'function' && typeof customElements !== 'undefined') {
  if (!customElements.get('ndi-icon')) customElements.define('ndi-icon', NdiIcon);
}

export default NdiIcon;
