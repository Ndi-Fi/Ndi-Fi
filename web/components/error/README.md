# Error states and recovery guidance

Every error in Ndi-Fi answers two questions: **what happened** and **what do I
do next**. This folder is the single implementation of that rule:

| File | Role |
| --- | --- |
| `error-templates.js` | Template catalogue + `classifyError()` / `describeError()` — turns anything thrown into a template |
| `error-messages.js` | Human-readable copy for every template in English, Spanish and French |
| `ndi-error.js` / `.css` | `<ndi-error>`, the one error component used app-wide |

Protocol errors are taken from [`docs/ERROR_CATALOGUE.md`](../../../docs/ERROR_CATALOGUE.md);
keep the two in sync when a contract adds or renames an error.

## Quick start

```html
<script type="module" src="/web/components/error/ndi-error.js"></script>

<ndi-error id="deposit-error" contract="vault" network="Ethereum Sepolia" token="ETH" hidden></ndi-error>
```

```js
const errorBox = document.getElementById('deposit-error');

async function deposit() {
  errorBox.hidden = true;
  try {
    await vault.write.deposit([amount, account]);
  } catch (err) {
    errorBox.error = err;        // classified, translated, rendered
    errorBox.hidden = false;
  }
}

errorBox.addEventListener('ndi-error-action', ({ detail }) => {
  switch (detail.kind) {
    case 'retry':          return deposit();
    case 'switch-network': return wallet.switchChain({ id: SUPPORTED_CHAIN_ID });
    case 'connect-wallet': return openWalletPicker();
    case 'edit':           return amountInput.focus();
  }
});
```

## Templates

Each template has a **category**, a **severity** (error / warning / info) and
exactly **one recovery action**.

### Contract reverts

| Code | Raised by | Action |
| --- | --- | --- |
| `vault-maintenance` | `underMaintenance()`, `EnforcedPause` | Try again later |
| `deposit-cap-reached` | `stakingCapExceeded()`, `ERC4626ExceededMaxDeposit`, Soroban lending #2 | Edit amount |
| `invalid-amount` | `invalid*Amount()`, "Amount must be greater than zero", Soroban lending #1/#5/#6, staking #1 | Edit amount |
| `amount-out-of-range` | "Stake amount invalid", Soroban staking #2 | Edit amount |
| `not-authorized` | `onlyOwnerAction()`, `unauthorizedCaller()`, "Not authorized liquidator", Soroban lending #7 | — |
| `insufficient-balance` | `ERC20InsufficientBalance`, `ERC4626ExceededMax{Withdraw,Redeem}`, "Insufficient staked balance", Soroban lending #3 | Edit amount |
| `allowance-too-low` | `ERC20InsufficientAllowance`, "insufficient allowance" | Approve and retry |
| `insufficient-collateral` | "No collateral deposited", "Insufficient collateral[ for this loan]" | Edit amount |
| `collateral-locked` | "Cannot withdraw collateral locked for loan" | Edit amount |
| `borrow-limit-exceeded` | "Loan exceeds collateral limit" | Edit amount |
| `loan-already-open` | "Existing loan must be repaid first", Soroban lending #8 | Dismiss |
| `no-active-loan` | "No active loan", Soroban lending #9 | Dismiss |
| `full-repayment-required` | "Must repay full debt amount" | Use full amount |
| `insufficient-liquidity` | "Insufficient vault liquidity", Soroban lending #4 | Edit amount |
| `token-not-supported` | "Token not supported" | Dismiss |
| `not-liquidatable` | "Loan is not liquidatable" | Dismiss |
| `transfer-failed` | "Transfer failed", "Debt repayment failed", "Collateral transfer failed" | Try again |
| `already-staked` / `no-active-stake` / `no-rewards` | NdiFiStaking + Soroban staking #3/#4/#5 | Dismiss |
| `reward-pool-empty` | Soroban staking #6 | Dismiss |
| `withdrawal-already-requested` / `withdrawal-not-requested` / `cooldown-active` | "Already requested", "No withdrawal requested", "Too early", Soroban staking #7/#8/#9 | Dismiss |
| `calculation-overflow` | Soroban `MathOverflow` | Edit amount |
| `contract-reverted` | Any other revert (`CALL_EXCEPTION`, "execution reverted") | Try again |
| `unknown-contract-error` | Soroban code with no `contract` hint, or an unknown code | Try again |

### Network errors

| Code | Raised by | Action |
| --- | --- | --- |
| `wrong-network` | viem `ChainMismatchError`, EIP-1193 `4901` | **Switch network** |
| `unsupported-network` | EIP-1193 `4902` (chain not added to wallet) | **Add and switch** |
| `network-unavailable` | `Failed to fetch`, ethers `NETWORK_ERROR`/`TIMEOUT`, viem `HttpRequestError` | **Try again** |
| `rate-limited` | HTTP `429`, JSON-RPC `-32005` | Try again in a moment |

### Wallet errors

| Code | Raised by | Action |
| --- | --- | --- |
| `user-rejected` | EIP-1193 `4001`, ethers `ACTION_REJECTED`, viem `UserRejectedRequestError` | Dismiss (info, not an error) |
| `wallet-not-found` | No injected provider, `ProviderNotFoundError` | **Choose a wallet** |
| `wallet-disconnected` | EIP-1193 `4100`/`4900`, locked wallet | **Reconnect wallet** |
| `request-pending` | JSON-RPC `-32002` | Dismiss ("Check your wallet") |
| `insufficient-gas` | ethers `INSUFFICIENT_FUNDS`, "insufficient funds for gas" | Try again |
| `unknown` | Anything unrecognised | Try again |

### How classification works

`classifyError(err, { contract })` walks the error and its `cause` / `error` /
`data` chain (viem and ethers nest the useful part) and returns the first match:

1. Protocol errors — decoded custom-error names, `name()` in the message,
   `require` reason strings (longest first, whole words only), Soroban
   `Error(Contract, #n)` codes (needs `contract: 'lending' | 'staking'`).
2. A user rejection anywhere in the chain — so a cancel is never reported as
   a failure.
3. EIP-1193 / JSON-RPC numeric codes, ethers `code`s, viem error `name`s.
4. Message patterns for wallets that only give text.
5. Any other revert → `contract-reverted`; anything else → `unknown`.

## Translations

`locale` accepts `en`, `es`, `fr` and region tags (`fr-CA` → `fr`); anything
else falls back to English. When `locale` is omitted `<ndi-error>` uses the
page's `<html lang>`. Copy may use `{network}` and `{token}`; set them with the
`network` / `token` attributes (or `vars` in `describeError`).

To add a language, add a pack to `ERROR_MESSAGES` in `error-messages.js`. The
tests fail until every template, action and placeholder is covered.

## Writing error messages

- **Title:** what happened, ≤ 5 words, no blame (*"Request cancelled"*, not
  *"You rejected the transaction"*).
- **Message:** why, if we know, then what to do — ≤ 2 short sentences.
- Say whether funds moved when it matters (*"Nothing was sent."*).
- No jargon in the title or message: never "revert", "RPC", codes or hex. The
  raw error goes in **Technical details** for power users and support.
- One action. If there is nothing the user can do, use no button rather than
  a meaningless "OK".

## One component, three surfaces

Use the same `describeError()` output everywhere so a given failure always
reads the same way.

| Surface | When | How |
| --- | --- | --- |
| Inline `<ndi-error>` | The failed action lives on this screen (deposit form, stake card) | Place it directly above the action button |
| `<ndi-error compact>` | Field-level or table-row problems | Under the input or in the row |
| Toast | The user has navigated away, or the error is transient | `toasts.show(toToastOptions(describeError(err)))` |

Page-level blocking problems (wrong network, no wallet) use a full
`<ndi-error>` at the top of the main content; they are `warning` severity and
announced politely (`role="status"`), while real failures use `role="alert"`.

## API

### `<ndi-error>`

| Attribute | Description |
| --- | --- |
| `code` | A template code to show directly |
| `error` | A raw error message to classify (or set the `.error` property to any thrown value) |
| `contract` | `lending` / `staking` / `vault`… — disambiguates Soroban codes |
| `locale` | `en` / `es` / `fr` (default: `<html lang>`, then `en`) |
| `network`, `token` | Fill `{network}` / `{token}` in copy |
| `heading`, `message` | Override the copy |
| `action`, `action-label` | Override the action kind / button label |
| `compact` | One-line variant |
| `dismissible` | Adds a close button |

| Event | Detail |
| --- | --- |
| `ndi-error-action` | `{ kind, code, category }`. Cancelable: `preventDefault()` stops a `dismiss` from hiding the element. |
| `ndi-error-dismiss` | `{ code }` |

The `.description` property exposes the resolved, localised description.

### `error-templates.js`

| Export | Description |
| --- | --- |
| `classifyError(err, { contract })` | → template code |
| `describeError(errOrCode, { locale, contract, vars })` | → `{ code, category, severity, title, message, action: { kind, label }, technical, locale }` |
| `toToastOptions(description)` | → options for `<ndi-toast-provider>.show()` |
| `technicalDetails(err)` | → short raw summary for support |
| `TEMPLATES`, `ACTION_KINDS`, `ERROR_CATEGORIES`, `SEVERITIES` | Catalogue constants |
