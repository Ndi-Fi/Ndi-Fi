# Ndi-Fi Event Catalogue

This document lists every event emitted by the Ndi-Fi contracts on both the Solidity (EVM) and Soroban (Stellar) stacks. Use it as the authoritative reference for indexers, analytics pipelines, and front-end listeners.

---

## Solidity contracts

### NdiFiVault (`src/NdiFiVault.sol`)

| Event | Fields | Emitted when |
|---|---|---|
| `deposited(uint256 amount)` | `amount` – asset tokens deposited | A caller successfully calls `deposit()` |
| `withdrawSuccessful()` | _(none)_ | `emergencyWithdraw()` transfers the vault balance |
| `redeemed()` | _(none)_ | A caller successfully calls `redeem()` |
| `minted(uint256 shares)` | `shares` – share tokens minted | A caller successfully calls `mint()` |
| `LendingTokensWithdrawn(address indexed borrower, uint256 amount)` | `borrower` – recipient of the tokens; `amount` – asset tokens sent | `withdrawForLoan()` transfers tokens to the lending contract |
| `LendingContractUpdated(address indexed oldContract, address indexed newContract)` | `oldContract` – previous authorized lending address; `newContract` – newly authorized address | Owner calls `setAuthorizedLendingContract()` |

**Notes**
- `deposited`, `redeemed`, and `minted` are emitted _in addition to_ the standard ERC-4626 / ERC-20 events inherited from OpenZeppelin (`Transfer`, `Deposit`, `Withdraw`).
- ERC-20 `Transfer` events are emitted on every share mint, burn, and transfer.

---

### NdiFiStaking (`src/NdiFiStaking.sol`)

| Event | Fields | Emitted when |
|---|---|---|
| `Staked(address indexed user, uint256 amount)` | `user` – staker; `amount` – tokens staked | `stake()` succeeds |
| `RewardClaimed(address indexed user, uint256 reward)` | `user` – claimer; `reward` – reward tokens paid | `claimRewards()` pays out rewards |
| `WithdrawalRequested(address indexed user, uint256 amount)` | `user` – requester; `amount` – staked amount queued | `requestWithdrawal()` records the 21-day cooldown |
| `Withdrawn(address indexed user, uint256 stakedAmount, uint256 rewardAmount)` | `user` – withdrawer; `stakedAmount` – principal returned; `rewardAmount` – final reward paid | `executeWithdrawal()` completes after the cooldown |
| `ProfitsSkimmed(address to, uint256 amount)` | `to` – recipient; `amount` – profit assets transferred | Owner calls `skimProfits()` |

---

### NdiFiLending (`src/NdiFiLending.sol`)

| Event | Fields | Emitted when |
|---|---|---|
| `CollateralDeposited(address indexed user, uint256 amount)` | `user` – depositor; `amount` – collateral tokens deposited | `depositCollateral()` succeeds |
| `CollateralWithdrawn(address indexed user, uint256 amount)` | `user` – withdrawer; `amount` – collateral tokens returned | `withdrawCollateral()` succeeds |
| `LoanTaken(address indexed user, uint256 principal, uint256 collateralLocked)` | `user` – borrower; `principal` – gross loan amount (including origination fee); `collateralLocked` – token units locked | `takeLoan()` succeeds |
| `LoanRepaid(address indexed user, uint256 amount, uint256 originationFee)` | `user` – repayer; `amount` – total repaid (principal + fee); `originationFee` – fee portion | `repayLoan()` succeeds |
| `LoanLiquidated(address indexed borrower, address indexed liquidator, uint256 collateralSeized, uint256 debtRepaid)` | `borrower` – liquidated account; `liquidator` – caller; `collateralSeized` – USD-equivalent value seized; `debtRepaid` – lending tokens repaid | `liquidateLoan()` succeeds |
| `OriginationFeeRateUpdated(uint256 oldRate, uint256 newRate)` | `oldRate` – previous fee in basis points; `newRate` – new fee in basis points | Owner calls `setOriginationFeeRate()` |
| `ContractInitialized(uint256 collateralFactor, uint256 liquidationThreshold, uint256 originationFeeRate, uint256 penalty)` | The four initial risk parameters | Owner calls `initialize()` for the first time |

**Notes**
- `collateralSeized` in `LoanLiquidated` is the _value_ (price-denominated), not the token amount.
- `principal` in `LoanTaken` is the _gross_ amount; the net amount sent to the borrower is `principal - originationFee`.

---

### NdiPoint (`src/NdiPoint.sol`)

| Event | Fields | Emitted when |
|---|---|---|
| `RewardDistributed(address indexed recipient, uint256 amount, string reason)` | `recipient` – recipient; `amount` – NDI points minted; `reason` – freeform label | `distributeReward()` or `distributeRewards()` mints tokens |
| `ContractAuthorized(address indexed contractAddress, bool authorized)` | `contractAddress` – contract toggled; `authorized` – new state | Owner calls `setContractAuthorization()` |
| `TokensRecovered(address indexed token, address indexed to, uint256 amount)` | `token` – recovered ERC-20; `to` – recipient; `amount` – amount sent | Owner calls `recoverTokens()` |

**Inherited ERC-20 events** (emitted by OpenZeppelin base):
- `Transfer(address indexed from, address indexed to, uint256 value)` – every mint, burn, and transfer.
- `Approval(address indexed owner, address indexed spender, uint256 value)` – every approve.

---

## Soroban contracts (Stellar)

Soroban events are structured as `(contract_id, topics, data)`. The `#[topic]` fields below become indexed topics; the remaining fields are in the data payload.

### NdiToken (`stellar/contracts/ndi_token/src/contract.rs`)

| Event struct | Topics | Data fields | Emitted when |
|---|---|---|---|
| `RewardDistributed` | `recipient: Address` | `amount: i128`, `reason: String` | `distribute_reward()` or `distribute_rewards()` mints tokens |
| `TokensRecovered` | `token: Address`, `to: Address` | `amount: i128` | Owner calls `recover_tokens()` |

**Inherited SEP-41 events** (emitted by `stellar_tokens` base):
- `transfer` topic on every `transfer()` and `transfer_from()`.
- `burn` topic on every `burn()` and `burn_from()`.

---

### NdiStaking (`stellar/contracts/ndi_staking/src/contract.rs`)

| Event struct | Topics | Data fields | Emitted when |
|---|---|---|---|
| `Staked` | `user: Address` | `amount: i128` | `stake()` succeeds |
| `RewardClaimed` | `user: Address` | `reward: i128` | `claim()` pays out rewards |
| `UnstakeRequested` | `user: Address` | `amount: i128`, `available_at: u64` | `request_unstake()` records the cooldown |
| `Unstaked` | `user: Address` | `amount: i128`, `reward: i128` | `unstake()` completes after the cooldown |
| `EmergencyWithdrawn` | `user: Address` | `amount: i128`, `forfeited_reward: i128` | `emergency_withdraw()` returns principal and forfeits pending rewards |
| `RewardsFunded` | `from: Address` | `amount: i128` | `fund_rewards()` transfers reward tokens into the pool |

---

### NdiLending (`stellar/contracts/ndi_lending/src/contract.rs`)

| Event struct | Topics | Data fields | Emitted when |
|---|---|---|---|
| `Borrowed` | `borrower: Address` | `amount: i128`, `total_debt: i128` | `borrow()` draws liquidity |
| `Repaid` | `from: Address` | `amount: i128`, `remaining_debt: i128` | `repay()` reduces outstanding debt |
| `BorrowerUpdated` | _(none)_ | `old_borrower: Option<Address>`, `new_borrower: Option<Address>` | Owner calls `set_borrower()` |
| `DepositCapUpdated` | _(none)_ | `old_cap: i128`, `new_cap: i128` | Owner calls `set_deposit_cap()` |
| `InterestRateUpdated` | _(none)_ | `old_rate: i128`, `new_rate: i128` | Owner calls `set_interest_rate()` |
| `EmergencyWithdrawn` | `to: Address` | `amount: i128` | Owner calls `emergency_withdraw()` while paused |

**Inherited vault events** (emitted by `stellar_tokens` vault base):
- `deposit` – on every `deposit()` or `mint()`.
- `withdraw` – on every `withdraw()` or `redeem()`.

---

## Keeping this catalogue in sync

A CI check verifying this document stays current is tracked in [issue #189](https://github.com/Ndi-Fi/Ndi-Fi/issues/189). Until that check is in place, update this file whenever a new event is added, renamed, or removed in the contract source.

---

## See also

- [Glossary](Glossary.md)
- [Environment Variables](Environment.md)
