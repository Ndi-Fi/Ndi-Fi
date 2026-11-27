/**
 * Minimal DOM stand-in for testing shadow-DOM web components with `node --test`
 * and no third-party dependencies. It extends the frontend help-UI shim with
 * `attachShadow` / `shadowRoot`, event bubbling through the shadow boundary,
 * `stopImmediatePropagation`, and attribute-change callbacks on removal.
 *
 * Only the APIs the Ndi-Fi components use are implemented.
 */

export class FakeEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.key = init.key;
    this.target = init.target ?? null;
    this.relatedTarget = init.relatedTarget ?? null;
    this.defaultPrevented = false;
    this._propagationStopped = false;
    this._immediateStopped = false;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this._propagationStopped = true;
  }

  stopImmediatePropagation() {
    this._propagationStopped = true;
    this._immediateStopped = true;
  }
}

/** CustomEvent stand-in carrying a `detail` payload. */
export class FakeCustomEvent extends FakeEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail ?? null;
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
    this._shadowRoot = null;
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

  get shadowRoot() {
    return this._shadowRoot;
  }

  attachShadow({ mode = 'open' } = {}) {
    const root = new FakeElement('#shadow-root');
    root.ownerDocument = this.ownerDocument;
    root.parentNode = this; // lets composed events bubble from shadow tree to host
    root._isShadowRoot = true;
    this._shadowRoot = root;
    return root;
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
    const key = String(name).toLowerCase();
    const had = this._attributes.has(key);
    const oldValue = had ? this._attributes.get(key) : null;
    this._attributes.delete(key);
    const observed = this.constructor?.observedAttributes ?? [];
    if (had && observed.includes(key) && typeof this.attributeChangedCallback === 'function') {
      this.attributeChangedCallback(key, oldValue, null);
    }
  }

  append(...nodes) {
    for (const node of nodes) {
      this.appendChild(typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node);
    }
  }

  prepend(...nodes) {
    for (const node of nodes.reverse()) {
      const child = typeof node === 'string' ? this.ownerDocument.createTextNode(node) : node;
      if (child.parentNode) child.parentNode.removeChild(child);
      child.parentNode = this;
      this._children.unshift(child);
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
    event.target ??= this;
    let node = this;
    while (node) {
      const listeners = [...(node._listeners.get(event.type) ?? [])];
      for (const handler of listeners) {
        handler.call(node, event);
        if (event._immediateStopped) return !event.defaultPrevented;
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

  blur() {
    if (this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  click() {
    this.dispatchEvent(new FakeEvent('click', { target: this }));
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

  querySelectorAll(selector) {
    const out = [];
    for (const child of this._children) {
      if (matchesSelector(child, selector)) out.push(child);
      if (child.querySelectorAll) out.push(...child.querySelectorAll(selector));
    }
    return out;
  }
}

function matchesSelector(node, selector) {
  const s = String(selector).trim();

  const idOnly = /^#([\w-]+)$/.exec(s);
  if (idOnly) return node.id === idOnly[1];

  const classOnly = /^\.([\w-]+)$/.exec(s);
  if (classOnly) return node.classList.contains(classOnly[1]);

  const attrOnly = /^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(s);
  if (attrOnly) return matchAttr(node, attrOnly);

  // tag, optionally followed by one .class or [attr] qualifier
  const tagMatch = /^([a-zA-Z][\w-]*)(.*)$/.exec(s);
  if (tagMatch) {
    if (node.tagName !== tagMatch[1].toUpperCase()) return false;
    const rest = tagMatch[2];
    if (rest === '') return true;
    const cm = /^\.([\w-]+)$/.exec(rest);
    if (cm) return node.classList.contains(cm[1]);
    const am = /^\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]$/.exec(rest);
    if (am) return matchAttr(node, am);
  }
  return false;
}

function matchAttr(node, m) {
  if (!node.hasAttribute(m[1])) return false;
  if (m[2] === undefined || m[2] === '') return true;
  return node.getAttribute(m[1]) === m[2];
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
    if (Constructor) node.tagName = String(tag).toUpperCase();
    return node;
  }

  createElementNS(namespaceURI, tag) {
    const node = new FakeElement(tag);
    node.namespaceURI = namespaceURI;
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
  globalThis.Event = FakeEvent;
  globalThis.CustomEvent = FakeCustomEvent;
  globalThis.document = new FakeDocument();
  return globalThis.document;
}
