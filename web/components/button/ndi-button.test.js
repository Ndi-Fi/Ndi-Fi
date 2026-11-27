import assert from 'node:assert/strict';
import test from 'node:test';

import { FakeEvent, installDom } from '../../test/helpers/dom.js';

const document = installDom();
const { NdiButton } = await import('./ndi-button.js');

function mount(attributes = {}, text = 'Save') {
  const node = document.createElement('ndi-button');
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) node.setAttribute(name, '');
    else node.setAttribute(name, value);
  }
  node.textContent = text;
  document.body.appendChild(node);
  return node;
}

function buttonEl(node) {
  return node._button;
}

test('registers as a custom element and renders a real <button>', () => {
  assert.equal(customElements.get('ndi-button'), NdiButton);
  const btn = mount();
  const inner = buttonEl(btn);
  assert.equal(inner.tagName, 'BUTTON');
  assert.equal(inner.getAttribute('type'), 'button');
  assert.equal(btn.textContent, 'Save'); // light-DOM slotted label
  btn.remove();
});

test('variants map to the matching class', () => {
  for (const variant of ['primary', 'secondary', 'ghost', 'danger']) {
    const btn = mount({ variant });
    assert.ok(buttonEl(btn).classList.contains(`ndi-btn--${variant}`), `${variant} class applied`);
    btn.remove();
  }
  // Unknown variant falls back to primary.
  const fallback = mount({ variant: 'neon' });
  assert.ok(buttonEl(fallback).classList.contains('ndi-btn--primary'));
  fallback.remove();
});

test('sizes map to the matching class', () => {
  for (const size of ['sm', 'md', 'lg']) {
    const btn = mount({ size });
    assert.ok(buttonEl(btn).classList.contains(`ndi-btn--${size}`), `${size} class applied`);
    btn.remove();
  }
  assert.ok(buttonEl(mount({ size: 'xl' })).classList.contains('ndi-btn--md'), 'unknown size -> md');
});

test('full-width adds the modifier class to host and button', () => {
  const btn = mount({ 'full-width': true });
  assert.ok(buttonEl(btn).classList.contains('ndi-btn--full'));
  assert.ok(btn.classList.contains('ndi-button--full-width'));
  btn.remove();
});

test('type attribute is reflected to the inner button', () => {
  const btn = mount({ type: 'submit' });
  assert.equal(buttonEl(btn).getAttribute('type'), 'submit');
  btn.remove();
});

test('disabled sets native disabled and blocks clicks', () => {
  const btn = mount({ disabled: true });
  const inner = buttonEl(btn);
  assert.equal(inner.hasAttribute('disabled'), true);
  assert.equal(btn.isDisabled, true);

  let clicked = false;
  btn.addEventListener('click', () => {
    clicked = true;
  });
  inner.dispatchEvent(new FakeEvent('click'));
  assert.equal(clicked, false, 'click must not escape a disabled button');
  btn.remove();
});

test('loading shows a spinner, sets aria-busy, disables and blocks clicks', () => {
  const btn = mount({ loading: true });
  const inner = buttonEl(btn);

  assert.equal(btn.isLoading, true);
  assert.equal(btn.isDisabled, true);
  assert.equal(inner.hasAttribute('disabled'), true, 'loading disables the button');
  assert.equal(inner.getAttribute('aria-busy'), 'true', 'aria-busy is set while loading');
  assert.equal(inner.classList.contains('is-loading'), true);
  assert.equal(btn._spinner.hidden, false, 'spinner is visible while loading');

  let clicked = false;
  btn.addEventListener('click', () => {
    clicked = true;
  });
  inner.dispatchEvent(new FakeEvent('click'));
  assert.equal(clicked, false, 'click must not escape a loading button');
  btn.remove();
});

test('clearing loading removes aria-busy and re-enables the button', () => {
  const btn = mount({ loading: true });
  btn.removeAttribute('loading');
  const inner = buttonEl(btn);

  assert.equal(inner.hasAttribute('aria-busy'), false);
  assert.equal(inner.hasAttribute('disabled'), false);
  assert.equal(btn._spinner.hidden, true);

  let clicked = false;
  btn.addEventListener('click', () => {
    clicked = true;
  });
  inner.dispatchEvent(new FakeEvent('click'));
  assert.equal(clicked, true, 'click fires again once loading clears');
  btn.remove();
});

test('an enabled button forwards clicks to host listeners', () => {
  const btn = mount();
  let clicked = false;
  btn.addEventListener('click', () => {
    clicked = true;
  });
  buttonEl(btn).dispatchEvent(new FakeEvent('click'));
  assert.equal(clicked, true);
  btn.remove();
});

test('focus delegates to the inner button', () => {
  const btn = mount();
  btn.focus();
  assert.equal(document.activeElement, buttonEl(btn), 'focus lands on the inner button');
  btn.remove();
});

test('leading and trailing icon slots exist in the shadow tree', () => {
  const btn = mount();
  const root = btn.shadowRoot;
  assert.equal(root.querySelector('slot[name="leading"]').getAttribute('name'), 'leading');
  assert.equal(root.querySelector('slot[name="trailing"]').getAttribute('name'), 'trailing');
  assert.ok(root.querySelector('slot'), 'default (label) slot exists');
  btn.remove();
});

test('click() is a no-op while disabled and works when enabled', () => {
  const btn = mount({ disabled: true });
  let fired = 0;
  btn.addEventListener('click', () => {
    fired += 1;
  });
  btn.click();
  assert.equal(fired, 0, 'programmatic click is suppressed while disabled');

  btn.removeAttribute('disabled');
  btn.click();
  assert.equal(fired, 1, 'programmatic click fires when enabled');
  btn.remove();
});
