import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExplorerLink,
  getExplorerUrl,
  openExplorerUrl,
} from '../config/explorer.js';

const ADDRESS = '0x1234567890123456789012345678901234567890';
const HASH = `0x${'a'.repeat(64)}`;

const CASES = [
  {
    chainId: 1,
    explorer: 'https://etherscan.io',
  },
  {
    chainId: 11155111,
    explorer: 'https://sepolia.etherscan.io',
  },
];

for (const { chainId, explorer } of CASES) {
  test(`builds address, transaction, and token URLs for chain ${chainId}`, () => {
    assert.equal(getExplorerUrl(chainId, 'address', ADDRESS), `${explorer}/address/${ADDRESS}`);
    assert.equal(getExplorerUrl(chainId, 'transaction', HASH), `${explorer}/tx/${HASH}`);
    assert.equal(getExplorerUrl(chainId, 'token', ADDRESS), `${explorer}/token/${ADDRESS}`);
  });
}

test('rejects unsupported chains, invalid targets, and unknown target types', () => {
  assert.throws(() => getExplorerUrl(5, 'address', ADDRESS), /Unsupported chain ID 5/);
  assert.equal(getExplorerUrl('0x1', 'address', ADDRESS), `https://etherscan.io/address/${ADDRESS}`);
  assert.throws(() => getExplorerUrl(1, 'address', 'javascript:alert(1)'), /Invalid EVM address/);
  assert.throws(() => getExplorerUrl(1, 'transaction', ADDRESS), /Invalid EVM transaction hash/);
  assert.throws(() => getExplorerUrl(1, 'block', '123'), /Unknown explorer target type: block/);
});

test('opens explorer pages in a safe new tab', () => {
  let openArguments;
  const mockWindow = {
    open(...args) {
      openArguments = args;
    },
  };

  openExplorerUrl(1, 'address', ADDRESS, mockWindow);
  assert.deepEqual(openArguments, [
    `https://etherscan.io/address/${ADDRESS}`,
    '_blank',
    'noopener,noreferrer',
  ]);
});

test('creates secure, labelled explorer links for consistent app use', () => {
  const mockDocument = {
    createElement(tagName) {
      assert.equal(tagName, 'a');
      return {};
    },
  };
  const link = createExplorerLink({
    chainId: 11155111,
    type: 'token',
    value: ADDRESS,
    label: 'View NDI token',
  }, mockDocument);

  assert.equal(link.href, `https://sepolia.etherscan.io/token/${ADDRESS}`);
  assert.equal(link.target, '_blank');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.textContent, 'View NDI token');
});

test('requires a link label and browser window when creating or opening links', () => {
  assert.throws(
    () => createExplorerLink({ chainId: 1, type: 'address', value: ADDRESS, label: '' }, { createElement() {} }),
    /An accessible explorer link label is required/,
  );
  assert.throws(() => openExplorerUrl(1, 'address', ADDRESS, {}), /A browser window with an open method is required/);
});
