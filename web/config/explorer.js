import { normalizeChainId } from './contract-registry.js';

const EXPLORERS = Object.freeze({
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
});

function getExplorerBase(chainId) {
  const id = normalizeChainId(chainId);
  const base = EXPLORERS[id];
  if (!base) {
    throw new Error(
      `Unsupported chain ID ${id}. Supported chain IDs: ${Object.keys(EXPLORERS).join(', ')}.`,
    );
  }
  return base;
}

function validateTarget(type, value) {
  if (typeof value !== 'string') {
    throw new TypeError(`Explorer ${type} must be a string`);
  }
  if (type === 'address' || type === 'token') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error(`Invalid EVM ${type}: ${value}`);
    }
    return value;
  }
  if (type === 'transaction') {
    if (!/^0x[a-fA-F0-9]{64}$/.test(value)) {
      throw new Error(`Invalid EVM transaction hash: ${value}`);
    }
    return value;
  }
  throw new Error(`Unknown explorer target type: ${String(type)}`);
}

export function getExplorerUrl(chainId, type, value) {
  const base = getExplorerBase(chainId);
  const target = validateTarget(type, value);
  const path = type === 'transaction'
    ? `tx/${target}`
    : type === 'token'
      ? `token/${target}`
      : `address/${target}`;
  return `${base}/${path}`;
}

export function openExplorerUrl(chainId, type, value, windowObject = globalThis.window) {
  if (!windowObject || typeof windowObject.open !== 'function') {
    throw new TypeError('A browser window with an open method is required');
  }
  const url = getExplorerUrl(chainId, type, value);
  windowObject.open(url, '_blank', 'noopener,noreferrer');
}

export function createExplorerLink({ chainId, type, value, label }, documentObject = globalThis.document) {
  if (!documentObject || typeof documentObject.createElement !== 'function') {
    throw new TypeError('A document with a createElement method is required');
  }
  if (typeof label !== 'string' || !label.trim()) {
    throw new TypeError('An accessible explorer link label is required');
  }

  const link = documentObject.createElement('a');
  link.href = getExplorerUrl(chainId, type, value);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label.trim();
  return link;
}
