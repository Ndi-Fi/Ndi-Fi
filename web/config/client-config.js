/**
 * @typedef {object} NetworkConfig
 * @property {number} chainId
 * @property {string} rpcUrl
 * @property {Readonly<{ ndiPoint: string, ndiFiVault: string, ndiFiLending: string, ndiStaking: string }>} addresses
 */

/**
 * @typedef {object} ClientConfig
 * @property {{ mainnet: NetworkConfig, testnet: NetworkConfig }} networks
 */

const PUBLIC_ENV = Object.freeze({
  mainnet: Object.freeze({
    chainId: 'NEXT_PUBLIC_MAINNET_CHAIN_ID',
    rpcUrl: 'NEXT_PUBLIC_MAINNET_RPC_URL',
    addresses: Object.freeze({
      ndiPoint: 'NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS',
      ndiFiVault: 'NEXT_PUBLIC_MAINNET_NDI_FI_VAULT_ADDRESS',
      ndiFiLending: 'NEXT_PUBLIC_MAINNET_NDI_FI_LENDING_ADDRESS',
      ndiStaking: 'NEXT_PUBLIC_MAINNET_NDI_STAKING_ADDRESS',
    }),
  }),
  testnet: Object.freeze({
    chainId: 'NEXT_PUBLIC_TESTNET_CHAIN_ID',
    rpcUrl: 'NEXT_PUBLIC_TESTNET_RPC_URL',
    addresses: Object.freeze({
      ndiPoint: 'NEXT_PUBLIC_TESTNET_NDI_POINT_ADDRESS',
      ndiFiVault: 'NEXT_PUBLIC_TESTNET_NDI_FI_VAULT_ADDRESS',
      ndiFiLending: 'NEXT_PUBLIC_TESTNET_NDI_FI_LENDING_ADDRESS',
      ndiStaking: 'NEXT_PUBLIC_TESTNET_NDI_STAKING_ADDRESS',
    }),
  }),
});

function requiredValue(env, key) {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function parseChainId(env, key) {
  const value = requiredValue(env, key);
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${key} must be a positive integer`);
  }
  return Number(value);
}

function parseRpcUrl(env, key) {
  const value = requiredValue(env, key);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid HTTPS URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`${key} must use HTTPS`);
  }
  if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error(`${key} must use HTTPS outside localhost`);
  }
  return url.href;
}

function parseAddress(env, key) {
  const value = requiredValue(env, key);
  if (!/^0x[a-fA-F0-9]{40}$/.test(value) || /^0x0{40}$/i.test(value)) {
    throw new Error(`${key} must be a non-zero 20-byte EVM address`);
  }
  return value;
}

/**
 * Load and validate the public frontend configuration.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {Readonly<ClientConfig>}
 */
export function loadClientConfig(env) {
  if (!env || typeof env !== 'object') {
    throw new TypeError('An environment-variable object is required');
  }

  const networks = {};
  const chainIds = new Set();
  for (const [name, keys] of Object.entries(PUBLIC_ENV)) {
    const chainId = parseChainId(env, keys.chainId);
    if (chainIds.has(chainId)) {
      throw new Error(`Chain ID ${chainId} is configured more than once`);
    }
    chainIds.add(chainId);

    const addresses = Object.fromEntries(
      Object.entries(keys.addresses).map(([contract, envKey]) => [contract, parseAddress(env, envKey)]),
    );

    networks[name] = Object.freeze({
      chainId,
      rpcUrl: parseRpcUrl(env, keys.rpcUrl),
      addresses: Object.freeze(addresses),
    });
  }

  return Object.freeze({ networks: Object.freeze(networks) });
}

/**
 * Read explicitly referenced public variables so Next.js can inline them in
 * client bundles. Only NEXT_PUBLIC values belong in this module.
 */
export function readPublicEnvironment() {
  if (typeof process === 'undefined') return {};

  return {
    NEXT_PUBLIC_MAINNET_CHAIN_ID: process.env.NEXT_PUBLIC_MAINNET_CHAIN_ID,
    NEXT_PUBLIC_MAINNET_RPC_URL: process.env.NEXT_PUBLIC_MAINNET_RPC_URL,
    NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS: process.env.NEXT_PUBLIC_MAINNET_NDI_POINT_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_FI_VAULT_ADDRESS: process.env.NEXT_PUBLIC_MAINNET_NDI_FI_VAULT_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_FI_LENDING_ADDRESS: process.env.NEXT_PUBLIC_MAINNET_NDI_FI_LENDING_ADDRESS,
    NEXT_PUBLIC_MAINNET_NDI_STAKING_ADDRESS: process.env.NEXT_PUBLIC_MAINNET_NDI_STAKING_ADDRESS,
    NEXT_PUBLIC_TESTNET_CHAIN_ID: process.env.NEXT_PUBLIC_TESTNET_CHAIN_ID,
    NEXT_PUBLIC_TESTNET_RPC_URL: process.env.NEXT_PUBLIC_TESTNET_RPC_URL,
    NEXT_PUBLIC_TESTNET_NDI_POINT_ADDRESS: process.env.NEXT_PUBLIC_TESTNET_NDI_POINT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_FI_VAULT_ADDRESS: process.env.NEXT_PUBLIC_TESTNET_NDI_FI_VAULT_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_FI_LENDING_ADDRESS: process.env.NEXT_PUBLIC_TESTNET_NDI_FI_LENDING_ADDRESS,
    NEXT_PUBLIC_TESTNET_NDI_STAKING_ADDRESS: process.env.NEXT_PUBLIC_TESTNET_NDI_STAKING_ADDRESS,
  };
}
