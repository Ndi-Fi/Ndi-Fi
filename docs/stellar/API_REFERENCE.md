# Stellar Contract API Reference

This reference documents the public functions, events, and error codes for the three Ndi-Fi Soroban contracts: **NdiToken**, **NdiLending**, and **NdiStaking**.

Generated from source at `stellar/contracts/`. Toolchain version is pinned in [`stellar/rust-toolchain.toml`](../../stellar/rust-toolchain.toml) (`1.99.1`, `soroban-sdk = "28.0.0"`).

For the full rustdoc reference, build it locally:

```bash
cd stellar
cargo doc --no-deps --open
```

---

## NdiToken (`ndi_token`)

**Source:** `stellar/contracts/ndi_token/src/`

The Ndi-Fi reward and governance token on Stellar. A SEP-41 fungible token with a hard supply cap (1 billion NDI), owner-gated minting and reward distribution, burning, pausing, and native WASM upgrades. Stellar assets use 7 decimals (`DECIMALS = 7`).

### Constants

| Constant | Value | Description |
|---|---|---|
| `DECIMALS` | `7` | Token decimal places (Stellar convention). |
| `MAX_SUPPLY` | `1_000_000_000 × 10^7` | Hard cap; minting above this fails. |
| `INITIAL_SUPPLY` | `100_000_000 × 10^7` | Minted to `owner` at deployment. |

### Constructor

```rust
fn __constructor(e: &Env, owner: Address)
```

Deploys the token. Sets metadata (`"Ndi-Point"`, `"NDI"`, 7 decimals), sets the supply cap, sets the owner, and mints `INITIAL_SUPPLY` to `owner`.

### Functions

#### `mint`

```rust
fn mint(e: &Env, to: Address, amount: i128) -> Result<(), TokenError>
```

Mints `amount` new tokens to `to`. Owner only; blocked while paused.

**Errors:** `InvalidAmount` (amount ≤ 0), `ExceedsMaxSupply` (would exceed `MAX_SUPPLY`).

---

#### `distribute_reward`

```rust
fn distribute_reward(
    e: &Env,
    recipient: Address,
    amount: i128,
    reason: String,
) -> Result<(), TokenError>
```

Mints a single reward to `recipient`, records the reward timestamp in persistent storage, and emits `RewardDistributed`. Owner only; blocked while paused.

**Errors:** `InvalidAmount`, `ExceedsMaxSupply`, `MathOverflow`.

---

#### `distribute_rewards`

```rust
fn distribute_rewards(
    e: &Env,
    recipients: Vec<Address>,
    amounts: Vec<i128>,
    reason: String,
) -> Result<(), TokenError>
```

Mints rewards to many recipients in one call. The whole batch is atomic: if any amount is zero or the total would exceed the cap, nothing is minted. Owner only; blocked while paused.

**Errors:** `LengthMismatch`, `EmptyBatch`, `InvalidAmount`, `ExceedsMaxSupply`, `MathOverflow`.

---

#### `last_reward_at`

```rust
fn last_reward_at(e: &Env, account: Address) -> u64
```

Returns the ledger timestamp of the last reward minted to `account`. Returns `0` if the account has never received a reward.

---

#### `max_supply`

```rust
fn max_supply(_e: &Env) -> i128
```

Returns `MAX_SUPPLY`.

---

#### `remaining_supply`

```rust
fn remaining_supply(e: &Env) -> i128
```

Returns `MAX_SUPPLY - total_supply`. Tokens that can still be minted before hitting the cap.

---

#### `recover_tokens`

```rust
fn recover_tokens(
    e: &Env,
    token: Address,
    to: Address,
    amount: i128,
) -> Result<(), TokenError>
```

Sends `amount` of a foreign SEP-41 `token` (sent here by mistake) to `to`. Owner only. The contract cannot recover its own balance.

**Errors:** `CannotRecoverSelf`, `InvalidAmount`.

---

#### SEP-41 standard functions

Inherited via `FungibleToken`, `FungibleBurnable`, `FungibleCapped`, and `FungibleTotalSupply`:

| Function | Blocked while paused |
|---|---|
| `transfer(from, to, amount)` | Yes |
| `transfer_from(spender, from, to, amount)` | Yes |
| `burn(from, amount)` | Yes |
| `burn_from(spender, from, amount)` | Yes |
| `balance(id)` | No |
| `allowance(from, spender)` | No |
| `approve(from, spender, amount, expiration_ledger)` | No |
| `total_supply()` | No |
| `cap()` | No |
| `decimals()` | No |
| `name()` | No |
| `symbol()` | No |

---

#### Access control / lifecycle

| Function | Auth required | Description |
|---|---|---|
| `pause(caller)` | Owner | Pauses transfers, burns, mints, and reward distribution. |
| `unpause(caller)` | Owner | Lifts the pause. |
| `upgrade(new_wasm_hash, operator)` | Owner | Replaces the contract WASM (already uploaded). |
| `owner()` | — | Returns the current owner. |
| `transfer_ownership(new_owner)` | Owner | Transfers ownership. |

---

### Events

#### `RewardDistributed`

Emitted by `distribute_reward` and `distribute_rewards` for each recipient.

| Field | Type | Topic |
|---|---|---|
| `recipient` | `Address` | Yes |
| `amount` | `i128` | No |
| `reason` | `String` | No |

#### `TokensRecovered`

Emitted by `recover_tokens`.

| Field | Type | Topic |
|---|---|---|
| `token` | `Address` | Yes |
| `to` | `Address` | Yes |
| `amount` | `i128` | No |

---

### Errors (`TokenError`)

| Code | Variant | Meaning |
|---|---|---|
| 1 | `InvalidAmount` | Amount must be greater than zero. |
| 2 | `LengthMismatch` | `recipients` and `amounts` have different lengths. |
| 3 | `EmptyBatch` | Batch call with no recipients. |
| 4 | `CannotRecoverSelf` | Contract cannot recover its own balance. |
| 5 | `ExceedsMaxSupply` | Minting would push total supply above `MAX_SUPPLY`. |
| 6 | `MathOverflow` | Arithmetic overflow. |

---

---

## NdiLending (`ndi_lending`)

**Source:** `stellar/contracts/ndi_lending/src/`

The Ndi-Fi lending vault on Stellar. A SEP-41 vault (ERC-4626 style) where depositors receive share tokens. One owner-approved borrower may draw idle liquidity; its debt grows at a fixed annual rate and repaid interest raises the share price.

### Interest Rate Model

Annual rates are scaled by `RATE_SCALE = 10_000_000` (1e7 = 100% APR). `500_000` means 5% APR. Interest is computed with simple interest over elapsed seconds and capitalised into the debt every time the debt is touched. See `stellar/contracts/ndi_lending/src/interest.rs` for the exact formula.

| Constant | Value | Description |
|---|---|---|
| `RATE_SCALE` | `10_000_000` | 1e7 = 100% APR. |
| `MAX_RATE` | `10_000_000` | Maximum accepted rate (100% APR). |
| `SECONDS_PER_YEAR` | `31_536_000` | 365 × 24 × 60 × 60. |
| `DECIMALS_OFFSET` | `0` | Virtual-share offset (share decimals = asset decimals). |

### Constructor

```rust
fn __constructor(
    e: &Env,
    owner: Address,
    asset: Address,
    name: String,
    symbol: String,
    deposit_cap: i128,
    interest_rate: i128,
)
```

Deploys the vault. Sets the SEP-41 `asset`, share token metadata (`name`, `symbol`), the deposit cap, and the initial interest rate. `deposit_cap` must be > 0; `interest_rate` must be in `0..=MAX_RATE`.

**Errors:** `InvalidCap`, `InvalidRate`.

### Functions

#### `borrow`

```rust
fn borrow(e: &Env, amount: i128) -> Result<i128, LendingError>
```

Draws `amount` of idle liquidity to the authorised borrower. The borrower must sign. Returns the new total outstanding debt. Blocked while paused.

**Errors:** `NoBorrower`, `InvalidAmount`, `InsufficientLiquidity`, `MathOverflow`.

---

#### `repay`

```rust
fn repay(e: &Env, from: Address, amount: i128) -> Result<i128, LendingError>
```

Repays up to `amount` of debt from `from` (anyone may repay). Any excess over outstanding debt is not taken. Returns the remaining debt. Allowed while paused.

**Errors:** `InvalidAmount`, `NoDebt`, `MathOverflow`.

---

#### `set_borrower`

```rust
fn set_borrower(e: &Env, borrower: Option<Address>) -> Result<(), LendingError>
```

Sets or clears the single borrower allowed to call `borrow`. Pass `None` to remove. Owner only. Fails if debt is outstanding.

**Errors:** `DebtOutstanding`, `MathOverflow`.

---

#### `set_interest_rate`

```rust
fn set_interest_rate(e: &Env, rate: i128) -> Result<(), LendingError>
```

Sets the borrower APR. Interest up to now is accrued at the old rate first. Owner only.

**Errors:** `InvalidRate`, `MathOverflow`.

---

#### `set_deposit_cap`

```rust
fn set_deposit_cap(e: &Env, cap: i128) -> Result<(), LendingError>
```

Sets the cap on total managed assets. Must be > 0. Owner only.

**Errors:** `InvalidCap`.

---

#### `emergency_withdraw`

```rust
fn emergency_withdraw(e: &Env, to: Address) -> i128
```

Sends every idle asset to `to`. Owner only, and only while paused. Returns the amount sent.

---

#### Read-only helpers

| Function | Returns | Description |
|---|---|---|
| `deposit_cap(e)` | `i128` | Current deposit cap. |
| `interest_rate(e)` | `i128` | Borrower APR scaled by 1e7. |
| `borrower(e)` | `Option<Address>` | Authorised borrower, if any. |
| `total_debt(e)` | `i128` | Outstanding debt including accrued interest. |
| `available_liquidity(e)` | `i128` | Asset balance not lent out. |
| `utilization(e)` | `i128` | `debt / (debt + liquidity)` scaled by 1e7. |

---

#### Vault (ERC-4626-style) functions

| Function | Blocked while paused |
|---|---|
| `deposit(assets, receiver, from, operator)` | Yes |
| `mint(shares, receiver, from, operator)` | Yes |
| `withdraw(assets, receiver, owner, operator)` | Yes |
| `redeem(shares, receiver, owner, operator)` | Yes |
| `convert_to_shares(assets)` | No |
| `convert_to_assets(shares)` | No |
| `max_deposit(receiver)` | Returns 0 while paused |
| `max_mint(receiver)` | Returns 0 while paused |
| `max_withdraw(owner)` | Returns 0 while paused |
| `max_redeem(owner)` | Returns 0 while paused |
| `preview_deposit(assets)` | No |
| `preview_mint(shares)` | No |
| `preview_withdraw(assets)` | No |
| `preview_redeem(shares)` | No |
| `total_assets()` | No (idle assets + debt) |

---

#### Access control / lifecycle

| Function | Auth required | Description |
|---|---|---|
| `pause(caller)` | Owner | Pauses deposits, mints, withdrawals, redemptions, and borrowing. |
| `unpause(caller)` | Owner | Lifts the pause. |
| `upgrade(new_wasm_hash, operator)` | Owner | Replaces the contract WASM. |

---

### Events

#### `Borrowed`

| Field | Type | Topic |
|---|---|---|
| `borrower` | `Address` | Yes |
| `amount` | `i128` | No |
| `total_debt` | `i128` | No |

#### `Repaid`

| Field | Type | Topic |
|---|---|---|
| `from` | `Address` | Yes |
| `amount` | `i128` | No |
| `remaining_debt` | `i128` | No |

#### `BorrowerUpdated`

| Field | Type | Topic |
|---|---|---|
| `old_borrower` | `Option<Address>` | No |
| `new_borrower` | `Option<Address>` | No |

#### `DepositCapUpdated`

| Field | Type | Topic |
|---|---|---|
| `old_cap` | `i128` | No |
| `new_cap` | `i128` | No |

#### `InterestRateUpdated`

| Field | Type | Topic |
|---|---|---|
| `old_rate` | `i128` | No |
| `new_rate` | `i128` | No |

#### `EmergencyWithdrawn`

| Field | Type | Topic |
|---|---|---|
| `to` | `Address` | Yes |
| `amount` | `i128` | No |

Standard vault `Deposit` and `Withdraw` events are emitted by the OpenZeppelin vault layer on every deposit/mint/withdraw/redeem.

---

### Errors (`LendingError`)

| Code | Variant | Meaning |
|---|---|---|
| 1 | `InvalidAmount` | Amount or share count must be greater than zero. |
| 2 | `DepositCapExceeded` | Deposit would push total managed assets above the cap. |
| 3 | `InsufficientShares` | Owner does not hold enough shares. |
| 4 | `InsufficientLiquidity` | Not enough idle assets in the vault. |
| 5 | `ZeroShares` | Deposit too small to mint at least one share. |
| 6 | `ZeroAssets` | Redeem too small to return at least one asset unit. |
| 7 | `NoBorrower` | No borrower has been authorised. |
| 8 | `DebtOutstanding` | Borrower cannot be changed while debt is outstanding. |
| 9 | `NoDebt` | There is no debt to repay. |
| 10 | `InvalidRate` | Rate is outside `0..=MAX_RATE`. |
| 11 | `InvalidCap` | Deposit cap must be greater than zero. |
| 12 | `MathOverflow` | Arithmetic overflow. |

OpenZeppelin vault errors start at code 400; pausable errors at 1000; ownable errors at 2100.

---

---

## NdiStaking (`ndi_staking`)

**Source:** `stellar/contracts/ndi_staking/src/`

LP-token staking with NdiToken rewards. Users stake a SEP-41 LP token and earn rewards in NdiToken at a fixed annual rate from a pre-funded reward pool. Unstaking uses a two-step request / execute flow with a cooldown period.

### Constants

| Constant | Value | Description |
|---|---|---|
| `RATE_SCALE` | `10_000_000` | 1e7 = 100% APR. |
| `SECONDS_PER_YEAR` | `31_536_000` | 365 × 24 × 60 × 60. |

### Types

#### `Config`

Immutable configuration set in the constructor.

| Field | Type | Description |
|---|---|---|
| `stake_token` | `Address` | SEP-41 LP token users stake. |
| `reward_token` | `Address` | SEP-41 token rewards are paid in (NdiToken). |
| `reward_rate` | `i128` | Annual reward rate scaled by `RATE_SCALE`. |
| `min_stake` | `i128` | Minimum accepted stake amount. |
| `max_stake` | `i128` | Maximum accepted stake amount. |
| `cooldown` | `u64` | Seconds between `request_unstake` and `unstake`. |

#### `StakeInfo`

One user's stake state.

| Field | Type | Description |
|---|---|---|
| `amount` | `i128` | LP tokens staked. |
| `staked_at` | `u64` | Ledger timestamp when the stake was opened. |
| `rewards_claimed` | `i128` | Rewards already paid out for this stake. |
| `unstake_requested_at` | `Option<u64>` | Timestamp of `request_unstake`, if called. |

### Constructor

```rust
fn __constructor(
    e: &Env,
    owner: Address,
    stake_token: Address,
    reward_token: Address,
    reward_rate: i128,
    min_stake: i128,
    max_stake: i128,
    cooldown: u64,
)
```

Deploys the staking contract. `stake_token` and `reward_token` must be different. `reward_rate` must be in `0..=RATE_SCALE`. `min_stake` must be > 0, and `max_stake` ≥ `min_stake`.

**Errors:** `InvalidConfig`.

### Functions

#### `stake`

```rust
fn stake(e: &Env, user: Address, amount: i128) -> Result<(), StakingError>
```

Stakes `amount` LP tokens for `user`. The user must sign. Each address may hold at most one active stake at a time. Blocked while paused.

**Errors:** `InvalidAmount`, `StakeOutOfRange`, `AlreadyStaked`, `MathOverflow`.

---

#### `claim`

```rust
fn claim(e: &Env, user: Address) -> Result<i128, StakingError>
```

Claims all pending rewards for `user`. Returns the reward amount paid. The user must sign. Blocked while paused.

**Errors:** `NoActiveStake`, `NoRewards`, `InsufficientRewardPool`, `MathOverflow`.

---

#### `request_unstake`

```rust
fn request_unstake(e: &Env, user: Address) -> Result<u64, StakingError>
```

Starts the unstake cooldown for `user`. Returns the ledger timestamp after which `unstake` can be called (`now + cooldown`). Rewards keep accruing until `unstake`. Blocked while paused.

**Errors:** `NoActiveStake`, `UnstakeAlreadyRequested`, `MathOverflow`.

---

#### `unstake`

```rust
fn unstake(e: &Env, user: Address) -> Result<(i128, i128), StakingError>
```

Completes an unstake after the cooldown has elapsed. Returns `(principal_returned, reward_paid)`. All pending rewards are paid at this point. Blocked while paused.

**Errors:** `NoActiveStake`, `UnstakeNotRequested`, `CooldownNotElapsed`, `InsufficientRewardPool`, `MathOverflow`.

---

#### `emergency_withdraw`

```rust
fn emergency_withdraw(e: &Env, user: Address) -> Result<i128, StakingError>
```

Returns the staked principal to `user` immediately, forfeiting all unclaimed rewards. Available even while paused. Returns the principal amount returned.

**Errors:** `NoActiveStake`, `MathOverflow`.

---

#### `fund_rewards`

```rust
fn fund_rewards(e: &Env, from: Address, amount: i128) -> Result<(), StakingError>
```

Adds `amount` reward tokens from `from` to the reward pool. Anyone may fund the pool. `from` must sign.

**Errors:** `InvalidAmount`.

---

#### Read-only helpers

| Function | Returns | Description |
|---|---|---|
| `pending_rewards(e, user)` | `i128` | Rewards `user` could claim right now (0 if no stake). |
| `get_stake(e, user)` | `Option<StakeInfo>` | Returns `user`'s stake, if any. |
| `total_staked(e)` | `i128` | Total LP tokens currently staked across all users. |
| `reward_pool(e)` | `i128` | Reward tokens available to pay out. |
| `config(e)` | `Config` | Returns the staking configuration. |

---

#### Access control / lifecycle

| Function | Auth required | Description |
|---|---|---|
| `pause(caller)` | Owner | Pauses stake, claim, request_unstake, and unstake. Emergency withdraw stays open. |
| `unpause(caller)` | Owner | Lifts the pause. |
| `upgrade(new_wasm_hash, operator)` | Owner | Replaces the contract WASM. |

---

### Events

#### `Staked`

| Field | Type | Topic |
|---|---|---|
| `user` | `Address` | Yes |
| `amount` | `i128` | No |

#### `RewardClaimed`

| Field | Type | Topic |
|---|---|---|
| `user` | `Address` | Yes |
| `reward` | `i128` | No |

#### `UnstakeRequested`

| Field | Type | Topic |
|---|---|---|
| `user` | `Address` | Yes |
| `amount` | `i128` | No |
| `available_at` | `u64` | No |

#### `Unstaked`

| Field | Type | Topic |
|---|---|---|
| `user` | `Address` | Yes |
| `amount` | `i128` | No |
| `reward` | `i128` | No |

#### `EmergencyWithdrawn`

| Field | Type | Topic |
|---|---|---|
| `user` | `Address` | Yes |
| `amount` | `i128` | No |
| `forfeited_reward` | `i128` | No |

#### `RewardsFunded`

| Field | Type | Topic |
|---|---|---|
| `from` | `Address` | No |
| `amount` | `i128` | No |

---

### Errors (`StakingError`)

| Code | Variant | Meaning |
|---|---|---|
| 1 | `InvalidAmount` | Amount must be greater than zero. |
| 2 | `StakeOutOfRange` | Stake amount is outside `min_stake..=max_stake`. |
| 3 | `AlreadyStaked` | The user already has an active stake. |
| 4 | `NoActiveStake` | The user has no active stake. |
| 5 | `NoRewards` | No rewards are pending. |
| 6 | `InsufficientRewardPool` | The reward pool cannot cover this payout. |
| 7 | `UnstakeAlreadyRequested` | An unstake request is already open. |
| 8 | `UnstakeNotRequested` | `unstake` called without a prior `request_unstake`. |
| 9 | `CooldownNotElapsed` | The cooldown since `request_unstake` has not passed yet. |
| 10 | `InvalidConfig` | Constructor arguments are inconsistent. |
| 11 | `MathOverflow` | Arithmetic overflow. |

OpenZeppelin pausable errors start at code 1000; ownable errors at 2100.

---

## Generating the Rustdoc Reference

Build HTML documentation for all three contracts without pulling in dependency docs:

```bash
cd stellar
cargo doc --no-deps
```

The output is at `stellar/target/doc/`. Open `stellar/target/doc/ndi_token/index.html` (and the equivalent for `ndi_lending`, `ndi_staking`) in a browser.

To open directly:

```bash
cargo doc --no-deps --open
```

### Hosting

The docs site is hosted from the `docs/stellar/` directory. To update it after a contract change:

1. Run `cargo doc --no-deps` in `stellar/`.
2. Copy the generated HTML into `docs/stellar/rustdoc/` (or update the CI step that does this).
3. Commit the updated files.

Versions in the reference are pinned to the toolchain in `stellar/rust-toolchain.toml`. Do not change the toolchain without updating this document and the CI workflow.
