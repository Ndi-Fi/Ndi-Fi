import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeEvent, installDom } from './helpers/dom.js';

// Minimal sessionStorage stub
const sessionStore = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
  setItem: (k, v) => sessionStore.set(k, v),
  removeItem: (k) => sessionStore.delete(k),
};

const document = installDom();
const { NdiBorrowRiskExplainer } = await import('../src/borrow-risk-explainer.js');

function mount(attrs = {}) {
  const node = document.createElement('ndi-borrow-risk-explainer');
  const defaults = { 'collateral-factor': '75', 'liquidation-threshold': '85' };
  for (const [k, v] of Object.entries({ ...defaults, ...attrs })) {
    node.setAttribute(k, v);
  }
  document.body.appendChild(node);
  return node;
}

function cleanup(...nodes) {
  for (const n of nodes) n.remove();
}

test('NdiBorrowRiskExplainer registers as a custom element', () => {
  assert.equal(customElements.get('ndi-borrow-risk-explainer'), NdiBorrowRiskExplainer);
});

test('renders accessible region with title and all sections', () => {
  const exp = mount();
  assert.equal(exp.getAttribute('role'), 'region');
  assert.ok(exp._titleEl.textContent.length > 0);
  assert.ok(exp._hfDesc.textContent.includes('health factor'));
  assert.ok(exp._liqDesc.textContent.includes('liquidation'));
  cleanup(exp);
});

test('example box reflects collateral-factor and liquidation-threshold', () => {
  const exp = mount({ 'collateral-factor': '60', 'liquidation-threshold': '80' });
  // $1000 collateral, 60% CF => maxBorrow = $600
  assert.ok(exp._exampleText.textContent.includes('$600'));
  // liquidation collateral value = 600 * 100 / 80 = $750
  assert.ok(exp._exampleText.textContent.includes('$750'));
  cleanup(exp);
});

test('continue button is disabled until acknowledgement is checked', () => {
  sessionStore.delete('ndi-borrow-risk-ack');
  const exp = mount();
  assert.ok(exp._continueBtn.hasAttribute('disabled'));
  assert.equal(exp._continueBtn.getAttribute('aria-disabled'), 'true');
  assert.equal(exp.isAcknowledged, false);
  cleanup(exp);
});

test('checking the acknowledgement enables the continue button', () => {
  sessionStore.delete('ndi-borrow-risk-ack');
  const exp = mount();
  exp._ackCheckbox.checked = true;
  exp._ackCheckbox.dispatchEvent(new FakeEvent('change'));
  assert.equal(exp.isAcknowledged, true);
  assert.ok(!exp._continueBtn.hasAttribute('disabled'));
  assert.ok(!exp._continueBtn.hasAttribute('aria-disabled'));
  cleanup(exp);
});

test('ndi-borrow-acknowledged event fires on first acknowledgement', () => {
  sessionStore.delete('ndi-borrow-risk-ack');
  const exp = mount();
  let fired = false;
  exp.addEventListener('ndi-borrow-acknowledged', () => { fired = true; });
  exp._ackCheckbox.checked = true;
  exp._ackCheckbox.dispatchEvent(new FakeEvent('change'));
  assert.equal(fired, true);
  cleanup(exp);
});

test('ndi-borrow-proceed fires when the continue button is clicked after acknowledgement', () => {
  sessionStore.delete('ndi-borrow-risk-ack');
  const exp = mount();
  let fired = false;
  exp.addEventListener('ndi-borrow-proceed', () => { fired = true; });

  // Clicking before ack does nothing
  exp._continueBtn.dispatchEvent(new FakeEvent('click'));
  assert.equal(fired, false);

  // Acknowledge then click
  exp._ackCheckbox.checked = true;
  exp._ackCheckbox.dispatchEvent(new FakeEvent('change'));
  exp._continueBtn.dispatchEvent(new FakeEvent('click'));
  assert.equal(fired, true);
  cleanup(exp);
});

test('returning user with sessionStorage ack skips the checkbox row', () => {
  sessionStore.set('ndi-borrow-risk-ack', '1');
  const exp = mount();
  assert.equal(exp.isAcknowledged, true);
  assert.equal(exp._ackRow.hidden, true);
  assert.ok(!exp._continueBtn.hasAttribute('disabled'));
  cleanup(exp);
  sessionStore.delete('ndi-borrow-risk-ack');
});

test('learn-more link is always present and accessible', () => {
  const exp = mount();
  assert.ok(exp._learnMoreLink.getAttribute('href').length > 0);
  assert.equal(exp._learnMoreLink.getAttribute('target'), '_blank');
  assert.ok(exp._learnMoreLink.getAttribute('rel').includes('noopener'));
  cleanup(exp);
});

test('tips list has at least 3 items with meaningful text', () => {
  const exp = mount();
  const items = exp._tipsList._children ?? [];
  assert.ok(items.length >= 3);
  for (const item of items) {
    assert.ok(item.textContent.length > 10);
  }
  cleanup(exp);
});
