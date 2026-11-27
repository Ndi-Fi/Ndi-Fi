# Staking Guide

Ndi-Fi offers staking on two networks: **Ethereum** (Solidity, `src/NdiFiStaking.sol`) and **Stellar** (Rust, `stellar/contracts/ndi_staking/`). The mechanics are intentionally parallel—same cooldown model, same reward formula, same emergency exit—but the interfaces differ in a few details described below.

---

## What you stake

| Network | Stake token | Reward token |
|---|---|---|
| Ethereum | Any ERC-20 configured as `stakeToken` (typically an LP token) | NdiPoint (NDI) |
| Stellar | Any SEP-41 LP token configured as `stake_token` | NdiToken (NDI) |

You earn NDI continuously from the moment you stake. The reward rate is set at deployment and expressed as an annual percentage (APR).

---

## Ethereum staking

### Contract: `NdiFiStaking`

The contract is `src/NdiFiStaking.sol`. Staked assets are deposited into an ERC-4626 vault (`NdiFiVault`) so the principal earns additional yield while staked.

#### Parameters (set at deployment)

| Parameter | Meaning |
|---|---|
| `apy` | Annual reward rate in percent (e.g. `10` = 10% APR) |
| `minStake` | Minimum tokens per stake |
| `maxStake` | Maximum tokens per stake |
| `minDuration` | Minimum time before withdrawal can be requested |
| `WITHDRAW_WAIT` | Hard-coded 21-day cooldown between request and execution |

#### Staking

```solidity
function stake(uint256 amount) external
```

1. Transfers `amount` of `stakeToken` from your wallet to the staking contract.
2. The contract deposits the tokens into the vault, minting ERC-4626 shares.
3. Records your `StakeInfo`: amount, start timestamp, and zero rewards claimed.
4. Emits `Staked(user, amount)`.

You can hold only one active stake at a time. A new stake is blocked until the previous one is withdrawn.

#### Claiming rewards mid-stake

```solidity
function claimRewards() external
```

Pays out NDI rewards accrued since your last claim (or since you staked) without touching your principal. The contract transfers reward tokens from its own balance to you.

Rewards are calculated as:

```
pendingRewards = (amount × apy × elapsed) / (100 × 365 days) − rewardsClaimed
```

where `elapsed` is seconds since `stake.timestamp`.

#### Requesting a withdrawal

```solidity
function requestWithdrawal() external
```

Starts the 21-day cooldown. After this call, rewards continue accruing until `executeWithdrawal`. You can only have one open withdrawal request.

Emits `WithdrawalRequested(user, amount)`.

#### Executing a withdrawal

```solidity
function executeWithdrawal() external
```

Available only after `requestedAt + 21 days`. Redeems your ERC-4626 shares from the vault and sends the principal back to you, then pays any remaining rewards. Emits `Withdrawn(user, stakedAmount, rewardAmount)`.

#### Emergency withdraw

There is no permissionless emergency withdraw on the Ethereum contract. The owner can call `skimProfits(address to)` to sweep excess vault yield, but user principal is always redeemable through the normal withdrawal path.

---

## Stellar staking

### Contract: `NdiStaking`

The contract is `stellar/contracts/ndi_staking/src/contract.rs`. It holds LP tokens directly (no vault layer) and pays rewards from a funded reward pool.

#### Parameters (set at deployment)

| Parameter | Meaning |
|---|---|
| `reward_rate` | APR scaled by 1e7 (e.g. `1_000_000` = 10%) |
| `min_stake` | Minimum stroops per stake |
| `max_stake` | Maximum stroops per stake |
| `cooldown` | Seconds between `request_unstake` and `unstake` (default: 1,814,400 = 21 days) |

#### Staking

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <IDENTITY> --network testnet \
  -- stake --user <YOUR_ADDRESS> --amount <STROOPS>
```

Transfers LP tokens from `user` to the contract and opens a `StakeInfo` record. One active stake per address. Emits `Staked`.

#### Claiming rewards

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <IDENTITY> --network testnet \
  -- claim --user <YOUR_ADDRESS>
```

Pays pending NDI from the reward pool without disturbing your stake. Reverts with `NoRewards` if nothing has accrued yet. Emits `RewardClaimed`.

The reward formula is:

```
accrued = amount × reward_rate × elapsed / (1e7 × SECONDS_PER_YEAR)
pending  = accrued − rewards_claimed
```

#### Requesting an unstake

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <IDENTITY> --network testnet \
  -- request_unstake --user <YOUR_ADDRESS>
```

Records the current ledger timestamp in `unstake_requested_at`. Rewards keep accruing until `unstake` is called. Emits `UnstakeRequested` with the `available_at` timestamp. Only one pending request is allowed per user.

#### Completing an unstake

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <IDENTITY> --network testnet \
  -- unstake --user <YOUR_ADDRESS>
```

Requires `ledger.timestamp >= unstake_requested_at + cooldown`. Returns your LP tokens and pays all remaining rewards. Emits `Unstaked(user, amount, reward)`.

#### Emergency withdraw

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <IDENTITY> --network testnet \
  -- emergency_withdraw --user <YOUR_ADDRESS>
```

Returns your LP tokens immediately—even while the contract is paused—but forfeits all unclaimed rewards. Use this only if you need to exit without waiting for the cooldown or if the contract is in an emergency pause. Emits `EmergencyWithdrawn(user, amount, forfeited_reward)`.

#### Funding the reward pool

The reward pool must be funded before it can pay out. Anyone can add to the pool:

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <FUNDER_IDENTITY> --network testnet \
  -- fund_rewards --from <FUNDER_ADDRESS> --amount <STROOPS>
```

Emits `RewardsFunded`. If the pool runs dry, `claim` and `unstake` will revert with `InsufficientRewardPool`. Monitor the pool balance and top it up before it reaches zero.

---

## Cooldown: why 21 days?

The 21-day cooldown between a withdrawal request and actual withdrawal protects the protocol against rapid capital flight during market stress. It gives the team time to respond to anomalies and prevents a single large exit from draining vault liquidity before other depositors can react.

The cooldown begins the moment you call `requestWithdrawal` (Ethereum) or `request_unstake` (Stellar). Your rewards continue to accrue during this period.

---

## Reward accrual and penalties

- Rewards accrue linearly from the moment you stake.
- There are **no early-exit penalties** on the Ethereum contract—you simply wait the 21-day cooldown.
- On Stellar, `emergency_withdraw` forfeits all pending rewards. This is the only penalty: you lose accrued NDI but recover your principal in full.
- There is no fee deducted from principal on either network.

---

## Risk disclosures

1. **Smart contract risk.** Both contracts have been reviewed internally, but no external audit has been completed at time of writing. Do not stake amounts you cannot afford to lose.

2. **Reward pool insolvency (Stellar).** If the reward pool is depleted, `claim` and `unstake` revert. Your principal is not at risk, but you cannot exit with rewards until the pool is replenished. Use `emergency_withdraw` to recover principal immediately.

3. **ERC-4626 vault risk (Ethereum).** Staked principal is held in `NdiFiVault`. Vault bugs or unexpected vault asset depegging could affect principal recovery.

4. **Liquidity lock.** Once you stake, your tokens are locked for at least the cooldown period (21 days). Do not stake tokens you may need sooner.

5. **Oracle and price risk.** The staking contracts do not use price oracles, so there is no liquidation risk here. NDI reward value in USD depends on market prices.

6. **Paused state.** The owner can pause staking operations. During a pause, `stake`, `claim`, `request_unstake`, and `unstake` are all disabled on Stellar. On Ethereum, `stake`, `claimRewards`, `requestWithdrawal`, and `executeWithdrawal` are gated by the token-level pause on `NdiPoint`. Emergency withdraw remains available on Stellar even while paused.

7. **Admin key risk.** The contract owner can pause the protocol and, on Stellar, set the interest rate and deposit cap on the lending vault. Use only protocols whose admin keys are held in a multi-sig.

---

## Frequently asked questions

**Can I add to an existing stake?**
No. Each address supports one active stake at a time. To increase your position, withdraw the existing stake (waiting out the cooldown), then stake the larger amount.

**Do rewards compound automatically?**
No. Rewards are issued as NDI tokens. If you want to restake rewards, claim them manually and stake the NDI separately (the reward and stake tokens must be different on Stellar).

**What happens if I call `claim` before any rewards have accrued?**
On Stellar it reverts with `NoRewards`. On Ethereum, `claimRewards` reverts with "No rewards". Wait until at least some time has elapsed.

**What happens to my rewards if I use emergency withdraw on Stellar?**
They are forfeited entirely. The contract emits `EmergencyWithdrawn` with the `forfeited_reward` amount for accounting purposes, but no NDI is sent to you.

**Can a third party claim or withdraw on my behalf?**
No. `stake`, `claim`, `request_unstake`, `unstake`, and `emergency_withdraw` all call `user.require_auth()` on Stellar or use `msg.sender` on Ethereum.

**When does the 21-day cooldown start?**
The moment you call `requestWithdrawal` (Ethereum) or `request_unstake` (Stellar). The timestamp is recorded on-chain.

**What is the reward pool on Stellar and how can I check it?**
It is the NDI token balance held by the staking contract. Query it with:

```
stellar contract invoke --id <NDI_STAKING> \
  --source-account <ANY_IDENTITY> --network testnet \
  -- reward_pool
```

**Where can I read more?**

- [NdiPoint Token Guide](NdiPoint-Guide.md) — NDI token roles and permit
- [Borrowing Guide](Borrowing-Guide.md) — lending and liquidation
- [Stellar Deployment Guide](stellar/DEPLOYMENT.md) — deploying and upgrading contracts
