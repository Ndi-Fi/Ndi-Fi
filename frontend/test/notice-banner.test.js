import test from 'node:test';
import assert from 'node:assert/strict';

import { FakeEvent, installDom } from './helpers/dom.js';

// Minimal localStorage stub
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, v),
  removeItem: (k) => store.delete(k),
};

const document = installDom();
const { NdiNoticeBanner } = await import('../src/notice-banner.js');

function mount(attrs = {}) {
  const node = document.createElement('ndi-notice-banner');
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  document.body.appendChild(node);
  return node;
}

function cleanup(...nodes) {
  for (const n of nodes) n.remove();
}

test('NdiNoticeBanner registers as a custom element', () => {
  assert.equal(customElements.get('ndi-notice-banner'), NdiNoticeBanner);
});

test('renders with info severity by default', () => {
  const banner = mount({ 'notice-id': 'test-info', headline: 'System update' });
  assert.ok(banner.classList.contains('ndi-notice-banner--info'));
  assert.equal(banner.getAttribute('role'), 'status');
  assert.equal(banner.getAttribute('aria-live'), 'polite');
  assert.equal(banner._headlineEl.textContent, 'System update');
  assert.equal(banner.hidden, false);
  cleanup(banner);
});

test('warning severity uses role=alert and aria-live=assertive', () => {
  const banner = mount({ 'notice-id': 'test-warn', severity: 'warning', headline: 'Heads up' });
  assert.ok(banner.classList.contains('ndi-notice-banner--warning'));
  assert.equal(banner.getAttribute('role'), 'alert');
  assert.equal(banner.getAttribute('aria-live'), 'assertive');
  cleanup(banner);
});

test('critical severity uses role=alert and assertive live region', () => {
  const banner = mount({ 'notice-id': 'test-crit', severity: 'critical', headline: 'Critical' });
  assert.ok(banner.classList.contains('ndi-notice-banner--critical'));
  assert.equal(banner.getAttribute('role'), 'alert');
  cleanup(banner);
});

test('dismiss hides the banner and persists the decision', () => {
  const banner = mount({ 'notice-id': 'test-dismiss-1', severity: 'info', headline: 'Hi' });
  assert.equal(banner.isDismissed, false);
  assert.equal(banner.hidden, false);

  banner.dismiss();

  assert.equal(banner.isDismissed, true);
  assert.equal(banner.hidden, true);
  assert.equal(localStorage.getItem('ndi-notice-dismissed-test-dismiss-1'), '1');
  cleanup(banner);
});

test('previously dismissed notice is hidden immediately on mount', () => {
  // Pre-seed localStorage (simulates a returning visitor)
  localStorage.setItem('ndi-notice-dismissed-test-persist', '1');
  const banner = mount({ 'notice-id': 'test-persist', headline: 'Old notice' });
  assert.equal(banner.hidden, true);
  assert.equal(banner.isDismissed, true);
  cleanup(banner);
});

test('close button click dismisses the banner', () => {
  const banner = mount({ 'notice-id': 'test-btn-click', headline: 'Click me' });
  assert.equal(banner.hidden, false);

  banner._closeBtn.dispatchEvent(new FakeEvent('click'));
  assert.equal(banner.isDismissed, true);
  assert.equal(banner.hidden, true);
  cleanup(banner);
});

test('dismissible=false hides the close button', () => {
  const banner = mount({ 'notice-id': 'test-no-dismiss', headline: 'No dismiss', dismissible: 'false' });
  assert.equal(banner._closeBtn.hidden, true);
  cleanup(banner);
});

test('message attribute populates message element', () => {
  const banner = mount({
    'notice-id': 'test-msg',
    headline: 'Title',
    message: 'More detail here.',
  });
  assert.equal(banner._messageEl.textContent, 'More detail here.');
  assert.equal(banner._messageEl.hidden, false);
  cleanup(banner);
});

test('missing message leaves the message element hidden', () => {
  const banner = mount({ 'notice-id': 'test-no-msg', headline: 'Title only' });
  assert.equal(banner._messageEl.hidden, true);
  cleanup(banner);
});

test('ndi-notice-dismissed custom event fires on dismiss', () => {
  const banner = mount({ 'notice-id': 'test-event', headline: 'Event test' });
  let firedDetail = null;
  banner.addEventListener('ndi-notice-dismissed', (e) => {
    firedDetail = e.detail;
  });
  banner.dismiss();
  assert.deepEqual(firedDetail, { id: 'test-event' });
  cleanup(banner);
});
