import assert from 'node:assert/strict';
import test from 'node:test';

/** Minimal DOM stand-in: enough to instantiate the custom element in Node. */
class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = String(tagName).toUpperCase();
    this._attributes = new Map();
    this._children = [];
    this._listeners = new Map();
    this.innerHTML = '';
    this.dataset = {};
    this.activeElement = null;
  }

  setAttribute(name, value) {
    const key = String(name).toLowerCase();
    const previous = this._attributes.has(key) ? this._attributes.get(key) : null;
    const next = String(value);
    this._attributes.set(key, next);
    if (previous !== next && this.constructor.observedAttributes?.includes(key)) {
      this.attributeChangedCallback?.(key, previous, next);
    }
  }

  getAttribute(name) {
    return this._attributes.get(String(name).toLowerCase()) ?? null;
  }

  hasAttribute(name) {
    return this._attributes.has(String(name).toLowerCase());
  }

  removeAttribute(name) {
    const key = String(name).toLowerCase();
    const previous = this._attributes.get(key) ?? null;
    this._attributes.delete(key);
    if (previous !== null && this.constructor.observedAttributes?.includes(key)) {
      this.attributeChangedCallback?.(key, previous, null);
    }
  }

  append(...nodes) {
    for (const node of nodes) this._children.push(node);
  }

  contains(node) {
    return this._children.includes(node);
  }

  addEventListener(type, handler) {
    const handlers = this._listeners.get(type) ?? new Set();
    handlers.add(handler);
    this._listeners.set(type, handlers);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  querySelector(selector) {
    const attribute = selector.match(/^\[([^\]]+)\]$/)?.[1];
    if (!attribute) return null;
    const [, name, value] = attribute.match(/^([^=]+)(?:="([^"]*)")?$/);
    return this._children.find((child) => child.hasAttribute?.(name)
      && (value === undefined || child.getAttribute(name) === value)) ?? null;
  }

  querySelectorAll() {
    return [];
  }

  emit(type, event) {
    for (const handler of this._listeners.get(type) ?? []) handler(event);
  }

  focus() {}
}

class FakeShadowRoot extends FakeElement {}
class FakeHTMLElement extends FakeElement {
  constructor() {
    super('ndi-data-table');
    this.shadowRoot = new FakeShadowRoot('#shadow-root');
  }

  get isConnected() {
    return true;
  }

  get ownerDocument() {
    return globalThis.document;
  }

  attachShadow() {
    return this.shadowRoot;
  }

  dispatchEvent() {
    return true;
  }
}

const definitions = new Map();

globalThis.HTMLElement = FakeHTMLElement;
globalThis.document = {
  createElement: (tagName) => new FakeElement(tagName),
  baseURI: 'http://localhost/',
};
globalThis.window = {
  matchMedia: () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
};
globalThis.CustomEvent = class CustomEventStub {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
globalThis.customElements = {
  get: (name) => definitions.get(name),
  define: (name, constructor) => definitions.set(name, constructor),
};

const { NdiDataTable } = await import('./ndi-data-table.js');

function createTable({ mobile = false, variant = 'positions' } = {}) {
  globalThis.window.matchMedia = () => ({
    matches: mobile,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  });

  const table = new NdiDataTable();
  table.setAttribute('variant', variant);
  table.connectedCallback();
  return {
    table,
    html: table.shadowRoot.querySelector('[data-table-root]').innerHTML,
  };
}

test('desktop view renders a semantic table with labelled headers and row headers', () => {
  const { html } = createTable();

  assert.match(html, /<table class="ndi-data-table__table">/);
  assert.match(html, /<caption class="ndi-data-table__sr-only">Open positions<\/caption>/);
  assert.match(html, /<th scope="col"[^>]*>/);
  assert.match(html, /<th scope="row"/);
  assert.match(html, /aria-label="Sort by Asset"/);
  assert.doesNotMatch(html, /<ul class="ndi-data-table__cards"/);
});

test('toolbar exposes search, filter, sort and page-size affordances', () => {
  const { html } = createTable({ variant: 'history' });

  assert.match(html, /type="search" data-control="query"/);
  assert.match(html, /data-control="filter" data-key="type"/);
  assert.match(html, /data-control="sort-key"/);
  assert.match(html, /data-control="page-size"/);
  assert.match(html, /data-action="sort-direction"/);
  assert.match(html, /Showing 1–5 of 18 rows/);
  assert.match(html, /aria-current="page"/);
});

test('mobile view replaces the table with accessible cards', () => {
  const { html } = createTable({ mobile: true });

  assert.match(html, /<ul class="ndi-data-table__cards" role="list"/);
  assert.match(html, /<h3 class="ndi-data-table__card-title">/);
  assert.match(html, /<dl class="ndi-data-table__card-list">/);
  assert.match(html, /<dt>Type<\/dt>/);
  assert.doesNotMatch(html, /<table /);
});

test('mobile cards use an explicitly marked primary column as the title', () => {
  const { table } = createTable({ mobile: true });
  table.setRows(
    [{ asset: 'NDI', activity: 'Staked NDI' }],
    [
      { key: 'asset', label: 'Asset' },
      { key: 'activity', label: 'Activity', primary: true },
    ],
  );
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.match(html, /<h3 class="ndi-data-table__card-title">Staked NDI<\/h3>/);
  assert.match(html, /<dt>Asset<\/dt>/);
});

test('loading state is announced and suppresses data rows', () => {
  const { table } = createTable();
  table.setAttribute('loading', '');
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.match(html, /aria-busy="true"/);
  assert.match(html, /ndi-data-table__spinner/);
  assert.match(html, /Loading open positions…/);
  assert.doesNotMatch(html, /<tbody>/);
});

test('empty state replaces rows without offering irrelevant filter controls', () => {
  const { table } = createTable();
  table.setRows([]);
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.match(html, /Nothing here yet/);
  assert.match(html, /No open positions yet\./);
  assert.doesNotMatch(html, /data-action="clear-filters"/);
  assert.doesNotMatch(html, /<tbody>/);
});

test('injected row content is escaped before rendering', () => {
  const { table } = createTable();
  table.setRows([{ asset: '<img src=x onerror=alert(1)>', type: 'Staking', value: 1 }]);
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('a query with no matches shows the filtered empty state', () => {
  const { table } = createTable();
  const root = table.shadowRoot.querySelector('[data-table-root]');

  root.emit('input', {
    target: { dataset: { control: 'query' }, value: 'no-such-position' },
  });
  const html = root.innerHTML;

  assert.match(html, /No matching rows/);
  assert.match(html, /No rows match the current filters\./);
  assert.match(html, /data-action="clear-filters"/);
  assert.doesNotMatch(html, /Nothing here yet/);
});

test('submitting the search form is prevented instead of reloading the page', () => {
  const { table } = createTable();
  const root = table.shadowRoot.querySelector('[data-table-root]');
  let prevented = false;

  root.emit('submit', { preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
});

test('page-size state matches the effective, clamped page size', () => {
  const { table } = createTable();
  table.setAttribute('page-size', '200');
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.equal(table.getState().pageSize, 100);
  assert.match(html, /<option value="100" selected>100<\/option>/);
});

test('announcements use a dedicated live region rather than the rebuilt summary', () => {
  const { table } = createTable();
  const announcer = table.shadowRoot.querySelector('[data-announcer]');
  const html = table.shadowRoot.querySelector('[data-table-root]').innerHTML;

  assert.ok(announcer);
  assert.equal(announcer.getAttribute('role'), 'status');
  assert.equal(announcer.getAttribute('aria-live'), 'polite');
  assert.doesNotMatch(html, /ndi-data-table__summary[^>]*aria-live/);
});
