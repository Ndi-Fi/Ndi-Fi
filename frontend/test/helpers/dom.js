/**
 * Minimal DOM stand-in used by the component tests. It implements only the
 * APIs help-components.js needs, so the tests run with `node --test` and no
 * third-party dependencies.
 */

export class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key;
    this.target = init.target ?? null;
    this.relatedTarget = init.relatedTarget ?? null;
    this.defaultPrevented = false;
    this._propagationStopped = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }
}

class FakeClassList {
  constructor(node) {
    this.node = node;
  }

  _names() {
    return (this.node.getAttribute('class') || '').split(/\s+/).filter(Boolean);
  }

  add(...names) {
    const set = new Set(this._names());
    for (const name of names) set.add(name);
    this.node.setAttribute('class', [...set].join(' '));
  }

  remove(...names) {
    const set = new Set(this._names());
    for (const name of names) set.delete(name);
    this.node.setAttribute('class', [...set].join(' '));
  }

  contains(name) {
    return this._names().includes(name);
  }

  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.contains(name) : Boolean(force);
    if (shouldAdd) this.add(name);
    else this.remove(name);
    return shouldAdd;
  }
}

export class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this._attributes = new Map();
    this._children = [];
    this._listeners = new Map();
    this._text = '';
    this.parentNode = null;
    this.hidden = false;
    this.style = {};
    this.ownerDocument = globalThis.document ?? null;
    this.classList = new FakeClassList(this);
    this._rect = { top: 200, bottom: 220, left: 0, right: 20, width: 20, height: 20 };
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get children() {
    return this._children.slice();
  }

  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    const oldValue = this._attributes.has(key) ? this._attributes.get(key) : null;
    const nextValue = String(value);
    this._attributes.set(key, nextValue);
    const observed = this.constructor?.observedAttributes ?? [];
    if (oldValue !== nextValue && observed.includes(key) && typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(key, oldValue, nextValue);
    }
  }

  getAttribute(name) {
    const key = String(name).toLowerCase();
    return this._attributes.has(key) ? this._attributes.get(key) : null;
  }

  hasAttribute(name) {
    return this._attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    this._attributes.delete(String(name).toLowerCase());
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node);
    }
  }

  appendChild(node) {
    if (node.parentNode) node.parentNode.removeChild(node);
    node.parentNode = this;
    this._children.push(node);
    if (typeof node.connectedCallback === 'function' && !node._connected) {
      node._connected = true;
      node.connectedCallback();
    }
    return node;
  }

  removeChild(node) {
    const index = this._children.indexOf(node);
    if (index === -1) return node;
    this._children.splice(index, 1);
    node.parentNode = null;
    if (typeof node.disconnectedCallback === 'function') node.disconnectedCallback();
    return node;
  }

  remove() {
    this.parentNode?.removeChild(this);
  }

  get textContent() {
    if (this._text) return this._text;
    return this._children.map((child) => child.textContent).join('');
  }

  set textContent(value) {
    this._children.forEach((child) => {
      child.parentNode = null;
    });
    this._children = [];
    this._text = String(value);
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event) {
    // `event.target` is a read-only getter on native Event / CustomEvent objects
    // from Node's globalThis. Use a safe assignment that works for both native
    // events (define a plain property) and FakeEvent objects (writable property).
    if (event.target == null) {
      try {
        event.target = this;
      } catch {
        try { Object.defineProperty(event, 'target', { value: this, writable: true, configurable: true }); } catch { /* ignore */ }
      }
    }
    let node = this;
    while (node) {
      for (const handler of node._listeners.get(event.type) ?? []) {
        handler.call(node, event);
      }
      if (event._propagationStopped) break;
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }

  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this._children.some((child) => child.contains(node));
  }

  focus() {
    if (this.ownerDocument.activeElement === this) return;
    this.ownerDocument.activeElement = this;
    this.dispatchEvent(new FakeEvent('focusin', { target: this }));
  }

  getBoundingClientRect() {
    return this._rect;
  }

  matches() {
    return false;
  }

  querySelector(selector) {
    for (const child of this._children) {
      if (matchesSelector(child, selector)) return child;
      const nested = child.querySelector?.(selector);
      if (nested) return nested;
    }
    return null;
  }
}

function matchesSelector(node, selector) {
  if (selector.startsWith('#')) return node.id === selector.slice(1);
  if (selector.startsWith('.')) return node.classList.contains(selector.slice(1));
  if (selector.startsWith('[')) {
    const match = /^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(selector);
    if (!match) return false;
    return node.hasAttribute(match[1]) && (match[2] === undefined || node.getAttribute(match[1]) === match[2]);
  }
  return node.tagName === selector.toUpperCase();
}

const registry = new Map();

export const customElements = {
  define(tag, constructor) {
    registry.set(String(tag).toLowerCase(), constructor);
  },
  get(tag) {
    return registry.get(String(tag).toLowerCase());
  },
};

export class FakeDocument extends FakeElement {
  constructor() {
    super('#document');
    this.ownerDocument = this;
    this.activeElement = null;
    this.body = this.createElement('body');
    this.appendChild(this.body);
  }

  createElement(tag) {
    const Constructor = registry.get(String(tag).toLowerCase());
    const node = Constructor ? new Constructor() : new FakeElement(tag);
    node.ownerDocument = this;
    return node;
  }

  createTextNode(text) {
    const node = new FakeElement('#text');
    node.ownerDocument = this;
    node.textContent = text;
    return node;
  }
}

/** Install browser globals needed by the custom elements module. */
export function installDom() {
  globalThis.HTMLElement = FakeElement;
  globalThis.customElements = customElements;
  globalThis.document = new FakeDocument();
  return globalThis.document;
}
