# Troubleshooting FAQ

Answers to common errors and questions for Ndi-Fi users, integrators, and operators. If your issue is not listed here, see [Report an issue](#report-an-issue) at the bottom.

---

## Wallet errors

### "Insufficient balance" when I have enough tokens

Your wallet may be showing your native XLM balance rather than the asset the contract requires. Confirm:

1. You are connected to the correct network (Testnet vs. Mainnet).
2. The token you hold is the correct SEP-41 contract (check `stellar/deployments/<network>.json` for the token contract IDs).
3. You have enough XLM for the transaction fee and minimum account reserve (currently 1 XLM base reserve + 0.5 XLM per trust line on the Stellar network).

### "Transaction simulation failed"

This usually means the contract call would fail on-chain. The Stellar CLI and most wallets simulate before submitting. Common causes:

- The contract is **paused** — wait for an operator announcement or check `stellar contract invoke --id <ID> -- paused`.
- You are calling a function with **insufficient allowance**. For `deposit` or `mint` on `NdiLending`, the caller must approve the contract to spend the asset first.
- The **deposit cap** has been reached. Check `max_deposit` before depositing.

### My wallet shows a pending transaction that never confirms

Stellar transactions expire. If a transaction is not included in a ledger within its time bounds (default ~30 seconds), it is dropped silently. Resubmit using the same operations. If the problem repeats, the network may be congested — try again in a few minutes.

---

## Network errors

### "Connection refused" or RPC timeout

Check the RPC endpoint in your config:

| Network | RPC URL |
|---|---|
| Testnet | `https://soroban-testnet.stellar.org` |
| Mainnet | `https://mainnet.stellar.validationcloud.io/v1/<key>` or Horizon |

If using the Stellar CLI, verify with:

```bash
stellar network ls
```

### "Entry not found" (SDK error)

This error from the RPC means the account or contract entry does not exist on the ledger, or its storage has expired (archival). If it is a contract entry, the contract may need its storage TTL extended — contact the operator.

---

## Transaction errors

### Error code `Error(Contract, #<N>)`

Each contract has its own error enum. Cross-reference the code in the table below.

#### NdiToken errors

| Code | Name | Cause | Fix |
|---|---|---|---|
| 1 | `Unauthorized` | Caller is not the owner | Use the owner identity |
| 2 | `CapExceeded` | Mint would exceed the 1B cap | No more tokens can be minted |
| 3 | `ZeroAmount` | Amount is 0 or negative | Pass a positive amount |
| 4 | `Paused` | Contract is paused | Wait for unpause |

#### NdiLending errors

| Code | Name | Cause | Fix |
|---|---|---|---|
| 1 | `Unauthorized` | Caller is not the owner or approved borrower | Check the caller identity |
| 2 | `DepositCapExceeded` | Deposit would exceed the deposit cap | Reduce the deposit amount |
| 3 | `InsufficientLiquidity` | Withdraw/redeem exceeds idle balance | Wait for the borrower to repay |
| 4 | `InvalidBorrower` | No borrower is set, or caller is not the borrower | Owner must call `set_borrower` |
| 5 | `BorrowerHasDebt` | Tried to change the borrower while debt is outstanding | Borrower must repay first |
| 6 | `ZeroAmount` | Amount is 0 or negative | Pass a positive amount |
| 7 | `Paused` | Contract is paused | Wait for unpause |

#### NdiStaking errors

| Code | Name | Cause | Fix |
|---|---|---|---|
| 1 | `Unauthorized` | Caller is not the owner | Use the owner identity |
| 2 | `BelowMinStake` | Amount is below `min_stake` | Increase the stake amount |
| 3 | `AboveMaxStake` | Amount is above `max_stake` | Decrease the stake amount |
| 4 | `NoStake` | User has no active stake | Stake first |
| 5 | `AlreadyStaked` | User already has an active stake | Unstake the existing position first |
| 6 | `CooldownNotMet` | `unstake` called before the cooldown expires | Wait until `unstake_available_at` |
| 7 | `NoUnstakeRequest` | `unstake` called without a prior `request_unstake` | Call `request_unstake` first |
| 8 | `ZeroAmount` | Amount is 0 or negative | Pass a positive amount |
| 9 | `Paused` | Contract is paused | Wait for unpause |

#### OpenZeppelin module errors

| Range | Module | Common codes |
|---|---|---|
| 100–399 | Fungible token | 101: allowance exceeded, 102: balance insufficient |
| 400–999 | Vault | 401: deposit cap, 402: zero shares |
| 1000–1499 | Pausable | 1000: already paused, 1001: not paused |
| 1500–2099 | Fixed-point math | 1500: overflow |
| 2100+ | Ownable | 2100: not owner, 2101: no pending owner |

For the full list, see the [OpenZeppelin Stellar Contracts source](https://github.com/OpenZeppelin/stellar-contracts).

### "Transaction rejected: fee too low"

Increase the fee in your wallet settings or pass `--fee <stroops>` in the Stellar CLI. During network congestion, the minimum fee rises. A fee of 1,000,000 stroops (0.1 XLM) is usually sufficient.

---

## Contract errors

### Deposits are blocked

The contract is likely paused or the deposit cap has been reached. Check both:

```bash
stellar contract invoke --id "$LENDING_ID" --network testnet -- paused
stellar contract invoke --id "$LENDING_ID" --network testnet -- max_deposit --receiver "$YOUR_ADDRESS"
```

If `max_deposit` returns `0` and the contract is not paused, the deposit cap has been reached.

### I cannot withdraw my funds

`NdiLending` can only pay out idle liquidity. If the borrower has drawn most of the funds, `max_withdraw` will return less than your full balance. The withdraw path:

1. Check `max_withdraw`:

   ```bash
   stellar contract invoke --id "$LENDING_ID" --network testnet -- max_withdraw --owner "$YOUR_ADDRESS"
   ```

2. If `max_withdraw` is 0 and the contract is not paused, the pool has no idle liquidity. Wait for the borrower to repay.

### My staking rewards are not accruing

Rewards accrue linearly from the time of the stake. If you staked very recently, the reward may be below the display threshold. Check `pending_rewards` directly:

```bash
stellar contract invoke --id "$STAKING_ID" --network testnet -- pending_rewards --user "$YOUR_ADDRESS"
```

If `pending_rewards` returns 0 for an old stake, the reward pool may be empty. The operator must call `fund_rewards` to top it up.

### `unstake` fails even though the cooldown has passed

Confirm the cooldown by reading your stake:

```bash
stellar contract invoke --id "$STAKING_ID" --network testnet -- get_stake --user "$YOUR_ADDRESS"
```

The `unstake_requested_at` field plus the `cooldown` from `config` gives the earliest unstake ledger timestamp. If the time has passed, check that the contract is not paused.

---

## Report an issue

If none of the above resolves your problem:

1. **Check open issues** at [github.com/Ndi-Fi/Ndi-Fi/issues](https://github.com/Ndi-Fi/Ndi-Fi/issues) — your issue may already be tracked.
2. **Open a new issue** using the [bug report template](../.github/ISSUE_TEMPLATE/bug-report.md). Include:
   - Network (testnet/mainnet)
   - Contract ID and function name
   - Full error message or transaction ID
   - Steps to reproduce
3. **For urgent fund-at-risk issues**, contact the core team directly on the official Discord and reference this FAQ.
