/**
 * Tests for <ndi-empty-state>.
 *
 * Run with: node --test (from the repo root or the web/ directory).
 *
 * Uses the Node.js built-in test runner + a lightweight DOM shim so the
 * component module can be loaded without a browser.
 */

import assert from 'node:assert/strict';
import { describe, it, before, beforeEach } from 'node:test';

// ---------------------------------------------------------------------------
// Minimal DOM shim — avoids a full jsdom dependency.
// ---------------------------------------------------------------------------

class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = init.bubbles ?? false;
    this.detail = init.detail ?? null;
  }
}

class MockCustomEvent extends MockEvent {
  constructor(type, init = {}) {
    super(type, init);
    this.detail = init.detail ?? null;
  }
}

class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.attributes = {};
    this.children = [];
    this.eventListeners = {};
    this.className = '';
    this.dataset = {};
    this.hidden = false;
    this.id = '';
    this.innerHTML = '';
    this.textContent = '';
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = value;
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  removeAttribute(name) {
    delete this.attributes[name];
  }

  querySelector(selector) {
    // Very limited: finds the first element in a flat children list.
    return this.children.find((c) => selectorMatches(c, selector)) ?? null;
  }

  querySelectorAll(selector) {
    return this.children.filter((c) => selectorMatches(c, selector));
  }

  addEventListener(type, fn) {
    (this.eventListeners[type] ??= []).push(fn);
  }

  dispatchEvent(event) {
    for (const fn of this.eventListeners[event.type] ?? []) fn(event);
    return true;
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  contains() {
    return false;
  }
}

function selectorMatches(el, selector) {
  if (!el || typeof el !== 'object') return false;
  if (selector.startsWith('.')) return el.className?.includes(selector.slice(1));
  if (selector.startsWith('[') && selector.endsWith(']')) {
    const attr = selector.slice(1, -1);
    return el.hasAttribute(attr);
  }
  return el.tagName?.toLowerCase() === selector.toLowerCase();
}

// ---------------------------------------------------------------------------
// Inject the shim into globalThis before importing the component.
// ---------------------------------------------------------------------------

globalThis.HTMLElement = class HTMLElement extends MockElement {
  constructor() {
    super('unknown');
    this.isConnected = false;
  }

  get isConnected() {
    return this._connected ?? false;
  }

  set isConnected(v) {
    this._connected = v;
  }
};

globalThis.CustomEvent = MockCustomEvent;

const registeredElements = new Map();
globalThis.customElements = {
  define(name, cls) {
    registeredElements.set(name, cls);
  },
  get(name) {
    return registeredElements.get(name) ?? undefined;
  },
};

// ---------------------------------------------------------------------------
// Import the component (registration happens at module load).
// ---------------------------------------------------------------------------

const { NdiEmptyState } = await import('./ndi-empty-state.js');

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeElement(attrs = {}) {
  const el = new NdiEmptyState();
  el.tagName = 'NDI-EMPTY-STATE';
  el.attributes = { ...attrs };
  el.isConnected = true;
  el.innerHTML = '';
  el.children = [];
  el.eventListeners = {};
  // Simulate connectedCallback.
  el.connectedCallback();
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NdiEmptyState registration', () => {
  it('registers <ndi-empty-state> in customElements', () => {
    assert.ok(
      customElements.get('ndi-empty-state'),
      'ndi-empty-state must be registered',
    );
  });
});

describe('Default variants', () => {
  it('renders default heading for positions variant', () => {
    const el = makeElement({ variant: 'positions' });
    assert.ok(
      el.innerHTML.includes('No open positions'),
      'default heading for positions must be present',
    );
  });

  it('renders default heading for rewards variant', () => {
    const el = makeElement({ variant: 'rewards' });
    assert.ok(
      el.innerHTML.includes('No rewards yet'),
      'default heading for rewards must be present',
    );
  });

  it('renders default heading for loans variant', () => {
    const el = makeElement({ variant: 'loans' });
    assert.ok(
      el.innerHTML.includes('No active loans'),
      'default heading for loans must be present',
    );
  });

  it('falls back to positions variant for unknown variant', () => {
    const el = makeElement({ variant: 'unknown-thing' });
    assert.ok(
      el.innerHTML.includes('No open positions'),
      'unknown variant must fall back to positions default',
    );
  });

  it('falls back to positions when variant is absent', () => {
    const el = makeElement({});
    assert.ok(
      el.innerHTML.includes('No open positions'),
      'missing variant must fall back to positions default',
    );
  });
});

describe('Custom attribute overrides', () => {
  it('uses the heading attribute when provided', () => {
    const el = makeElement({ variant: 'positions', heading: 'Your portfolio is empty' });
    assert.ok(
      el.innerHTML.includes('Your portfolio is empty'),
      'custom heading must override the default',
    );
    assert.ok(
      !el.innerHTML.includes('No open positions'),
      'default heading must not appear when custom heading is set',
    );
  });

  it('uses the body attribute when provided', () => {
    const el = makeElement({
      variant: 'rewards',
      body: 'Custom body text goes here.',
    });
    assert.ok(el.innerHTML.includes('Custom body text goes here.'));
  });

  it('renders an anchor when cta-href is set', () => {
    const el = makeElement({
      variant: 'positions',
      'cta-label': 'Go deposit',
      'cta-href': '/deposit',
    });
    assert.ok(
      el.innerHTML.includes('href="/deposit"'),
      'primary CTA with href must render as an anchor',
    );
    assert.ok(
      el.innerHTML.includes('Go deposit'),
      'anchor must carry the cta-label text',
    );
  });

  it('renders a button when cta-href is absent', () => {
    const el = makeElement({
      variant: 'positions',
      'cta-label': 'Open a position',
    });
    assert.ok(
      el.innerHTML.includes('<button'),
      'primary CTA without href must render as a button',
    );
    assert.ok(
      el.innerHTML.includes('Open a position'),
    );
  });

  it('renders secondary CTA when secondary-label is set', () => {
    const el = makeElement({
      variant: 'positions',
      'cta-label': 'Primary',
      'secondary-label': 'Learn more',
      'secondary-href': '/docs',
    });
    assert.ok(el.innerHTML.includes('Learn more'));
    assert.ok(el.innerHTML.includes('href="/docs"'));
  });

  it('omits the actions section when no CTA labels are provided', () => {
    const el = makeElement({ variant: 'positions', 'cta-label': '' });
    assert.ok(
      !el.innerHTML.includes('ndi-es__actions'),
      'actions wrapper must not render when there are no CTAs',
    );
  });
});

describe('Bordered modifier', () => {
  it('adds ndi-es--bordered class when bordered attribute is present', () => {
    const el = makeElement({ variant: 'positions', bordered: '' });
    assert.ok(
      el.innerHTML.includes('ndi-es--bordered'),
      'bordered attribute must add the modifier class',
    );
  });

  it('omits ndi-es--bordered when bordered attribute is absent', () => {
    const el = makeElement({ variant: 'positions' });
    assert.ok(
      !el.innerHTML.includes('ndi-es--bordered'),
      'ndi-es--bordered must not appear without the attribute',
    );
  });
});

describe('Accessibility', () => {
  it('wraps content in a <section> with aria-label', () => {
    const el = makeElement({ variant: 'positions' });
    assert.ok(
      el.innerHTML.includes('<section') && el.innerHTML.includes('aria-label='),
      'section must carry aria-label for landmark navigation',
    );
  });

  it('aria-label matches the heading text', () => {
    const heading = 'Custom accessible heading';
    const el = makeElement({ variant: 'positions', heading });
    assert.ok(
      el.innerHTML.includes(`aria-label="${heading}"`),
      'aria-label must equal the heading text',
    );
  });

  it('renders an h2 for the heading', () => {
    const el = makeElement({ variant: 'positions' });
    assert.ok(
      el.innerHTML.includes('<h2'),
      'heading must render as an h2',
    );
  });

  it('marks the icon aria-hidden', () => {
    const el = makeElement({ variant: 'rewards' });
    assert.ok(
      el.innerHTML.includes('aria-hidden="true"'),
      'decorative icon must be hidden from assistive technology',
    );
  });
});

describe('XSS safety — HTML escaping', () => {
  it('escapes angle brackets in heading', () => {
    const el = makeElement({ variant: 'positions', heading: '<script>alert(1)</script>' });
    assert.ok(
      !el.innerHTML.includes('<script>'),
      'raw <script> tag must not appear in the rendered HTML',
    );
    assert.ok(
      el.innerHTML.includes('&lt;script&gt;'),
      'angle brackets must be entity-escaped',
    );
  });

  it('escapes quotes in cta-href', () => {
    const el = makeElement({
      variant: 'positions',
      'cta-label': 'Go',
      'cta-href': '" onmouseover="alert(1)',
    });
    assert.ok(
      !el.innerHTML.includes('" onmouseover='),
      'unescaped quote injection must not appear in href',
    );
  });
});

describe('data-variant attribute', () => {
  it('sets data-variant on the section', () => {
    for (const variant of ['positions', 'rewards', 'loans']) {
      const el = makeElement({ variant });
      assert.ok(
        el.innerHTML.includes(`data-variant="${variant}"`),
        `section must carry data-variant="${variant}"`,
      );
    }
  });
});

describe('Icon rendering', () => {
  it('renders an SVG inside the icon wrapper', () => {
    for (const variant of ['positions', 'rewards', 'loans']) {
      const el = makeElement({ variant });
      assert.ok(
        el.innerHTML.includes('<svg'),
        `${variant} variant must include an SVG icon`,
      );
    }
  });
});
