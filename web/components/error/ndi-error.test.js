import assert from 'node:assert/strict';
import test from 'node:test';

import { installDom } from '../../test/helpers/dom.js';

const document = installDom();
const { NdiError } = await import('./ndi-error.js');

function mount(attributes = {}, error) {
  const node = document.createElement('ndi-error');
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value === true ? '' : value);
  }
  if (error !== undefined) node.error = error;
  document.body.appendChild(node);
  return node;
}

const part = (node, cls) => node.shadowRoot.querySelector(`.${cls}`);
const cta = (node) => part(node, 'ndi-error__cta');

test('registers as a custom element', () => {
  assert.equal(customElements.get('ndi-error'), NdiError);
});

test('renders a known template code with its copy and CTA', () => {
  const el = mount({ code: 'wrong-network', network: 'Ethereum Sepolia' });
  assert.equal(part(el, 'ndi-error__title').textContent, 'Wrong network');
  assert.match(part(el, 'ndi-error__message').textContent, /Ethereum Sepolia/);
  assert.equal(cta(el).textContent, 'Switch network');
  assert.equal(cta(el).getAttribute('data-kind'), 'switch-network');
  assert.equal(cta(el).hasAttribute('hidden'), false);
  assert.equal(part(el, 'ndi-error__details').hasAttribute('hidden'), true, 'no technical detail for a bare code');
  el.remove();
});

test('classifies a thrown error set via the .error property', () => {
  const el = mount({}, { code: 4001, message: 'User rejected the request.' });
  assert.equal(el.description.code, 'user-rejected');
  assert.equal(part(el, 'ndi-error__title').textContent, 'Request cancelled');
  assert.match(part(el, 'ndi-error__raw').textContent, /User rejected/);
  assert.equal(part(el, 'ndi-error__details').hasAttribute('hidden'), false);
  el.remove();
});

test('classifies a raw error attribute and re-renders when it changes', () => {
  const el = mount({ error: 'execution reverted: Too early' });
  assert.equal(el.description.code, 'cooldown-active');
  el.setAttribute('error', 'Failed to fetch');
  assert.equal(el.description.code, 'network-unavailable');
  assert.equal(cta(el).textContent, 'Try again');
  el.remove();
});

test('uses the contract hint for Soroban codes', () => {
  const el = mount({ error: 'Error(Contract, #6)', contract: 'staking' });
  assert.equal(el.description.code, 'reward-pool-empty');
  el.remove();
});

test('translates to the requested locale', () => {
  const el = mount({ code: 'network-unavailable', locale: 'es' });
  assert.equal(part(el, 'ndi-error__title').textContent, 'No se puede conectar a la red');
  assert.equal(cta(el).textContent, 'Reintentar');
  assert.equal(part(el, 'ndi-error__details').querySelector('summary').textContent, 'Detalles técnicos');
  assert.equal(part(el, 'ndi-error').getAttribute('lang'), 'es');
  el.setAttribute('locale', 'fr');
  assert.equal(cta(el).textContent, 'Réessayer');
  el.remove();
});

test('role is alert for errors and status for warnings/info', () => {
  const err = mount({ code: 'transfer-failed' });
  const warn = mount({ code: 'wrong-network' });
  const info = mount({ code: 'user-rejected' });
  assert.equal(part(err, 'ndi-error').getAttribute('role'), 'alert');
  assert.equal(part(warn, 'ndi-error').getAttribute('role'), 'status');
  assert.equal(part(info, 'ndi-error').getAttribute('data-severity'), 'info');
  for (const el of [err, warn, info]) el.remove();
});

test('the icon is decorative and matches severity', () => {
  const el = mount({ code: 'wrong-network' });
  const icon = part(el, 'ndi-error__icon');
  assert.equal(icon.getAttribute('aria-hidden'), 'true');
  assert.match(icon.innerHTML, /aria-hidden="true"/);
  assert.ok(icon.innerHTML.includes('M10.29 3.86'), 'warning icon path');
  el.remove();
});

test('heading, message, action and action-label overrides', () => {
  const el = mount({ code: 'unknown', heading: 'Custom', message: 'Do the thing.', action: 'connect-wallet' });
  assert.equal(part(el, 'ndi-error__title').textContent, 'Custom');
  assert.equal(part(el, 'ndi-error__message').textContent, 'Do the thing.');
  assert.equal(cta(el).textContent, 'Connect wallet');
  el.setAttribute('action-label', 'Open wallet');
  assert.equal(cta(el).textContent, 'Open wallet');
  el.setAttribute('action', 'none');
  assert.equal(cta(el).hasAttribute('hidden'), true);
  assert.equal(part(el, 'ndi-error__actions').hasAttribute('hidden'), true);
  el.remove();
});

test('CTA emits ndi-error-action with kind, code and category', () => {
  const el = mount({ code: 'network-unavailable' });
  const seen = [];
  el.addEventListener('ndi-error-action', (e) => seen.push(e.detail));
  cta(el).click();
  assert.deepEqual(seen, [{ kind: 'retry', code: 'network-unavailable', category: 'network' }]);
  assert.equal(el.hasAttribute('hidden'), false, 'retry does not hide the error');
  el.remove();
});

test('dismiss action hides the element unless prevented', () => {
  const el = mount({ code: 'user-rejected' });
  const dismissed = [];
  el.addEventListener('ndi-error-dismiss', (e) => dismissed.push(e.detail.code));
  cta(el).click();
  assert.equal(el.hasAttribute('hidden'), true);
  assert.deepEqual(dismissed, ['user-rejected']);
  el.remove();

  const kept = mount({ code: 'user-rejected' });
  kept.addEventListener('ndi-error-action', (e) => e.preventDefault());
  cta(kept).click();
  assert.equal(kept.hasAttribute('hidden'), false);
  kept.remove();
});

test('dismissible adds a labelled close button', () => {
  const el = mount({ code: 'transfer-failed', dismissible: true, locale: 'fr' });
  const close = part(el, 'ndi-error__close');
  assert.equal(close.hasAttribute('hidden'), false);
  assert.equal(close.getAttribute('aria-label'), 'Fermer');
  close.click();
  assert.equal(el.hasAttribute('hidden'), true);
  el.remove();

  const plain = mount({ code: 'transfer-failed' });
  assert.equal(part(plain, 'ndi-error__close').hasAttribute('hidden'), true);
  plain.remove();
});

test('code plus error shows the raw error as technical detail', () => {
  const el = mount({ code: 'transfer-failed', error: 'ERC20: transfer failed (0xdeadbeef)' });
  assert.equal(el.description.code, 'transfer-failed');
  assert.match(part(el, 'ndi-error__raw').textContent, /0xdeadbeef/);
  el.remove();
});

test('text is set with textContent, never parsed as HTML', () => {
  const el = mount({ code: 'unknown', heading: '<img src=x onerror=alert(1)>' });
  assert.equal(part(el, 'ndi-error__title').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(part(el, 'ndi-error__title').innerHTML, undefined);
  el.remove();
});
