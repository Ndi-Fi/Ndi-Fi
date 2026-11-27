import assert from 'node:assert/strict';
import test from 'node:test';

import { installDom } from '../../test/helpers/dom.js';

const document = installDom();
const { NdiIcon } = await import('./ndi-icon.js');
const { ICONS } = await import('./icons.js');

const SVG_NS = 'http://www.w3.org/2000/svg';

function mount(attributes = {}) {
  const node = document.createElement('ndi-icon');
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value === true ? '' : value);
  }
  document.body.appendChild(node);
  return node;
}

const svgOf = (node) => node.shadowRoot.querySelector('svg');
const pathOf = (node) => svgOf(node).querySelector('path');
const titleOf = (node) => svgOf(node).querySelector('title');

test('registers as a custom element', () => {
  assert.equal(customElements.get('ndi-icon'), NdiIcon);
});

test('builds SVG nodes in the SVG namespace', () => {
  const icon = mount({ name: 'deposit' });
  assert.equal(svgOf(icon).namespaceURI, SVG_NS);
  assert.equal(pathOf(icon).namespaceURI, SVG_NS);
  icon.remove();
});

test('renders the default md size (20px)', () => {
  const icon = mount({ name: 'deposit' });
  assert.equal(svgOf(icon).getAttribute('width'), '20');
  assert.equal(svgOf(icon).getAttribute('height'), '20');
  icon.remove();
});

test('size tokens and pixel overrides', () => {
  for (const [token, px] of Object.entries({ xs: '12', sm: '16', md: '20', lg: '24', xl: '32', '2xl': '48', 18: '18', bogus: '20' })) {
    const icon = mount({ name: 'deposit', size: token });
    assert.equal(svgOf(icon).getAttribute('width'), px, `size=${token}`);
    icon.remove();
  }
});

test('applies the shared stroke presentation attributes', () => {
  const svg = svgOf(mount({ name: 'deposit' }));
  assert.equal(svg.getAttribute('viewBox'), '0 0 24 24');
  assert.equal(svg.getAttribute('fill'), 'none');
  assert.equal(svg.getAttribute('stroke'), 'currentColor');
  assert.equal(svg.getAttribute('stroke-width'), '1.75');
  assert.equal(svg.getAttribute('stroke-linecap'), 'round');
  assert.equal(svg.getAttribute('stroke-linejoin'), 'round');
  assert.equal(svg.getAttribute('focusable'), 'false');
});

test('a known name sets its path data', () => {
  const icon = mount({ name: 'wallet' });
  assert.equal(pathOf(icon).getAttribute('d'), ICONS.wallet.path);
  icon.remove();
});

test('unknown name falls back to help and warns once', () => {
  const realWarn = console.warn;
  const warned = [];
  console.warn = (...args) => warned.push(args.join(' '));
  try {
    const first = mount({ name: 'not-an-icon' });
    assert.equal(pathOf(first).getAttribute('d'), ICONS.help.path);
    const second = mount({ name: 'not-an-icon' });
    assert.equal(warned.length, 1);
    assert.match(warned[0], /not-an-icon/);
    first.remove();
    second.remove();
  } finally {
    console.warn = realWarn;
  }
});

test('decorative by default: aria-hidden, no role, no title tooltip', () => {
  const icon = mount({ name: 'close' });
  const svg = svgOf(icon);
  assert.equal(svg.getAttribute('aria-hidden'), 'true');
  assert.equal(svg.hasAttribute('role'), false);
  assert.equal(svg.hasAttribute('aria-label'), false);
  assert.equal(titleOf(icon), null);
  icon.remove();
});

test('a label makes the icon meaningful', () => {
  const icon = mount({ name: 'warning', label: 'Warning' });
  const svg = svgOf(icon);
  assert.equal(svg.getAttribute('role'), 'img');
  assert.equal(svg.getAttribute('aria-label'), 'Warning');
  assert.equal(svg.hasAttribute('aria-hidden'), false);
  assert.equal(titleOf(icon).textContent, 'Warning');
  icon.remove();
});

test('a whitespace-only label is treated as decorative', () => {
  const icon = mount({ name: 'warning', label: '   ' });
  assert.equal(svgOf(icon).getAttribute('aria-hidden'), 'true');
  icon.remove();
});

test('decorative wins over label', () => {
  const icon = mount({ name: 'close', label: 'Close', decorative: true });
  assert.equal(svgOf(icon).getAttribute('aria-hidden'), 'true');
  assert.equal(svgOf(icon).hasAttribute('role'), false);
  icon.remove();
});

test('attribute changes re-render in place, toggling the title', () => {
  const icon = mount({ name: 'deposit' });
  icon.setAttribute('size', 'lg');
  icon.setAttribute('name', 'wallet');
  icon.setAttribute('label', 'Your wallet');
  assert.equal(svgOf(icon).getAttribute('width'), '24');
  assert.equal(pathOf(icon).getAttribute('d'), ICONS.wallet.path);
  assert.equal(titleOf(icon).textContent, 'Your wallet');
  icon.removeAttribute('label');
  assert.equal(titleOf(icon), null);
  assert.equal(svgOf(icon).getAttribute('aria-hidden'), 'true');
  icon.remove();
});

test('injects its stylesheet into the shadow root', () => {
  const icon = mount({ name: 'deposit' });
  const link = icon.shadowRoot.querySelector('link');
  assert.equal(link.getAttribute('rel'), 'stylesheet');
  assert.match(link.getAttribute('href'), /ndi-icon\.css$/);
  icon.remove();
});
