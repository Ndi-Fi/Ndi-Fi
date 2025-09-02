# NdiStaking Contract Documentation

## Overview

NdiStaking is a simple, single‑position staking contract that accepts a stake token, deposits it into an ERC‑4626 vault to earn yield, and distributes linear APY rewards in a separate reward token. Withdrawals follow a two‑step flow with a 21‑day waiting period. The contract owner can skim excess vault profits over the platform’s principal liability.

---

## Contract Details

* **Contract:** `NdiStaking`
* **Stake Token (ERC20):** `stakeToken` — token users deposit
* **Reward Token (ERC20):** `rewardToken` — token used to pay APY rewards *(contract must hold or be funded with rewards)*
* **Vault (ERC4626):** `vault` — receives the staked assets to accrue external yield
* **APY (uint256):** `apy` — fixed annual percentage yield used for linear accrual (e.g., `10` for 10%)
* **Min/Max Stake:** `minStake`, `maxStake` — per‑user bounds
* **Minimum Duration:** `minDuration` — **parameter present but not enforced** in current logic
* **Withdrawal Wait:** `WITHDRAW_WAIT = 21 days`
* **Ownership:** `Ownable(initialOwner)` — privileged functions restricted to owner
* **Guards:** `ReentrancyGuard`

---

## Key Features

1. **ERC‑4626 Integration**

   * Deposits user stakes into a yield vault; shares held by the contract.
   * Owner can skim profits above total principal liability.

2. **Linear APY Rewards**

   * Rewards accrue linearly per second based on `apy`, initial `amount`, and time since stake start minus previously claimed amounts.
   * Users can claim rewards at any time while stake is active.

3. **Two‑Step Withdrawals**

   * `requestWithdrawal()` starts a **21‑day** cooldown.
   * `executeWithdrawal()` withdraws principal from the vault to the user; intended to also pay remaining rewards (see **Caveats**).

4. **Single Position Per User**

   * Each address may hold at most one active stake at a time.

5. **Owner Profit Skimming**

   * `skimProfits(to)` withdraws vault asset surplus above `totalStaked`.

---

## Contract Architecture

```
NdiStaking
├── Ownable (admin controls)
├── ReentrancyGuard (reentrancy protection)
├── SafeERC20 (safe token ops)
├── IERC20 stakeToken (immutable)
├── IERC20 rewardToken (immutable)
└── IERC4626 vault (immutable, must match stakeToken as asset)
```

---

## Core Functions

### User Flow

* `stake(uint256 amount)`

  * Requirements: `minStake ≤ amount ≤ maxStake`, user has no active stake, `vault.asset() == stakeToken` (enforced in constructor).
  * Effects: pulls `stakeToken` from user, approves & deposits into `vault`, records `StakeInfo`, updates `totalStaked`.
  * Emits: `Staked(user, amount)`.

* `pendingRewards(address user) → uint256`

  * View: calculates linear rewards based on `apy`, `amount`, elapsed time since `timestamp`, minus `rewardsClaimed`.

* `claimRewards()`

  * Requirements: active stake and `pendingRewards > 0`.
  * Transfers `rewardToken` to user and increments `rewardsClaimed`.
  * Emits: `RewardClaimed(user, reward)`.
  * **Note:** Contract **transfers** rewards; it does not mint. Ensure the contract is funded with `rewardToken` or that a separate minter funds it.

* `requestWithdrawal()`

  * Requirements: active stake and no existing request.
  * Records `WithdrawalRequest { amount, requestedAt }`.
  * Emits: `WithdrawalRequested(user, amount)`.

* `executeWithdrawal()`

  * Requirements: existing request; `block.timestamp ≥ requestedAt + 21 days`.
  * Effects: withdraws `amount` of assets from `vault` to user, attempts to transfer any remaining rewards, updates accounting, clears user records.
  * Emits: `Withdrawn(user, stakedAmount, rewardAmount)`.

### Admin Flow

* `skimProfits(address to)` *(onlyOwner)*

  * Computes `profit = convertToAssets(shares) - totalStaked` and withdraws that amount from the vault to `to`.
  * Emits: `ProfitsSkimmed(to, amount)`.

### Views

* `getProfits() → uint256`

  * Returns the current surplus of vault assets above total principal (`totalStaked`).

* Public state: `stakes(user)`, `withdrawalRequests(user)`, `totalStaked`, constructor immutables.

---

## Events

* `Staked(address indexed user, uint256 amount)`
* `RewardClaimed(address indexed user, uint256 reward)`
* `WithdrawalRequested(address indexed user, uint256 amount)`
* `Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount)`
* `ProfitsSkimmed(address to, uint256 amount)`

---

## Use Cases

1. **Simple Staking Pool** — Users deposit a token to earn linear APY rewards in a separate token.
2. **Vault‑Backed Farming** — Protocol routes principal into an ERC‑4626 strategy while paying protocol‑defined APY.
3. **Treasury Yield Capture** — Owner skims yield above liabilities to fund operations or buybacks.

---

## Integration Examples

**Prefunding Rewards**

```solidity
// Fund the staking contract with reward tokens before enabling claims
IERC20(rewardToken).transferFrom(treasury, address(ndiStaking), rewardAmount);
```

**Displaying User Status (frontend pseudo‑code)**

```js
const s = await staking.stakes(user);
const pending = await staking.pendingRewards(user);
const hasReq = (await staking.withdrawalRequests(user)).exists;
```

---

## Deployment Guide

### Prerequisites

* Foundry installed
* Deployed ERC20 stake token and reward token
* Deployed ERC4626 vault whose `asset()` equals the stake token
* Treasury balance of `rewardToken` to pre‑fund rewards

### Constructor Parameters

```
(stakeToken, rewardToken, vault, initialOwner,
 apy, minStake, maxStake, minDuration)
```

### Example (Foundry)

```bash
export RPC_URL=your_rpc
export PRIVATE_KEY=your_pk

forge create src/NdiStaking.sol:NdiStaking \
  --rpc-url $RPC_URL --private-key $PRIVATE_KEY \
  --constructor-args \
  0xStakeToken 0xRewardToken 0xVault 0xOwner \
  10 1e18 10000e18 30 days
```

---

## Testing

Suggested test coverage:

* Stake flow bounds: min/max, single‑position restriction
* Reward math: accrual over time, multiple claims, precision
* Withdrawal flow: request/execute timing, state resets
* Profit accounting: `getProfits()` and `skimProfits()` correctness across share/asset conversions
* Vault edge cases: deposit/withdraw rounding, share price changes
* Access control: onlyOwner on skim
* Reentrancy: attempt to reenter claim/withdraw

Run with Foundry:

```bash
forge test -vv
```

---

## Security Considerations & Known Caveats

**1) Final‑Withdrawal Reward Bug**
In `executeWithdrawal()` the contract sets `s.withdrawn = true` **before** computing `reward = pendingRewards(msg.sender)`. Because `pendingRewards` returns `0` when `withdrawn` is true, users receive **no final rewards** unless they call `claimRewards()` before executing withdrawal.
*Suggested fix:* compute rewards **before** setting `withdrawn`, or add a dedicated final‑settlement path:

```solidity
uint256 reward = pendingRewards(msg.sender);
s.withdrawn = true;
// ...
if (reward > 0) _payReward(msg.sender, reward);
```

**2) `minDuration` Not Enforced**
`minDuration` is stored but never used to gate withdrawals. If a minimum staking period is required, enforce it in `requestWithdrawal()` or `executeWithdrawal()`.

**3) Reward Token Supply**
Code uses `ERC20(address(rewardToken)).transfer(...)`; it **does not mint** rewards. Ensure the contract balance is sufficient, or refactor to use a mint‑capable interface/role.

**4) Allowance Strategy**
`SafeERC20.forceApprove` is used to set allowance for the vault. Confirm your OZ version supports `forceApprove` or fallback to increasing/decreasing allowance.

**5) Single Stake Slot**
Users cannot top‑up or partially withdraw. Consider enabling multiple positions or compounding if needed.

**6) Vault Share/Asset Rounding**
`vault.withdraw(s.amount, ...)` assumes exact asset redemption. Ensure the vault handles rounding and slippage safely.

**7) Owner Profit Skimming**
`getProfits()` assumes liabilities equal `totalStaked` only. If rewards are promised irrespective of vault performance, skimming could under‑reserve. Consider additional buffers.

---

## Gas Optimization Notes

* Immutable references (`stakeToken`, `rewardToken`, `vault`, APY/limits) reduce storage reads.
* Single storage slot per user simplifies accounting.
* Consider caching `block.timestamp` and local variables in hot paths.
* If enabling multiple stakes, batch events and minimize SSTORE operations.

---

## Future Enhancements

* Enforce `minDuration` and/or add early‑withdrawal penalties
* Multiple concurrent stakes per user with NFT position tokens
* Compounding rewards or auto‑claim on withdraw
* Role‑based reward minting (`IMintable` interface) with caps
* Pausable staking/withdrawing for emergencies
* Off‑chain signer permits (EIP‑2612) to save user gas

---

## License

Released under **MIT License**.

---

## Support

* Read inline NatSpec comments and unit tests
* Open an issue in the project repository for questions/bugs
* Perform independent audits and formal verification before mainnet use
