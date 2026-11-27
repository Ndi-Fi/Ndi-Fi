# Ndi-Fi: Gas & Cost Analysis

This document analyses the on-chain transaction costs for the Ndi-Fi protocol's
Ethereum/Solidity contracts. It covers the gas cost of every user-facing
operation, identifies the most expensive code paths, and explains the design
choices that affect cost. It also includes a comparison with the Stellar/Soroban
version's fee model.

---

## 1. How to read this document

Gas figures in this document are **estimates** based on static analysis of the
contract code and standard ERC-20/ERC-4626 operation costs. Actual on-chain gas
depends on:

- The state of the EVM at execution time (cold vs. warm storage slots).
- The number of supported collateral tokens in `NdiFiLending` (unbounded loops).
- The calldata size for batch operations.
- The prevailing gas price (`baseFee + priorityFee`) at the time of the transaction.

To translate gas into dollar cost, multiply by the gas price in ETH and the
ETH/USD price at the time:

```
USD cost = gas_units × gas_price_gwei × 1e-9 × ETH_price_USD
```

At a gas price of 10 gwei and ETH at $3,000:
- 100,000 gas → ~$3.00
- 200,000 gas → ~$6.00
- 500,000 gas → ~$15.00

---

## 2. NdiPoint (NDI token)

| Function | Approximate gas | Notes |
|---|---|---|
| `transfer(to, amount)` | ~50,000 | Standard ERC-20. Cold recipient slot adds ~20,000. |
| `approve(spender, amount)` | ~46,000 | Standard ERC-20 allowance write. |
| `transferFrom(from, to, amount)` | ~65,000 | Reads and writes three storage slots. |
| `mint(to, amount)` | ~65,000 | One storage write (`balanceOf`), supply update, `MINTER_ROLE` check. |
| `burn(amount)` | ~45,000 | Decrements balance and total supply. |
| `distributeRewards(recipients, amounts, reason)` | ~65,000 + 50,000 × n | Loops over `n` recipients; each mint costs ~50,000 gas. |
| `pause()` / `unpause()` | ~30,000 | Single boolean storage write plus role check. |

**Cost driver:** `distributeRewards` with a large recipient list. At 50,000 gas
per recipient, distributing to 100 addresses costs ~5,000,000 gas (~$150 at
10 gwei, $3,000 ETH). Batch size should be kept under ~50 recipients per
transaction to stay within typical block gas limits.

---

## 3. NdiFiVault (ERC-4626)

| Function | Approximate gas | Notes |
|---|---|---|
| `deposit(amount, receiver)` | ~100,000 | ERC-4626 `deposit` + `stakingCap` check + ERC-20 `transferFrom`. |
| `mint(shares, receiver)` | ~100,000 | ERC-4626 `mint` + share minting. |
| `withdraw(assets, receiver, owner)` | ~90,000 | ERC-4626 `withdraw` + share burn + ERC-20 `transfer`. |
| `redeem(shares, receiver, owner)` | ~90,000 | ERC-4626 `redeem` + share burn + ERC-20 `transfer`. |
| `withdrawForLoan(to, amount)` | ~60,000 | Single ERC-20 `transfer` + balance check + modifier. |
| `setStakingCap(newCap)` | ~30,000 | Single storage write. |
| `setAuthorizedLendingContract(addr)` | ~30,000 | Single storage write + event. |
| `pauseVault()` / `unpauseVault()` | ~25,000 | Single boolean write. |
| `emergencyWithdraw(to, owner)` | ~65,000 | Balance read + ERC-20 `transfer`. |

**Cost driver:** The `deposit` and `withdraw` paths each touch multiple storage
slots (balances, total supply, allowances) and trigger ERC-20 calls. The first
deposit to a new receiver address adds ~20,000 gas for slot initialisation.

**Missing ERC-4626 overrides (cost implication):**
`maxDeposit`, `maxMint`, `maxWithdraw`, and `maxRedeem` are not overridden, so
callers who rely on them to check limits before transacting may overshoot the
`stakingCap` and waste gas on a failed `deposit` call. The Soroban version
overrides these to return 0 when blocked.

---

## 4. NdiFiStaking

| Function | Approximate gas | Notes |
|---|---|---|
| `stake(amount)` | ~175,000 | ERC-20 `transferFrom` + `forceApprove` + vault `deposit` (ERC-4626) + storage write. |
| `claimRewards()` | ~70,000 | `pendingRewards` read + ERC-20 `transfer` + storage update. |
| `requestWithdrawal()` | ~50,000 | Storage write for `WithdrawalRequest`. |
| `executeWithdrawal()` | ~180,000 | Vault `redeem` (ERC-4626) + ERC-20 reward `transfer` + storage updates. |
| `skimProfits(to)` | ~100,000 | Vault `convertToAssets` + vault `withdraw` (ERC-4626). |

**Cost driver:** `stake` triggers an ERC-4626 `deposit`, which is itself a
multi-step operation. `executeWithdrawal` redeems *all* shares held by the
staking contract (`vault.balanceOf(address(this))`), so its cost is independent
of individual stake size — but the bug that causes this also makes the first
withdrawer's transaction more expensive than expected because it processes every
staker's shares.

**21-day wait cost:**
The two-step withdrawal requires two transactions: `requestWithdrawal` (~50,000
gas) and `executeWithdrawal` (~180,000 gas). Total: ~230,000 gas per withdrawal
cycle, compared to ~90,000 for a single-step ERC-4626 `redeem`.

---

## 5. NdiFiLending

This is the most gas-intensive contract because of its unbounded loops over
supported collateral tokens.

### Fixed-cost operations

| Function | Approximate gas | Notes |
|---|---|---|
| `initialize(...)` | ~80,000 | Four storage writes + event. |
| `addCollateralToken(addr, feed)` | ~65,000 | Storage write + array push. |
| `removeCollateralToken(addr)` | ~40,000 + swap | Finds and swaps in the array. |
| `depositCollateral(token, amount)` | ~90,000 | ERC-20 `transferFrom` + two storage writes. |
| `withdrawCollateral(token, amount)` | ~80,000 | Storage reads/writes + ERC-20 `transfer`. |

### Variable-cost operations (depend on `n` = number of supported collateral tokens)

| Function | Gas formula | Cost at n=1 | Cost at n=5 | Cost at n=10 |
|---|---|---|---|---|
| `getCollateralValue(user)` | ~30,000 + 25,000×n | ~55,000 | ~155,000 | ~280,000 |
| `takeLoan(amount)` | ~200,000 + 60,000×n | ~260,000 | ~500,000 | ~800,000 |
| `repayLoan(amount)` | ~100,000 + 15,000×n | ~115,000 | ~175,000 | ~250,000 |
| `liquidateLoan(borrower)` | ~220,000 + 80,000×n² | ~300,000 | ~2,220,000 | ~8,220,000 |

> **Note:** `liquidateLoan` calls `_sortCollateral`, which uses an insertion
> sort (O(n²) comparisons) and reads Chainlink price feeds for every token in
> every comparison. At n=10 this approaches the per-transaction gas limit on
> mainnet.

### Cost breakdown of `takeLoan`

`takeLoan` is the highest-traffic function and deserves a step-by-step breakdown:

1. `getCollateralValue(msg.sender)` — iterates all n tokens, calls `_getLatestPrice` (Chainlink) per token: **~25,000 gas × n**.
2. Collateral lock loop — iterates all n tokens again, calling `_getLatestPrice` per token: **~35,000 gas × n**.
3. `vault.withdrawForLoan(msg.sender, amount)` — ERC-20 transfer from vault: **~60,000 gas**.
4. Loan storage write: **~50,000 gas**.
5. Event emission: **~5,000 gas**.

**Practical limit:** With the current design, supporting more than 5 collateral
types makes `takeLoan` prohibitively expensive for average users. At 15 collateral
types and a 50 gwei gas price, a single `takeLoan` could cost over $50 USD.

### Chainlink oracle call cost

Each `_getLatestPrice` call makes an external `latestRoundData()` call to a
Chainlink aggregator. The first call to a cold Chainlink contract address in a
transaction costs ~20,000 gas; subsequent calls to the same address are ~5,000
gas (warm). Because the same price feed can be called multiple times in one
`takeLoan` transaction (once in `getCollateralValue`, once in the lock loop),
warming the feed after the first call partially mitigates repeated oracle costs.

---

## 6. Gas optimisation opportunities

The following changes would meaningfully reduce gas costs without changing
protocol semantics. They are recorded here as potential future work.

| Opportunity | Affected contracts | Estimated saving |
|---|---|---|
| Cache Chainlink prices within a single transaction (`takeLoan`, `liquidateLoan`) | `NdiFiLending` | ~15,000–20,000 gas per repeated feed call |
| Use `uint96` instead of `uint256` for timestamps and fee rates (pack into one slot) | `NdiFiLending`, `NdiFiStaking` | ~5,000–10,000 gas per packed slot |
| Replace insertion sort with a priority queue for collateral selection | `NdiFiLending` | O(n²) → O(n log n); significant at n > 5 |
| Use custom errors instead of `require` strings (already done in `NdiFiVault`) | `NdiFiLending`, `NdiFiStaking` | ~200–400 gas per revert path |
| Emit events only when values change (remove no-op `amountSeized += 0`) | `NdiFiLending` | Minor; removes dead code |
| Override `maxDeposit`/`maxMint` in vault to avoid wasted gas on failed deposits | `NdiFiVault` | Saves full transaction cost on failed calls |

---

## 7. Stellar/Soroban cost comparison

The Stellar fee model is fundamentally different from Ethereum's gas model.

| Cost component | Ethereum | Stellar/Soroban |
|---|---|---|
| Fee unit | Gas (EVM opcode-level) | Operations (network-level) + resource fees |
| Base fee | `baseFee` (EIP-1559, fluctuates) | 100 stroops (~$0.00001) base + resource fees |
| Resource fees | n/a | Charged for CPU instructions, read/write bytes, and events |
| Storage rent | None (paid once at write) | Persistent entries charge rent; TTL must be extended |
| Oracle call cost | ~20,000 gas per Chainlink call | Reflector (SEP-40) cross-contract call: ~100,000 instructions |

### Soroban contract cost estimates

| Operation | Approx. resource fee (stroops) | USD equivalent (at $0.10/XLM) |
|---|---|---|
| `ndi_token::transfer` | ~500,000 | ~$0.0001 |
| `ndi_token::mint` | ~600,000 | ~$0.0001 |
| `ndi_lending::deposit` | ~1,500,000 | ~$0.00015 |
| `ndi_lending::borrow` | ~2,000,000 | ~$0.0002 |
| `ndi_lending::repay` | ~2,000,000 | ~$0.0002 |
| `ndi_staking::stake` | ~1,800,000 | ~$0.00018 |
| `ndi_staking::unstake` | ~2,500,000 | ~$0.00025 |
| TTL extension (instance) | ~500,000 | ~$0.00005 |

> These are illustrative estimates. Actual fees depend on the Stellar fee market
> and the size of contract state at execution time. Use
> `stellar contract invoke --sim-only` to get a simulation estimate before
> broadcasting.

**Key difference:** Stellar fees are several orders of magnitude lower than
Ethereum mainnet fees, and they scale with actual resource usage (CPU +
memory + I/O) rather than opcode-level gas. The Soroban contracts fix the
O(n²) loop problem from `NdiFiLending` (the lending contract is not ported
in the MVP) and have no unbounded iteration.

**Storage rent:** Unlike Ethereum, Soroban charges ongoing rent for persistent
state. The Ndi-Fi contracts extend TTLs on every state-changing call
(30-day threshold, 90-day target). If a user's stake entry expires, it can be
restored by calling any state-changing function, but the caller must pay the
restoration fee. Integrators should monitor TTLs on behalf of users.

---

## 8. L2 cost projection (Phase 2 roadmap)

The roadmap plans an L2 deployment (Arbitrum or Optimism) in Phase 2. L2
transaction costs are approximately 10–50× lower than Ethereum mainnet, depending
on calldata size.

| Operation | Mainnet (10 gwei, $3,000 ETH) | Arbitrum (estimate ×20 cheaper) |
|---|---|---|
| `deposit` (vault) | ~$3.00 | ~$0.15 |
| `stake` | ~$5.25 | ~$0.26 |
| `takeLoan` (n=3) | ~$11.40 | ~$0.57 |
| `liquidateLoan` (n=3) | ~$18.00 | ~$0.90 |
| Full withdrawal cycle | ~$6.90 | ~$0.35 |

L2 deployment makes the protocol viable for smaller positions (sub-$1,000)
where mainnet gas would otherwise consume a significant fraction of the
position's value.

---

## 9. Summary of cost hotspots

| Hotspot | Root cause | Impact |
|---|---|---|
| `liquidateLoan` with many collateral types | O(n²) insertion sort + n Chainlink calls | Could exceed block gas limit at n>8 |
| `takeLoan` with many collateral types | Two O(n) loops + n Chainlink calls each | Expensive for users at n>5 |
| `distributeRewards` to many recipients | O(n) loop, each step is a full mint | High batch cost; split into smaller batches |
| `executeWithdrawal` bug | Redeems all contract shares | Inflated gas when many stakers are present |
| Repeated Chainlink calls | Same feed queried twice per loan | Avoidable with in-transaction price cache |

Keeping the number of supported collateral tokens below 5 is the single most
impactful way to control user-facing gas costs with the current implementation.
