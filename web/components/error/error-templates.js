/**
 * Error templates and classification for Ndi-Fi.
 *
 * Turns whatever a wallet, RPC node, ethers/viem or a Soroban client throws
 * into one of a fixed set of templates, each with a category, a severity and
 * a single recovery action. The user-facing copy lives in
 * `error-messages.js` (en / es / fr).
 *
 * ```js
 * import { describeError } from './error-templates.js';
 *
 * try { await vault.deposit(amount, receiver); }
 * catch (err) {
 *   const info = describeError(err, { locale: 'fr', contract: 'vault' });
 *   // → { code: 'deposit-cap-reached', category: 'contract', severity: 'warning',
 *   //     title, message, action: { kind: 'edit', label }, technical }
 * }
 * ```
 *
 * Classification order (first hit wins):
 *   1. Protocol errors — Solidity custom-error names, `require` strings and
 *      Soroban `Error(Contract, #n)` codes from docs/ERROR_CATALOGUE.md.
 *   2. Standard ERC-20 errors (allowance / balance).
 *   3. Wallet and RPC codes — EIP-1193, JSON-RPC, ethers v6, viem names.
 *   4. Text patterns for wallets and transports that only give a message.
 *   5. Generic revert → `contract-reverted`; anything else → `unknown`.
 */

import { getMessages } from './error-messages.js';

export const ERROR_CATEGORIES = Object.freeze(['contract', 'network', 'wallet', 'unknown']);

/**
 * Recovery actions. The host app decides what each does; `<ndi-error>`
 * emits the kind in its `ndi-error-action` event.
 *   retry           re-send the same request
 *   switch-network  ask the wallet to switch (or add) the supported chain
 *   connect-wallet  open the wallet picker / reconnect
 *   edit            focus the amount (or other) input so the user can fix it
 *   dismiss         acknowledge; nothing to recover
 *   none            no button (the message itself tells the user what to do)
 */
export const ACTION_KINDS = Object.freeze(['retry', 'switch-network', 'connect-wallet', 'edit', 'dismiss', 'none']);

export const SEVERITIES = Object.freeze(['error', 'warning', 'info']);

const t = (category, action, severity = 'error') => Object.freeze({ category, action, severity });

/** Every template, keyed by code. Copy for each lives in error-messages.js. */
export const TEMPLATES = Object.freeze({
  // ── Contract reverts (protocol) ──────────────────────────────────────────
  'vault-maintenance': t('contract', 'retry', 'warning'),
  'deposit-cap-reached': t('contract', 'edit', 'warning'),
  'invalid-amount': t('contract', 'edit'),
  'amount-out-of-range': t('contract', 'edit'),
  'not-authorized': t('contract', 'none'),
  'insufficient-balance': t('contract', 'edit'),
  'allowance-too-low': t('contract', 'retry'),
  'insufficient-collateral': t('contract', 'edit'),
  'collateral-locked': t('contract', 'edit'),
  'borrow-limit-exceeded': t('contract', 'edit'),
  'loan-already-open': t('contract', 'dismiss', 'warning'),
  'no-active-loan': t('contract', 'dismiss', 'info'),
  'full-repayment-required': t('contract', 'edit'),
  'insufficient-liquidity': t('contract', 'edit', 'warning'),
  'token-not-supported': t('contract', 'dismiss'),
  'not-liquidatable': t('contract', 'dismiss', 'info'),
  'transfer-failed': t('contract', 'retry'),
  'already-staked': t('contract', 'dismiss', 'info'),
  'no-active-stake': t('contract', 'dismiss', 'info'),
  'no-rewards': t('contract', 'dismiss', 'info'),
  'reward-pool-empty': t('contract', 'dismiss', 'warning'),
  'withdrawal-already-requested': t('contract', 'dismiss', 'info'),
  'withdrawal-not-requested': t('contract', 'dismiss', 'info'),
  'cooldown-active': t('contract', 'dismiss', 'info'),
  'calculation-overflow': t('contract', 'edit'),
  'contract-reverted': t('contract', 'retry'),
  'unknown-contract-error': t('contract', 'retry'),

  // ── Network ──────────────────────────────────────────────────────────────
  'wrong-network': t('network', 'switch-network', 'warning'),
  'unsupported-network': t('network', 'switch-network', 'warning'),
  'network-unavailable': t('network', 'retry'),
  'rate-limited': t('network', 'retry', 'warning'),

  // ── Wallet ───────────────────────────────────────────────────────────────
  'user-rejected': t('wallet', 'dismiss', 'info'),
  'wallet-not-found': t('wallet', 'connect-wallet'),
  'wallet-disconnected': t('wallet', 'connect-wallet', 'warning'),
  'request-pending': t('wallet', 'dismiss', 'info'),
  'insufficient-gas': t('wallet', 'retry'),

  // ── Fallback ─────────────────────────────────────────────────────────────
  unknown: t('unknown', 'retry'),
});

// ---------------------------------------------------------------------------
// Protocol error tables (keep in sync with docs/ERROR_CATALOGUE.md)
// ---------------------------------------------------------------------------

/** Solidity custom-error names (NdiFiVault, OpenZeppelin ERC-20 / ERC-4626 v5). */
const CUSTOM_ERRORS = Object.freeze({
  underMaintenance: 'vault-maintenance',
  stakingCapExceeded: 'deposit-cap-reached',
  onlyOwnerAction: 'not-authorized',
  unauthorizedCaller: 'not-authorized',
  invalidAddress: 'contract-reverted',
  invalidDepositAmount: 'invalid-amount',
  invalidWithdrawAmount: 'invalid-amount',
  invalidAmount: 'invalid-amount',
  OwnableUnauthorizedAccount: 'not-authorized',
  ERC20InsufficientAllowance: 'allowance-too-low',
  ERC20InsufficientBalance: 'insufficient-balance',
  ERC4626ExceededMaxDeposit: 'deposit-cap-reached',
  ERC4626ExceededMaxWithdraw: 'insufficient-balance',
  ERC4626ExceededMaxRedeem: 'insufficient-balance',
  EnforcedPause: 'vault-maintenance',
});

/**
 * `require(…, "reason")` strings (NdiFiLending, NdiFiStaking, NdiPoint),
 * matched case-insensitively as whole reasons inside the error text. Longer
 * strings come first so "insufficient collateral for this loan" wins over
 * "insufficient collateral".
 */
const REVERT_REASONS = Object.freeze(
  [
    ['cannot withdraw collateral locked for loan', 'collateral-locked'],
    ['insufficient collateral for this loan', 'insufficient-collateral'],
    ['existing loan must be repaid first', 'loan-already-open'],
    ['loan exceeds collateral limit', 'borrow-limit-exceeded'],
    ['amount must be greater than zero', 'invalid-amount'],
    ['must repay full debt amount', 'full-repayment-required'],
    ['insufficient vault liquidity', 'insufficient-liquidity'],
    ['not authorized liquidator', 'not-authorized'],
    ['insufficient staked balance', 'insufficient-balance'],
    ['not authorized', 'not-authorized'],
    ['loan is not liquidatable', 'not-liquidatable'],
    ['collateral transfer failed', 'transfer-failed'],
    ['debt repayment failed', 'transfer-failed'],
    ['no collateral deposited', 'insufficient-collateral'],
    ['insufficient collateral', 'insufficient-collateral'],
    ['no withdrawal requested', 'withdrawal-not-requested'],
    ['contract not initialized', 'contract-reverted'],
    ['token not supported', 'token-not-supported'],
    ['stake amount invalid', 'amount-out-of-range'],
    ['already withdrawn', 'no-active-stake'],
    ['already requested', 'withdrawal-already-requested'],
    ['transfer failed', 'transfer-failed'],
    ['no active stake', 'no-active-stake'],
    ['already staked', 'already-staked'],
    ['no active loan', 'no-active-loan'],
    ['no rewards', 'no-rewards'],
    ['too early', 'cooldown-active'],
  ].sort((a, b) => b[0].length - a[0].length),
);

/** Soroban `contracterror` codes, per contract (stellar/contracts/ndi_{lending,staking}/src/errors.rs). */
const SOROBAN_ERRORS = Object.freeze({
  lending: Object.freeze({
    1: 'invalid-amount',
    2: 'deposit-cap-reached',
    3: 'insufficient-balance',
    4: 'insufficient-liquidity',
    5: 'invalid-amount',
    6: 'invalid-amount',
    7: 'not-authorized',
    8: 'loan-already-open',
    9: 'no-active-loan',
    10: 'contract-reverted',
    11: 'contract-reverted',
    12: 'calculation-overflow',
  }),
  staking: Object.freeze({
    1: 'invalid-amount',
    2: 'amount-out-of-range',
    3: 'already-staked',
    4: 'no-active-stake',
    5: 'no-rewards',
    6: 'reward-pool-empty',
    7: 'withdrawal-already-requested',
    8: 'withdrawal-not-requested',
    9: 'cooldown-active',
    10: 'contract-reverted',
    11: 'calculation-overflow',
  }),
});

/** Which Soroban table a `contract` hint selects. */
const SOROBAN_CONTRACT_ALIASES = Object.freeze({
  lending: 'lending',
  ndi_lending: 'lending',
  ndilending: 'lending',
  vault: 'lending',
  staking: 'staking',
  ndi_staking: 'staking',
  ndistaking: 'staking',
});

// ---------------------------------------------------------------------------
// Wallet / RPC tables
// ---------------------------------------------------------------------------

/** EIP-1193 and JSON-RPC numeric codes. */
const RPC_CODES = Object.freeze({
  4001: 'user-rejected',
  4100: 'wallet-disconnected',
  4900: 'wallet-disconnected',
  4901: 'wrong-network',
  4902: 'unsupported-network',
  '-32002': 'request-pending',
  '-32005': 'rate-limited',
  429: 'rate-limited',
});

/** ethers v6 `code` strings and viem error `name`s. */
const LIBRARY_CODES = Object.freeze({
  ACTION_REJECTED: 'user-rejected',
  INSUFFICIENT_FUNDS: 'insufficient-gas',
  NETWORK_ERROR: 'network-unavailable',
  TIMEOUT: 'network-unavailable',
  SERVER_ERROR: 'network-unavailable',
  UserRejectedRequestError: 'user-rejected',
  ChainMismatchError: 'wrong-network',
  ChainNotConfiguredError: 'unsupported-network',
  SwitchChainError: 'unsupported-network',
  InsufficientFundsError: 'insufficient-gas',
  HttpRequestError: 'network-unavailable',
  TimeoutError: 'network-unavailable',
  WebSocketRequestError: 'network-unavailable',
  LimitExceededRpcError: 'rate-limited',
  ResourceUnavailableRpcError: 'request-pending',
  ConnectorNotFoundError: 'wallet-not-found',
  ProviderNotFoundError: 'wallet-not-found',
  ConnectorNotConnectedError: 'wallet-disconnected',
});

/** Message fragments, checked in order, for errors with no usable code. */
const TEXT_PATTERNS = Object.freeze([
  ['insufficient allowance', 'allowance-too-low'],
  ['transfer amount exceeds allowance', 'allowance-too-low'],
  ['transfer amount exceeds balance', 'insufficient-balance'],
  ['insufficient funds for gas', 'insufficient-gas'],
  ['insufficient funds for intrinsic transaction cost', 'insufficient-gas'],
  ['user rejected', 'user-rejected'],
  ['user denied', 'user-rejected'],
  ['rejected the request', 'user-rejected'],
  ['request already pending', 'request-pending'],
  ['already processing', 'request-pending'],
  ['does not match the target chain', 'wrong-network'],
  ['chain mismatch', 'wrong-network'],
  ['wrong network', 'wrong-network'],
  ['unrecognized chain', 'unsupported-network'],
  ['unsupported chain', 'unsupported-network'],
  ['no ethereum provider', 'wallet-not-found'],
  ['wallet not found', 'wallet-not-found'],
  ['provider not found', 'wallet-not-found'],
  ['not been authorized by the user', 'wallet-disconnected'],
  ['wallet is locked', 'wallet-disconnected'],
  ['disconnected', 'wallet-disconnected'],
  ['too many requests', 'rate-limited'],
  ['rate limit', 'rate-limited'],
  ['failed to fetch', 'network-unavailable'],
  ['fetch failed', 'network-unavailable'],
  ['network error', 'network-unavailable'],
  ['timed out', 'network-unavailable'],
  ['timeout', 'network-unavailable'],
  ['econnrefused', 'network-unavailable'],
  ['econnreset', 'network-unavailable'],
]);

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

const MAX_DEPTH = 6;

/**
 * Flatten an error and its `cause` / `error` / `data` chain into the pieces
 * the classifier needs. viem and ethers both nest the useful part.
 *
 * @param {unknown} raw
 * @returns {{ codes: Set<string>, names: Set<string>, texts: string[] }}
 */
export function collectErrorSignals(raw) {
  const codes = new Set();
  const names = new Set();
  const texts = [];
  const seen = new Set();

  const visit = (value, depth) => {
    if (value == null || depth > MAX_DEPTH) return;
    if (typeof value === 'string') {
      if (value) texts.push(value);
      return;
    }
    if (typeof value === 'number') {
      codes.add(String(value));
      return;
    }
    if (typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);

    if (value.code != null) codes.add(String(value.code));
    if (typeof value.name === 'string' && value.name !== 'Error') names.add(value.name);
    if (typeof value.errorName === 'string') names.add(value.errorName);
    if (value.status === 429) codes.add('429');
    for (const key of ['shortMessage', 'reason', 'message', 'details']) {
      if (typeof value[key] === 'string' && value[key]) texts.push(value[key]);
    }
    if (value.revert && typeof value.revert === 'object' && typeof value.revert.name === 'string') {
      names.add(value.revert.name); // ethers v6 decoded custom error
    }
    for (const key of ['cause', 'error', 'data', 'info']) {
      if (value[key] && typeof value[key] === 'object') visit(value[key], depth + 1);
    }
  };

  visit(raw, 0);
  return { codes, names, texts };
}

function sorobanCode(text, contractHint) {
  const match = /error\(\s*contract\s*,\s*#(\d+)\s*\)/i.exec(text);
  if (!match) return null;
  const table = SOROBAN_ERRORS[SOROBAN_CONTRACT_ALIASES[String(contractHint || '').toLowerCase()]];
  // Without knowing which contract failed, the number is ambiguous.
  return table?.[match[1]] ?? 'unknown-contract-error';
}

/**
 * Classify an error into a template code.
 *
 * @param {unknown} raw  anything thrown: Error, string, RPC error object…
 * @param {{ contract?: string }} [context]  `contract` disambiguates Soroban
 *   codes: 'lending' | 'staking' (or 'ndi_lending', 'vault', …).
 * @returns {keyof typeof TEMPLATES}
 */
export function classifyError(raw, { contract } = {}) {
  if (raw == null || raw === '') return 'unknown';
  const { codes, names, texts } = collectErrorSignals(raw);
  const text = texts.join(' \n ');
  const lower = text.toLowerCase();

  // 1. Protocol custom errors: decoded name, or `name()` in the message.
  for (const name of names) if (CUSTOM_ERRORS[name]) return CUSTOM_ERRORS[name];
  for (const [name, code] of Object.entries(CUSTOM_ERRORS)) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(text)) return code;
  }
  //    require() reason strings.
  for (const [reason, code] of REVERT_REASONS) {
    if (new RegExp(`(^|[^a-z])${reason}([^a-z]|$)`).test(lower)) return code;
  }
  //    Soroban contract errors.
  const soroban = sorobanCode(text, contract);
  if (soroban) return soroban;

  // 2–3. Wallet / RPC / library codes. Rejections beat everything else: a
  //      user who cancelled should never be told the network is down.
  if (codes.has('4001') || codes.has('ACTION_REJECTED') || names.has('UserRejectedRequestError')) {
    return 'user-rejected';
  }
  for (const code of codes) if (RPC_CODES[code]) return RPC_CODES[code];
  for (const code of codes) if (LIBRARY_CODES[code]) return LIBRARY_CODES[code];
  for (const name of names) if (LIBRARY_CODES[name]) return LIBRARY_CODES[name];

  // 4. Message patterns.
  for (const [pattern, code] of TEXT_PATTERNS) if (lower.includes(pattern)) return code;

  // 5. Any other revert.
  if (codes.has('CALL_EXCEPTION') || names.has('ContractFunctionRevertedError') || /\brevert/.test(lower)) {
    return 'contract-reverted';
  }
  return 'unknown';
}

const TECHNICAL_LIMIT = 600;

/** Short, single-string technical summary for the "Technical details" panel. */
export function technicalDetails(raw) {
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.slice(0, TECHNICAL_LIMIT);
  const { codes, names, texts } = collectErrorSignals(raw);
  const parts = [];
  const name = [...names][0];
  const code = [...codes][0];
  if (name) parts.push(name);
  if (code) parts.push(`code ${code}`);
  const message = texts[0];
  const head = parts.length ? `[${parts.join(', ')}] ` : '';
  return `${head}${message ?? ''}`.trim().slice(0, TECHNICAL_LIMIT);
}

/**
 * The template for a code, falling back to `unknown`.
 * @param {string} code
 */
export function getErrorTemplate(code) {
  const key = Object.prototype.hasOwnProperty.call(TEMPLATES, code) ? code : 'unknown';
  return { code: key, ...TEMPLATES[key] };
}

/**
 * Full, localised description of an error, ready to render.
 *
 * @param {unknown} raw  the thrown error, or a template code string such as
 *   'wrong-network' (a known code is used as-is, not classified).
 * @param {{ locale?: string, contract?: string, vars?: Record<string,string> }} [options]
 *   `vars` fills `{placeholders}` in the copy (e.g. `{ network: 'Ethereum' }`).
 */
export function describeError(raw, { locale = 'en', contract, vars = {} } = {}) {
  const code =
    typeof raw === 'string' && Object.prototype.hasOwnProperty.call(TEMPLATES, raw)
      ? raw
      : classifyError(raw, { contract });
  const template = getErrorTemplate(code);
  const messages = getMessages(locale);
  const copy = messages.templates[code] ?? messages.templates.unknown;
  const fill = (s) => String(s ?? '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? messages.defaults[k] ?? m));
  const label = template.action === 'none' ? '' : fill(copy.action ?? messages.actions[template.action]);

  return Object.freeze({
    code,
    category: template.category,
    severity: template.severity,
    title: fill(copy.title),
    message: fill(copy.message),
    action: Object.freeze({ kind: template.action, label }),
    technical: typeof raw === 'string' && code === raw ? '' : technicalDetails(raw),
    locale: messages.locale,
  });
}

/**
 * Options for `<ndi-toast-provider>.show()` so transient errors use the same
 * copy as `<ndi-error>`.
 */
export function toToastOptions(description) {
  return {
    type: description.severity,
    title: description.title,
    message: description.message,
    // Errors that need a decision stay until dismissed; info auto-hides.
    duration: description.severity === 'info' ? 5000 : 0,
  };
}
