# Ndi-Fi: Solidity → Soroban migration notes

This document maps the existing Ethereum contracts in `src/` to the new Stellar
(Soroban) contracts in `stellar/contracts/`. The Solidity code is **unchanged**;
the Stellar version lives alongside it.

- Solidity: Foundry, OpenZeppelin Contracts, Chainlink price feeds.
- Soroban: Rust, `soroban-sdk 28.0.0`, OpenZeppelin Stellar Contracts `0.8.0`
  (`stellar-tokens`, `stellar-access`, `stellar-contract-utils`, `stellar-macros`),
  target `wasm32v1-none`.

## 1. What the repository actually contains

The project brief described `src/core/NdiLending.sol`, `NdiStaking.sol`,
`NdiInterestRate.sol`, `src/tokens/NdiToken.sol` and Uniswap V3 NFT staking.
The repository instead contains:

| File | Contract | What it does |
|---|---|---|
| `src/NdiFiVault.sol` | `NdiFiVault` | ERC-4626 vault over DAI (not ETH) with a deposit cap ("staking cap"), pause flag, emergency functions, and a hook letting one authorised lending contract pull liquidity. |
| `src/NdiFiLending.sol` | `NdiFiLending` | Over-collateralised loans priced by Chainlink feeds; one-time origination fee; owner-only liquidation. **No time-based interest** and no interest-rate contract. |
| `src/NdiFiStaking.sol` | `NdiStaking` | Single ERC-20 stake per user, fixed APY rewards from a pre-funded balance, 21-day request/execute withdrawal; principal is deposited into the vault. **Not** Uniswap V3 NFT staking. |
| `src/NdiPoint.sol` | `NdiPoint` | ERC-20 reward token ("Ndi-Point", "NDI"), 1B cap, 100M initial mint, AccessControl roles, burn, pause, permit, reward distribution. |
| `src/NdiPointIntegrationExample.sol` | `NdiPointIntegrationExample` | Demo contract for integrators. Not ported. |
| `src/testMockDai.sol` | `MockDAI` | Test token. Not ported; Soroban tests use the Stellar Asset Contract. |

The maintainers chose this mapping for the Stellar version:

| Solidity | Soroban crate | Notes |
|---|---|---|
| `NdiPoint` | `ndi_token` (`NdiToken`) | SEP-41 token, OZ Base + Capped + Burnable + Ownable + Pausable + Upgradeable. |
| `NdiFiVault` (+ the fixed-rate model requested in the brief) | `ndi_lending` (`NdiLending`) | OZ Fungible Vault over any SEP-41 asset. The "authorised lending contract" hook becomes an owner-approved **borrower** whose debt grows at a fixed APR (`interest.rs`). |
| `NdiFiLending` | — (deferred) | Needs collateral prices. Oracles are out of scope for this MVP; see §5 and `WAVE_ISSUES.md`. |
| `NdiStaking` (`NdiFiStaking.sol`) | `ndi_staking` (`NdiStaking`) | LP-token staking (e.g. Soroswap pair token) with fixed-APR rewards in NdiToken, min/max stake, request/execute unstake with a cooldown, plus claim and emergency withdraw. |

## 2. Function mapping

### NdiPoint → `ndi_token`

| Solidity | Soroban | Notes |
|---|---|---|
| `constructor(initialOwner)` | `__constructor(owner)` | Mints `INITIAL_SUPPLY` to `owner`. 7 decimals instead of 18. |
| `name()`, `symbol()`, `decimals()` | `name`, `symbol`, `decimals` | OZ `FungibleToken`. |
| `totalSupply()` | `total_supply` | OZ `FungibleTotalSupply`. |
| `balanceOf`, `allowance` | `balance`, `allowance` | SEP-41. |
| `transfer`, `transferFrom`, `approve` | `transfer`, `transfer_from`, `approve` | SEP-41. `approve` takes `live_until_ledger`. Transfers blocked while paused. |
| `burn`, `burnFrom` | `burn`, `burn_from` | OZ `FungibleBurnable`. Blocked while paused. |
| `mint(to, amount)` (MINTER_ROLE) | `mint(to, amount)` | Owner only. Checks the cap. |
| `distributeReward(recipient, amount, reason)` | `distribute_reward(recipient, amount, reason)` | Owner only. Emits `RewardDistributed`. |
| `distributeRewards(recipients, amounts, reason)` | `distribute_rewards(recipients, amounts, reason)` | Owner only. All-or-nothing. |
| `getLastRewardClaim(account)` / `lastRewardClaim` | `last_reward_at(account)` | Renamed: it records the last reward *distribution*. |
| `maxSupply()`, `MAX_SUPPLY` | `max_supply`, `cap` | `cap` from OZ `FungibleCapped`. |
| `remainingSupply()` | `remaining_supply` | |
| `pause()`, `unpause()` (PAUSER_ROLE) | `pause(caller)`, `unpause(caller)`, `paused` | OZ `Pausable`, owner only. |
| `recoverTokens(token, to, amount)` | `recover_tokens(token, to, amount)` | Owner only. |
| `setContractAuthorization`, `isAuthorizedContract` | — | Dropped: the flag is never read in the Solidity code. |
| `permit`, `nonces`, `DOMAIN_SEPARATOR` (EIP-2612) | — | Not needed: Soroban authorisation lets users sign for `approve`/`transfer` directly. |
| `grantRole`, `revokeRole`, `hasRole`, … | `get_owner`, `transfer_ownership`, `accept_ownership`, `renounce_ownership` | Roles replaced by OZ `Ownable` (two-step transfer). |
| — | `upgrade(new_wasm_hash, operator)` | OZ `Upgradeable`, owner only. |

### NdiFiVault → `ndi_lending`

| Solidity | Soroban | Notes |
|---|---|---|
| `constructor(daiToken, initialOwner)` | `__constructor(owner, asset, name, symbol, deposit_cap, interest_rate)` | Any SEP-41 asset (XLM or USDC via SAC). |
| `asset()` | `query_asset` | OZ `FungibleVault`. |
| `totalAssets()` | `total_assets` | **Idle balance + outstanding debt with interest** (Solidity counts only the balance). |
| `convertToShares`, `convertToAssets` | `convert_to_shares`, `convert_to_assets` | |
| `maxDeposit`, `maxMint`, `maxWithdraw`, `maxRedeem` | `max_deposit`, `max_mint`, `max_withdraw`, `max_redeem` | Return 0 while paused; respect the cap and idle liquidity. |
| `previewDeposit`, `previewMint`, `previewWithdraw`, `previewRedeem` | `preview_deposit`, `preview_mint`, `preview_withdraw`, `preview_redeem` | |
| `deposit(amount, receiver)` | `deposit(assets, receiver, from, operator)` | `operator` must sign. Cap enforced. |
| `mint(shares, receiver)` | `mint(shares, receiver, from, operator)` | Cap enforced (Solidity did not, see §4). |
| `withdraw(assets, receiver, owner)` | `withdraw(assets, receiver, owner, operator)` | |
| `redeem(shares, receiver, owner)` | `redeem(shares, receiver, owner, operator)` | |
| `balanceOf`, `transfer`, … (share token) | SEP-41 share token functions | |
| `stakingCap`, `setStakingCap(newCap)` | `deposit_cap`, `set_deposit_cap(cap)` | Owner only. Cap is on total managed assets. |
| `maintenanceOngoing`, `pauseVault()`, `unpauseVault()` | `paused`, `pause(caller)`, `unpause(caller)` | OZ `Pausable`. |
| `emergencyWithdraw(to, _initialOwner)` | `emergency_withdraw(to)` | Owner only **and only while paused**; sends idle assets to `to`. |
| `emergencyRedeem(from, to)` | — | Dropped, see §3. |
| `authorizedLendingContract`, `setAuthorizedLendingContract(addr)` | `borrower`, `set_borrower(Option<Address>)` | Cannot change while debt is outstanding. |
| `withdrawForLoan(to, amount)` | `borrow(amount)` | Borrower signs; funds go to the borrower; debt is recorded. |
| — | `repay(from, amount)` | New: repayments go back into the vault. |
| `getAvailableLiquidity()` | `available_liquidity` | |
| — | `total_debt`, `interest_rate`, `set_interest_rate(rate)`, `utilization` | New fixed-rate model. |
| — | `get_owner`, `transfer_ownership`, `accept_ownership`, `renounce_ownership`, `upgrade` | OZ `Ownable` / `Upgradeable`. |

### NdiStaking (`NdiFiStaking.sol`) → `ndi_staking`

| Solidity | Soroban | Notes |
|---|---|---|
| `constructor(stakeToken, rewardToken, vault, owner, apy, minStake, maxStake, minDuration)` | `__constructor(owner, stake_token, reward_token, reward_rate, min_stake, max_stake, cooldown)` | No vault; `reward_rate` scaled by 1e7; `cooldown` replaces the hard-coded `WITHDRAW_WAIT`. |
| `stakeToken`, `rewardToken`, `apy`, `minStake`, `maxStake`, `WITHDRAW_WAIT` | `config` | One view returning `Config`. |
| `stake(amount)` | `stake(user, amount)` | |
| `pendingRewards(user)` | `pending_rewards(user)` | Same linear formula. |
| `claimRewards()` | `claim(user)` | |
| `requestWithdrawal()` | `request_unstake(user)` | Returns the time `unstake` becomes available. |
| `executeWithdrawal()` | `unstake(user)` | Returns `(amount, reward)`. |
| `stakes(user)`, `withdrawalRequests(user)` | `get_stake(user)` | Request merged into `StakeInfo.unstake_requested_at`. |
| `totalStaked` | `total_staked` | |
| — | `emergency_withdraw(user)` | New: principal back at any time (even paused), rewards forfeited. |
| — | `fund_rewards(from, amount)`, `reward_pool` | New: explicit reward-pool funding. |
| `getProfits()`, `skimProfits(to)` | — | Dropped with the vault routing. |
| `minDuration` | — | Dropped: never enforced in Solidity. |
| — | `pause`, `unpause`, `paused`, `get_owner`, `transfer_ownership`, `accept_ownership`, `renounce_ownership`, `upgrade` | OZ modules. |

### NdiFiLending → not ported

All functions (`addCollateralToken`, `removeCollateralToken`, `initialize`,
`setCollateralFactor`, `setLiquidationThreshold`, `setOriginationFeeRate`,
`setLiquidationPenalty`, `pause`, `unpause`, `depositCollateral`,
`withdrawCollateral`, `getCollateralValue`, `takeLoan`, `repayLoan`,
`liquidateLoan`, `getLoanValue`, `calculateHealthFactor`, `getLoanDetails`,
`getContractStats`, `isInitialized`, `emergencyWithdraw`) depend on collateral
prices. The borrower hook in `ndi_lending` is the integration point a future
collateral/loan contract would use (`set_borrower` → that contract). See the
Reflector design issue in `WAVE_ISSUES.md`.

## 3. Intentional deviations

| Area | Solidity | Soroban | Why |
|---|---|---|---|
| Language/tooling | Solidity + Foundry | Rust + `soroban-sdk`, `wasm32v1-none` | Stellar runtime. |
| Initialisation | `initialize()` in `NdiFiLending` | `__constructor` everywhere | Contracts can never be left uninitialised. |
| Upgrades | README mentions proxies (none in code) | OZ `Upgradeable` (`upgrade(wasm_hash)`), owner only | Soroban upgrades WASM in place; no proxies. |
| Access control | `Ownable` and `AccessControl` roles | OZ `Ownable` (two-step transfer) | One owner keeps the MVP simple. Roles can come back via `stellar-access` AccessControl. |
| Decimals | 18 | 7 for NDI; vault shares use the asset's decimals | Stellar convention; SAC assets use 7. |
| Amount types | `uint256` | `i128` with checked math, `overflow-checks = true` | SEP-41 standard type. Negative/zero amounts rejected explicitly. |
| Vault asset | DAI only | Any SEP-41 asset set at deploy | XLM or USDC via SAC. |
| Lending model | `withdrawForLoan` moves funds out; `totalAssets` drops; repayments never return to the vault | Borrower debt counts in `total_assets`; fixed APR accrues; `repay` returns funds to the vault | Keeps the share price fair while funds are lent out, and lets depositors earn. |
| Interest | None (only an origination fee in `NdiFiLending`) | Fixed APR, scaled 1e7, simple interest capitalised whenever debt is touched (`borrow`, `repay`, `set_interest_rate`) | Requested fixed-rate model. Frequent touches compound slightly. |
| Deposit cap | Checked in `deposit` only | Checked in `deposit` and `mint`, against total managed assets | Closes the `mint` bypass. |
| Pause | Blocks vault operations | Also makes `max_*` return 0 (ERC-4626/vault-spec behaviour). `repay` and staking `emergency_withdraw` stay open | Users and borrowers can always reduce risk. |
| Emergency withdraw (vault) | Any time, sends to `_initialOwner` | Only while paused, sends to `to` | Fixes the parameter bug and limits misuse. |
| `emergencyRedeem` | Owner forcibly redeems a user | Removed | Needs the user's allowance anyway, and its arguments look swapped (§4). |
| Staking token | DAI-like token deposited into the vault | LP token held by the staking contract | LP token is not the vault asset; avoids the shared-shares bug (§4). |
| Staking rewards | Paid from contract balance; no funding function | `fund_rewards` + `reward_pool` view; stake and reward token must differ | Principal can never be paid out as rewards. |
| Cooldown | Hard-coded 21 days | Constructor argument (deploy script default: 21 days) | Testable and configurable. |
| Emergency exit (staking) | None | `emergency_withdraw` | Principal is never stuck if the reward pool is empty or the reward token is paused. |
| Stake record after exit | Kept with `withdrawn = true` | Deleted | Saves persistent rent; `get_stake` returns `None`. |
| Permit | EIP-2612 | Not needed | Soroban auth framework. |
| Price oracles | Chainlink in `NdiFiLending` | None | Matches the MVP scope. **Reflector** (SEP-40 oracle on Stellar) is the planned option. |
| SafeMath / SafeERC20 | Solidity 0.8 checks, SafeERC20 | `checked_*` ops, release `overflow-checks = true`; SAC/SEP-41 transfers fail loudly | Same safety guarantees. |
| Reentrancy guards | `nonReentrant` | Not needed | Soroban forbids re-entrant contract calls. |

Rewards keep accruing during the unstake cooldown, as in Solidity. This is kept
on purpose but flagged as an open question below.

## 4. Unclear or likely buggy Solidity code (not fixed)

These are observations only; nothing in `src/` was changed.

**NdiFiVault**

1. `emergencyWithdraw(to, _initialOwner)` checks `to != 0` but sends the funds to `_initialOwner`, which is never checked. `to` is otherwise unused.
2. `emergencyRedeem(from, to)` calls `_withdraw(msg.sender, from, to, assets, shares)`. OpenZeppelin's signature is `_withdraw(caller, receiver, owner, …)`, so shares are burned from `to` and assets sent to `from`, the reverse of the names. It also spends `to`'s allowance for the owner, so it is not a forced redeem. The only test uses `from == to` and a prior approval, so it does not catch this.
3. `withdrawForLoan` sends vault assets out, but `totalAssets()` is just the token balance, so the share price drops while funds are lent. Repayments in `NdiFiLending.repayLoan` go to the lending contract, not back to the vault, so depositors permanently lose lent funds.
4. `stakingCap` is enforced in `deposit` but not in `mint`.
5. `maxDeposit`/`maxMint`/`maxWithdraw`/`maxRedeem` are not overridden, so they ignore the cap and the pause flag (ERC-4626 says they should return 0 when blocked).
6. The vault share token is named `NDITOKEN` with symbol `NDI`, the same symbol as `NdiPoint`.
7. `amount <= 0` checks on `uint256` only catch `0`. Events `deposited` and `withdrawSuccessful` are declared but `deposited` is never emitted.

**NdiFiLending**

8. Borrower receives `amount - originationFee` but must repay `principal + originationFee` (= `amount + fee`), so the fee is charged twice.
9. Repayments and liquidation proceeds stay in the lending contract; nothing returns them to the vault.
10. `_getLatestPrice` assumes 8-decimal feeds, casts a possibly negative `int256` to `uint256`, and has no staleness check.
11. `calculateHealthFactor` uses principal only, while liquidation uses principal + fee.
12. During liquidation only the tokens actually seized get `lockedCollateral` reset; other locked collateral may stay locked after the loan is closed.
13. `amountSeized += 0;` is a no-op; `SECONDS_PER_YEAR` is unused (no time-based interest).
14. `totalCollateral` adds raw amounts of different tokens together.
15. `removeCollateralToken` while users hold that collateral drops it from their valuation.
16. Unbounded loops over `supportedCollateralTokenAddresses` in several functions.
17. `emergencyWithdraw` lets the owner take any token, including user collateral.
18. `test/NdiFiLending.t.sol` is a placeholder; the contract has no real tests.

**NdiStaking (`NdiFiStaking.sol`)**

19. **Critical:** `executeWithdrawal` redeems *all* vault shares held by the staking contract (`vault.balanceOf(address(this))`) to the caller, so the first staker to withdraw receives every staker's principal. `testMultipleStakers` never withdraws, so this is not caught.
20. `minDuration` is stored but never enforced.
21. The comment says the reward token "must support minting", but rewards are transferred from the contract balance and there is no funding function.
22. If the vault is paused or at its cap, staking and withdrawals revert, so principal can be locked with no emergency exit.
23. Rewards accrue during the 21-day withdrawal wait.

**NdiPoint**

24. `isAuthorizedContract` is written but never read.
25. `lastRewardClaim` records distributions, not claims.
26. `recoverTokens` ignores the `transfer` return value (no SafeERC20).

**Docs**

27. `README.md` describes Uniswap V3 NFT staking, proxy upgrades and Chainlink; only Chainlink appears in the code.

## 5. Future work: oracles

The MVP has no price oracle. To port `NdiFiLending` (collateralised loans,
health factor, liquidation), the planned source is **Reflector**, a SEP-40
price oracle on Stellar. The design is tracked in `WAVE_ISSUES.md`.

## 6. Open questions for maintainers

- Should rewards stop accruing once `request_unstake` is called?
- Should the staking contract mint NDI (making it the NDI owner/minter) instead of using a funded pool?
- Should `ndi_lending` support several borrowers, or should the future collateral contract be the single borrower?
- Is 100% APR the right upper bound for `set_interest_rate` and the staking `reward_rate`?
- Who should own the contracts on mainnet (multisig account)?
