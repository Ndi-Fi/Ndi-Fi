/**
 * Tests for mobile-components.js (issue #148)
 * Node built-in test runner.
 */

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal DOM shim for Node environment
function makeSheet() {
  const attrs = new Map();
  const classes = new Set();
  let panelFocused = false;

  const panel = {
    setAttribute: () => {},
    focus: () => { panelFocused = true; },
    style: { transitionDuration: '0s' },
  };

  const backdrop = { _listeners: [], addEventListener(ev, fn) { this._listeners.push({ ev, fn }); } };
  const closeBtn = { _listeners: [], addEventListener(ev, fn) { this._listeners.push({ ev, fn }); } };

  return {
    _attrs: attrs,
    _classes: classes,
    _panelFocused: () => panelFocused,
    removeAttribute: (k) => attrs.delete(k),
    setAttribute: (k, v) => attrs.set(k, v),
    hasAttribute: (k) => attrs.has(k),
    classList: {
      add: (c) => classes.add(c),
      remove: (c) => classes.delete(c),
      contains: (c) => classes.has(c),
    },
    querySelector: (sel) => {
      if (sel === '.ndi-bottom-sheet__panel') return panel;
      if (sel === '.ndi-bottom-sheet__backdrop') return backdrop;
      if (sel === '.ndi-bottom-sheet__close') return closeBtn;
      return null;
    },
    _backdrop: backdrop,
    _closeBtn: closeBtn,
  };
}

// Shim for globals used in mobile-components.js
globalThis.requestAnimationFrame = (fn) => fn();
globalThis.getComputedStyle = () => ({ transitionDuration: '0s' });
globalThis.document = {
  _keyListeners: [],
  addEventListener: function(ev, fn) { if (ev === 'keydown') this._keyListeners.push(fn); },
  removeEventListener: function(ev, fn) {
    if (ev === 'keydown') this._keyListeners = this._keyListeners.filter(f => f !== fn);
  },
  body: { classList: { _c: new Set(), add(c) { this._c.add(c); }, remove(c) { this._c.delete(c); }, contains(c) { return this._c.has(c); } } },
};

const { openBottomSheet, closeBottomSheet, initBottomSheet } = await import('../src/mobile-components.js');

describe('openBottomSheet', () => {
  it('removes [hidden] attribute', () => {
    const sheet = makeSheet();
    sheet.setAttribute('hidden', '');
    openBottomSheet(sheet);
    assert.equal(sheet.hasAttribute('hidden'), false);
  });

  it('adds is-open class', () => {
    const sheet = makeSheet();
    openBottomSheet(sheet);
    assert.ok(sheet.classList.contains('is-open'));
  });

  it('adds ndi-scroll-lock to body', () => {
    const sheet = makeSheet();
    openBottomSheet(sheet);
    assert.ok(document.body.classList.contains('ndi-scroll-lock'));
  });
});

describe('closeBottomSheet', () => {
  it('removes is-open class', () => {
    const sheet = makeSheet();
    sheet.classList.add('is-open');
    closeBottomSheet(sheet);
    assert.equal(sheet.classList.contains('is-open'), false);
  });

  it('removes ndi-scroll-lock from body', () => {
    document.body.classList.add('ndi-scroll-lock');
    const sheet = makeSheet();
    closeBottomSheet(sheet);
    assert.equal(document.body.classList.contains('ndi-scroll-lock'), false);
  });
});

describe('initBottomSheet', () => {
  it('returns open and close functions', () => {
    const sheet = makeSheet();
    const ctrl = initBottomSheet(sheet);
    assert.equal(typeof ctrl.open, 'function');
    assert.equal(typeof ctrl.close, 'function');
  });

  it('backdrop click calls closeBottomSheet', () => {
    const sheet = makeSheet();
    sheet.classList.add('is-open');
    initBottomSheet(sheet);
    // Trigger backdrop click listener
    sheet._backdrop._listeners.find(l => l.ev === 'click')?.fn();
    assert.equal(sheet.classList.contains('is-open'), false);
  });

  it('close button click calls closeBottomSheet', () => {
    const sheet = makeSheet();
    sheet.classList.add('is-open');
    initBottomSheet(sheet);
    sheet._closeBtn._listeners.find(l => l.ev === 'click')?.fn();
    assert.equal(sheet.classList.contains('is-open'), false);
  });

  it('handles null gracefully', () => {
    const ctrl = initBottomSheet(null);
    assert.doesNotThrow(() => ctrl.open());
    assert.doesNotThrow(() => ctrl.close());
  });
});
