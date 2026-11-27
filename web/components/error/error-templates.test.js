import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ACTION_KINDS,
  ERROR_CATEGORIES,
  SEVERITIES,
  TEMPLATES,
  classifyError,
  describeError,
  technicalDetails,
  toToastOptions,
} from './error-templates.js';
import { ERROR_LOCALES, ERROR_MESSAGES, getMessages } from './error-messages.js';

// ── Template integrity ──────────────────────────────────────────────────────

test('every template has a valid category, action and severity', () => {
  for (const [code, tpl] of Object.entries(TEMPLATES)) {
    assert.ok(ERROR_CATEGORIES.includes(tpl.category), `${code}: category`);
    assert.ok(ACTION_KINDS.includes(tpl.action), `${code}: action`);
    assert.ok(SEVERITIES.includes(tpl.severity), `${code}: severity`);
  }
});

test('templates exist for contract reverts, network errors and wallet errors', () => {
  const byCategory = (c) => Object.values(TEMPLATES).filter((t) => t.category === c).length;
  assert.ok(byCategory('contract') >= 10);
  assert.ok(byCategory('network') >= 3);
  assert.ok(byCategory('wallet') >= 4);
});

test('network templates offer switch-network or retry; wallet templates offer connect where needed', () => {
  assert.equal(TEMPLATES['wrong-network'].action, 'switch-network');
  assert.equal(TEMPLATES['unsupported-network'].action, 'switch-network');
  assert.equal(TEMPLATES['network-unavailable'].action, 'retry');
  assert.equal(TEMPLATES['rate-limited'].action, 'retry');
  assert.equal(TEMPLATES['wallet-not-found'].action, 'connect-wallet');
  assert.equal(TEMPLATES['wallet-disconnected'].action, 'connect-wallet');
});

// ── Copy & translations ─────────────────────────────────────────────────────

test('every locale translates every template and action', () => {
  const codes = Object.keys(TEMPLATES).sort();
  for (const locale of ERROR_LOCALES) {
    const pack = ERROR_MESSAGES[locale];
    assert.deepEqual(Object.keys(pack.templates).sort(), codes, `${locale}: template keys`);
    for (const [code, copy] of Object.entries(pack.templates)) {
      assert.ok(copy.title?.trim(), `${locale}.${code}.title`);
      assert.ok(copy.message?.trim(), `${locale}.${code}.message`);
    }
    for (const kind of ACTION_KINDS.filter((k) => k !== 'none')) {
      assert.ok(pack.actions[kind], `${locale}: action ${kind}`);
    }
  }
});

test('placeholders used in a translation also appear in English', () => {
  const vars = (s) => (String(s).match(/\{\w+\}/g) ?? []).sort();
  for (const locale of ERROR_LOCALES) {
    for (const [code, copy] of Object.entries(ERROR_MESSAGES[locale].templates)) {
      const english = ERROR_MESSAGES.en.templates[code];
      assert.deepEqual(vars(copy.message), vars(english.message), `${locale}.${code}`);
    }
  }
});

test('copy is human-readable: no jargon, codes or hex in titles and messages', () => {
  const banned = /\b(revert(ed)?|rpc|0x[0-9a-f]+|eip-?\d+|null|undefined|exception)\b|#\d/i;
  for (const locale of ERROR_LOCALES) {
    for (const [code, copy] of Object.entries(ERROR_MESSAGES[locale].templates)) {
      assert.doesNotMatch(copy.title, banned, `${locale}.${code}.title`);
      assert.doesNotMatch(copy.message, banned, `${locale}.${code}.message`);
      assert.ok(copy.title.length <= 40, `${locale}.${code}: title is short`);
    }
  }
});

test('getMessages handles region tags and unknown locales', () => {
  assert.equal(getMessages('fr-CA').locale, 'fr');
  assert.equal(getMessages('es_MX').locale, 'es');
  assert.equal(getMessages('de').locale, 'en');
  assert.equal(getMessages(undefined).locale, 'en');
});

// ── Classification: protocol errors ─────────────────────────────────────────

const cases = [
  // NdiFiVault custom errors — message form and decoded-name form
  ['underMaintenance()', 'vault-maintenance'],
  [{ name: 'ContractFunctionExecutionError', cause: { data: { errorName: 'stakingCapExceeded' } } }, 'deposit-cap-reached'],
  [{ code: 'CALL_EXCEPTION', revert: { name: 'invalidDepositAmount', args: [] } }, 'invalid-amount'],
  ['execution reverted: onlyOwnerAction()', 'not-authorized'],
  // OpenZeppelin ERC-20 v5
  [{ shortMessage: 'reverted', cause: { data: { errorName: 'ERC20InsufficientAllowance' } } }, 'allowance-too-low'],
  ['ERC20: transfer amount exceeds balance', 'insufficient-balance'],
  // NdiFiLending require strings
  ['execution reverted: Cannot withdraw collateral locked for loan', 'collateral-locked'],
  ['execution reverted: Insufficient collateral for this loan', 'insufficient-collateral'],
  ['execution reverted: Insufficient collateral', 'insufficient-collateral'],
  ['execution reverted: No collateral deposited', 'insufficient-collateral'],
  ['execution reverted: Loan exceeds collateral limit', 'borrow-limit-exceeded'],
  ['execution reverted: Existing loan must be repaid first', 'loan-already-open'],
  ['execution reverted: Must repay full debt amount', 'full-repayment-required'],
  ['execution reverted: Insufficient vault liquidity', 'insufficient-liquidity'],
  ['execution reverted: Loan is not liquidatable', 'not-liquidatable'],
  ['execution reverted: Not authorized liquidator', 'not-authorized'],
  ['execution reverted: Token not supported', 'token-not-supported'],
  ['execution reverted: Amount must be greater than zero', 'invalid-amount'],
  ['execution reverted: Collateral transfer failed', 'transfer-failed'],
  // NdiFiStaking require strings
  ['execution reverted: Already staked', 'already-staked'],
  ['execution reverted: No active stake', 'no-active-stake'],
  ['execution reverted: No rewards', 'no-rewards'],
  ['execution reverted: Too early', 'cooldown-active'],
  ['execution reverted: Already requested', 'withdrawal-already-requested'],
  ['execution reverted: No withdrawal requested', 'withdrawal-not-requested'],
  ['execution reverted: Stake amount invalid', 'amount-out-of-range'],
  ['execution reverted: Insufficient staked balance', 'insufficient-balance'],
  ['execution reverted: No rewards to claim', 'no-rewards'],
  ['execution reverted: Not authorized', 'not-authorized'],
  // generic reverts
  [{ code: 'CALL_EXCEPTION', message: 'missing revert data' }, 'contract-reverted'],
  ['execution reverted', 'contract-reverted'],
];

for (const [input, expected] of cases) {
  test(`classifies ${typeof input === 'string' ? JSON.stringify(input) : JSON.stringify(input).slice(0, 70)} → ${expected}`, () => {
    assert.equal(classifyError(input), expected);
  });
}

test('Soroban contract codes use the contract hint', () => {
  const err = new Error('HostError: Error(Contract, #9)');
  assert.equal(classifyError(err, { contract: 'staking' }), 'cooldown-active');
  assert.equal(classifyError(err, { contract: 'ndi_lending' }), 'no-active-loan');
  assert.equal(classifyError(err, { contract: 'lending' }), 'no-active-loan');
  assert.equal(classifyError('Error(Contract, #2)', { contract: 'vault' }), 'deposit-cap-reached');
  assert.equal(classifyError(err), 'unknown-contract-error', 'ambiguous without a hint');
  assert.equal(classifyError(err, { contract: 'staking-v9' }), 'unknown-contract-error');
  assert.equal(classifyError('Error(Contract, #99)', { contract: 'staking' }), 'unknown-contract-error');
});

test('reason matching respects word boundaries', () => {
  // "no rewards" must not match inside an unrelated longer word.
  assert.notEqual(classifyError('execution reverted: unknown rewardsx'), 'no-rewards');
  // Longest reason wins.
  assert.equal(classifyError('Insufficient collateral for this loan'), 'insufficient-collateral');
});

// ── Classification: wallet & network ────────────────────────────────────────

const walletCases = [
  [{ code: 4001, message: 'User rejected the request.' }, 'user-rejected'],
  [{ code: 'ACTION_REJECTED', message: 'user rejected action' }, 'user-rejected'],
  [{ name: 'UserRejectedRequestError', message: 'User rejected the request.' }, 'user-rejected'],
  [{ name: 'TransactionExecutionError', cause: { name: 'UserRejectedRequestError' } }, 'user-rejected'],
  [{ code: 4100, message: 'The requested account and/or method has not been authorized by the user.' }, 'wallet-disconnected'],
  [{ code: 4902, message: 'Unrecognized chain ID "0xaa36a7".' }, 'unsupported-network'],
  [{ code: -32002, message: "Request of type 'wallet_requestPermissions' already pending" }, 'request-pending'],
  [{ name: 'ChainMismatchError', message: 'The current chain of the wallet (id: 1) does not match the target chain' }, 'wrong-network'],
  [{ name: 'ProviderNotFoundError' }, 'wallet-not-found'],
  ['No Ethereum provider was found on window.ethereum', 'wallet-not-found'],
  [{ code: 'INSUFFICIENT_FUNDS', message: 'insufficient funds for intrinsic transaction cost' }, 'insufficient-gas'],
  [{ code: -32000, message: 'insufficient funds for gas * price + value' }, 'insufficient-gas'],
  [new TypeError('Failed to fetch'), 'network-unavailable'],
  [{ code: 'NETWORK_ERROR', message: 'network does not support ENS' }, 'network-unavailable'],
  [{ name: 'HttpRequestError', status: 429, message: 'HTTP request failed.' }, 'rate-limited'],
  [{ code: -32005, message: 'limit exceeded' }, 'rate-limited'],
  ['Request timed out', 'network-unavailable'],
];

for (const [input, expected] of walletCases) {
  test(`classifies wallet/network ${JSON.stringify(input).slice(0, 70)} → ${expected}`, () => {
    assert.equal(classifyError(input), expected);
  });
}

test('a rejection wrapped in a revert-looking error is still a rejection', () => {
  const err = { code: 'CALL_EXCEPTION', message: 'execution reverted', cause: { code: 4001 } };
  assert.equal(classifyError(err), 'user-rejected');
});

test('protocol errors win over transport wrappers', () => {
  const err = { name: 'ContractFunctionExecutionError', code: -32603, message: 'Internal JSON-RPC error.', cause: { reason: 'Too early' } };
  assert.equal(classifyError(err), 'cooldown-active');
});

test('unknown, empty and circular inputs are safe', () => {
  assert.equal(classifyError(undefined), 'unknown');
  assert.equal(classifyError(''), 'unknown');
  assert.equal(classifyError('something odd'), 'unknown');
  const loop = { message: 'loop' };
  loop.cause = loop;
  assert.equal(classifyError(loop), 'unknown');
});

// ── describeError / helpers ─────────────────────────────────────────────────

test('describeError returns localised, ready-to-render copy', () => {
  const en = describeError({ code: 4001, message: 'User rejected the request.' });
  assert.equal(en.code, 'user-rejected');
  assert.equal(en.category, 'wallet');
  assert.equal(en.severity, 'info');
  assert.equal(en.title, 'Request cancelled');
  assert.deepEqual({ ...en.action }, { kind: 'dismiss', label: 'Dismiss' });
  assert.match(en.technical, /code 4001/);

  const fr = describeError('execution reverted: Too early', { locale: 'fr' });
  assert.equal(fr.title, 'Délai d’attente en cours');
  assert.equal(fr.locale, 'fr');

  const es = describeError({ code: 4902 }, { locale: 'es', vars: { network: 'Ethereum Sepolia' } });
  assert.equal(es.action.kind, 'switch-network');
  assert.equal(es.action.label, 'Añadir y cambiar');
  assert.match(es.message, /Ethereum Sepolia/);
});

test('describeError fills defaults for placeholders and uses known codes directly', () => {
  const d = describeError('wrong-network');
  assert.equal(d.code, 'wrong-network');
  assert.match(d.message, /the supported network/);
  assert.equal(d.technical, '', 'a template code is not shown as technical detail');
  const gas = describeError('insufficient-gas', { vars: { token: 'XLM' } });
  assert.match(gas.message, /XLM/);
});

test('describeError hides the label for action "none"', () => {
  const d = describeError('onlyOwnerAction()');
  assert.equal(d.action.kind, 'none');
  assert.equal(d.action.label, '');
});

test('technicalDetails is short and includes name and code', () => {
  assert.equal(technicalDetails('x'.repeat(2000)).length, 600);
  assert.equal(technicalDetails({ name: 'HttpRequestError', code: 503, message: 'down' }), '[HttpRequestError, code 503] down');
  assert.equal(technicalDetails(null), '');
});

test('toToastOptions maps severity and persistence', () => {
  const sticky = toToastOptions(describeError('wrong-network'));
  assert.equal(sticky.type, 'warning');
  assert.equal(sticky.duration, 0);
  const brief = toToastOptions(describeError({ code: 4001 }));
  assert.equal(brief.type, 'info');
  assert.ok(brief.duration > 0);
});
