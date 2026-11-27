/**
 * env-guard.js — issue #129
 *
 * Guards the frontend against accidentally connecting to mainnet in preview
 * or development environments.
 *
 * Usage: import './env-guard.js' at the top of the entry point.
 *
 * Rules:
 *   - NEXT_PUBLIC_APP_ENV === 'production'  → allow any network
 *   - NEXT_PUBLIC_APP_ENV === 'preview'     → testnet only (chain 11155111 / Stellar testnet)
 *   - anything else (dev, undefined)         → testnet only
 *
 * The guard reads injected `window.__NDI_ENV__` values or falls back to the
 * static NEXT_PUBLIC_* variables baked in at build time.
 */

/** Runtime env values injected by the build (or window.__NDI_ENV__ in tests). */
const env = (typeof window !== 'undefined' && window.__NDI_ENV__) || {
  appEnv: (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_ENV) || 'development',
  chainId:
    Number(
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_DEFAULT_CHAIN_ID) || '31337',
    ),
};

/** Chain IDs that are safe for non-production environments. */
const TESTNET_CHAIN_IDS = new Set([
  11155111, // Sepolia
  5,        // Goerli (deprecated but still used)
  31337,    // Anvil / local hardhat
  80001,    // Mumbai (Polygon testnet)
]);

const MAINNET_CHAIN_ID = 1;

/**
 * Returns true when the current environment allows connecting to mainnet.
 * @returns {boolean}
 */
export function isMainnetAllowed() {
  return env.appEnv === 'production';
}

/**
 * Throws if the requested chainId is mainnet and the environment is not
 * production. Call this before initialising a wallet connection.
 *
 * @param {number} chainId
 * @throws {Error} when mainnet is requested outside production
 */
export function assertNetworkAllowed(chainId) {
  if (Number(chainId) === MAINNET_CHAIN_ID && !isMainnetAllowed()) {
    throw new Error(
      `Mainnet (chainId 1) is not available in the "${env.appEnv}" environment. ` +
        'Set NEXT_PUBLIC_APP_ENV=production to enable mainnet connections.',
    );
  }
}

/**
 * Returns the effective chain ID for the current environment.
 * Falls back to Sepolia (11155111) when the configured chain is mainnet and
 * mainnet is not allowed.
 *
 * @returns {number}
 */
export function getEffectiveChainId() {
  const configured = Number(env.chainId);
  if (configured === MAINNET_CHAIN_ID && !isMainnetAllowed()) {
    console.warn(
      '[ndi-fi] Mainnet chain ID detected in non-production environment. ' +
        'Falling back to Sepolia (11155111).',
    );
    return 11155111;
  }
  return configured;
}

// Log active environment on load (dev-only)
if (env.appEnv !== 'production') {
  const chainId = getEffectiveChainId();
  const isTestnet = TESTNET_CHAIN_IDS.has(chainId);
  console.info(
    `[ndi-fi] Preview mode — env: ${env.appEnv}, chainId: ${chainId}${isTestnet ? ' (testnet ✓)' : ' (⚠️ unrecognised chain)'}`,
  );
}
