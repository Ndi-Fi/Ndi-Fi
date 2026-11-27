import assert from 'node:assert/strict';
import test from 'node:test';

import { createFooterConfig, resolveFooterHref, DEFAULT_BASE_URL } from './footer-config.js';

const REQUIRED_GROUPS = ['docs', 'security', 'governance', 'support'];

test('default config includes all four accessible link groups', () => {
  const config = createFooterConfig();

  assert.deepEqual(
    config.groups.map((group) => group.id),
    REQUIRED_GROUPS,
  );
  config.groups.forEach((group) => {
    assert.ok(group.title, 'every group has a heading');
    assert.ok(group.links.length > 0, 'every group has at least one link');
    group.links.forEach((link) => {
      assert.ok(link.label, 'every link has a label');
      assert.ok(link.href, 'every link has a destination');
    });
  });
  assert.match(config.disclosure.body, /risk/i);
  assert.ok(config.disclosure.title);
});

test('overrides are merged without dropping the other groups', () => {
  const config = createFooterConfig({
    network: 'testnet',
    version: 'unreleased',
    brand: { label: 'Ndi-Fi app' },
    groups: [{ id: 'docs', title: 'Guides', links: [{ label: 'Docs', href: 'docs/' }] }],
  });

  assert.equal(config.network, 'testnet');
  assert.equal(config.version, 'unreleased');
  assert.equal(config.brand.label, 'Ndi-Fi app');
  assert.equal(config.brand.href, 'README.md');
  assert.deepEqual(
    config.groups.map((group) => group.id),
    ['docs'],
  );
  assert.equal(config.groups[0].links[0].label, 'Docs');
});

test('malformed overrides fall back to defaults', () => {
  const config = createFooterConfig({
    label: '   ',
    groups: 'not-an-array',
    brand: null,
    disclosure: { body: '' },
  });

  assert.equal(config.label, 'Ndi-Fi site footer');
  assert.equal(config.brand.label, 'Ndi-Fi');
  assert.deepEqual(
    config.groups.map((group) => group.id),
    REQUIRED_GROUPS,
  );
  assert.match(config.disclosure.body, /risk/i);
});

test('links without a label or destination are dropped', () => {
  const config = createFooterConfig({
    groups: [
      {
        id: 'support',
        title: 'Support',
        links: [
          { label: 'Help', href: 'SUPPORT.md' },
          { label: 'No destination', href: '' },
          { href: 'DEVELOPMENT.md' },
        ],
      },
    ],
  });

  assert.equal(config.groups.length, 1);
  assert.deepEqual(config.groups[0].links, [{ label: 'Help', href: 'SUPPORT.md' }]);
});

test('resolveFooterHref resolves repository paths against the default base', () => {
  assert.equal(
    resolveFooterHref('SECURITY.md'),
    `${DEFAULT_BASE_URL}SECURITY.md`,
  );
  assert.equal(
    resolveFooterHref('SECURITY.md#reporting-a-vulnerability'),
    `${DEFAULT_BASE_URL}SECURITY.md#reporting-a-vulnerability`,
  );
  assert.equal(resolveFooterHref('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(resolveFooterHref(''), '');
});

test('resolveFooterHref supports page-relative bases', () => {
  const base = resolveFooterHref('../', '../', 'http://localhost:8000/web/index.html');
  assert.equal(base, 'http://localhost:8000/');
  assert.equal(
    resolveFooterHref('SUPPORT.md', '../', 'http://localhost:8000/web/index.html'),
    'http://localhost:8000/SUPPORT.md',
  );
});
