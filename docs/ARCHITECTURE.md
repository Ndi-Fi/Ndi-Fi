# Ndi-Fi Solidity Architecture

Consolidated reference for the EVM smart-contract stack. For the Stellar/Soroban
counterparts see [`docs/stellar/ARCHITECTURE.md`](stellar/ARCHITECTURE.md).

Related docs:
[`VAULT_ERC4626.md`](VAULT_ERC4626.md) · [`ORACLE.md`](ORACLE.md) ·
[`UPGRADEABILITY.md`](UPGRADEABILITY.md) · [`AUDIT_READINESS.md`](AUDIT_READINESS.md) ·
[`stellar/MIGRATION.md`](stellar/MIGRATION.md)

---

## 1. Contract overview

| Contract | Source | Purpose |
|---|---|---|
| `NdiFiVault` | [`src/NdiFiVault.sol`](../src/NdiFiVault.sol) | ERC-4626 single-asset vault (DAI). Accepts deposits, issues NDI shares, provides liquidity to the lending contract, and enforces a staking cap and maintenance pause. |
| `NdiFiLending` | [`src/NdiFiLending.sol`](../src/NdiFiLending.sol) | Collateralised lending. Borrowers deposit ERC-20 collateral, take DAI loans sized by collateral factor, repay principal + origination fee, and are liquidated below threshold. |
| `NdiFiStaking` | [`src/NdiFiStaking.sol`](../src/NdiFiStaking.sol) | Fixed-APY token staking. Users stake into the vault for a minimum duration, earn NdiPoint rewards, and withdraw after a 21-day unbonding window. |
| `NdiPoint` | [`src/NdiPoint.sol`](../src/NdiPoint.sol) | ERC-20 reward-points token (1 B max supply). Role-based minting, batch reward distribution, EIP-2612 permit, pausable. |
| `testMockDai` | [`src/testMockDai.sol`](../src/testMockDai.sol) | Test-only mintable DAI mock. Never deployed to production. |

---

## 2. Role and permission model

```
Owner (EOA / multisig — planned)
├── NdiFiVault
│   ├── pauseVault / unpauseVault
│   ├── setStakingCap
│   ├── setAuthorizedLendingContract
│   ├── emergencyWithdraw
│   └── emergencyRedeem
├── NdiFiLending
│   ├── initialize (one-time)
│   ├── addCollateralToken / removeCollateralToken
│   ├── setCollateralFactor / setLiquidationThreshold
│   ├── setOriginationFeeRate / setLiquidationPenalty
│   ├── pause / unpause
│   ├── liquidateLoan  (owner = liquidator in current design)
│   └── emergencyWithdraw
└── NdiFiStaking
    └── skimProfits

NdiPoint — AccessControl roles
├── DEFAULT_ADMIN_ROLE   → manages roles, authorises contracts, recovers tokens
├── MINTER_ROLE          → mint (up to MAX_SUPPLY)
├── PAUSER_ROLE          → pause / unpause transfers
└── REWARD_DISTRIBUTOR_ROLE → distributeReward / distributeRewards

Authorised lending contract (set by vault owner)
└── NdiFiVault.withdrawForLoan  (pull DAI for loan distribution)
```

> **Trust assumption:** today all owner roles are single EOAs.
> A multisig upgrade is planned — see [`UPGRADEABILITY.md`](UPGRADEABILITY.md).

---

## 3. Data flow diagrams

### 3.1 Vault — deposit and withdraw

```
  Depositor
     │
     │ deposit(amount, receiver)
     ▼
 NdiFiVault
  ┌─────────────────────────────────────────┐
  │  1. check not paused                    │
  │  2. check totalAssets + amount ≤ cap    │
  │  3. ERC-4626: mint shares to receiver   │
  │  4. transfer DAI from depositor to vault│
  └─────────────────────────────────────────┘
     │
     │ NDI shares (ERC-20)
     ▼
  Depositor wallet

  To withdraw:
  Depositor → withdraw(assets, receiver, owner)
           ← burn shares, transfer DAI to receiver
```

### 3.2 Lending — borrow flow

```
  Borrower
     │
     ├─ 1. depositCollateral(token, amount) ──► NdiFiLending
     │                                            stores collateralBalances[user][token]
     │
     ├─ 2. takeLoan(amount) ──────────────────► NdiFiLending
     │       │  a. getCollateralValue()           reads Chainlink feeds
     │       │  b. check requestedValue ≤ maxLoanValue (collateralFactor %)
     │       │  c. lock proportional collateral   lockedCollateral[user][token]
     │       │  d. vault.withdrawForLoan(borrower, netAmount)
     │       │                                 │
     │       │                                 ▼
     │       │                           NdiFiVault
     │       │                           transfers DAI to borrower
     │       └─ Loan struct created: principal, originationFee, collateralAmount
     │
     └─ 3. repayLoan(totalDebt)
              transfer DAI from borrower → NdiFiLending
              unlock collateral, clear loan

  Liquidation path (health factor < 100):
  Liquidator → liquidateLoan(borrower)
             repay debt + penalty in DAI
             receive seized collateral tokens
```

### 3.3 Staking flow

```
  Staker
     │
     ├─ stake(amount)
     │    safeTransferFrom staker → NdiStaking
     │    NdiStaking deposits amount → NdiFiVault (gets vault shares)
     │    StakeInfo recorded
     │
     ├─ claimRewards()
     │    pendingRewards = amount × APY × elapsed / (100 × 365 days)
     │    rewardToken (NdiPoint) transferred to staker
     │
     ├─ requestWithdrawal()          starts 21-day unbonding
     │
     └─ executeWithdrawal()          after 21 days
          vault.redeem(shares → staker)
          final rewards paid in NdiPoint
```

### 3.4 NdiPoint reward distribution

```
  REWARD_DISTRIBUTOR_ROLE holder
     │
     ├─ distributeReward(recipient, amount, reason)
     │    _mint(recipient, amount)   — single recipient
     │
     └─ distributeRewards(recipients[], amounts[], reason)
          batch _mint                — gas-efficient batch
```

---

## 4. Contract interactions (call graph)

```
NdiStaking ──── vault.deposit(amount, this) ────────► NdiFiVault
NdiStaking ──── vault.redeem(shares, staker, this) ──► NdiFiVault
NdiStaking ──── rewardToken.safeTransfer(user, r) ───► NdiPoint (ERC-20 transfer)

NdiFiLending ── vault.withdrawForLoan(borrower, n) ──► NdiFiVault
NdiFiLending ── priceFeed.latestRoundData() ──────────► Chainlink AggregatorV3
NdiFiLending ── ERC20(token).decimals() ─────────────► collateral ERC-20 tokens
```

---

## 5. Key invariants

These invariants must hold at all times outside of admin emergency paths:

| # | Invariant | Contract |
|---|---|---|
| V1 | `sum(shareBalances) == totalSupply()` | NdiFiVault |
| V2 | `totalAssets() == DAI.balanceOf(vault)` (falls while loans are outstanding — documented deviation) | NdiFiVault |
| V3 | A depositor's `withdraw` returns at least as many assets as they deposited (no fee, no loss except through `withdrawForLoan`) | NdiFiVault |
| V4 | `stakingCap` is never exceeded by `deposit` (note: `mint` currently bypasses this — MIGRATION §4 item 4) | NdiFiVault |
| L1 | `lockedCollateral[user][token] ≤ collateralBalances[user][token]` for every user/token | NdiFiLending |
| L2 | Every active loan has locked collateral whose value at origination ≥ `principal × 100 / collateralFactor` | NdiFiLending |
| L3 | `liquidateLoan` never seizes more value than `debt + penalty` and never touches other users' collateral | NdiFiLending |
| L4 | Health factor math and liquidation threshold math use the same price/decimal logic | NdiFiLending |
| S1 | Total rewards paid ≤ NdiPoint balance held by NdiStaking at the time of claim | NdiStaking |
| S2 | `vault.redeem` on `executeWithdrawal` returns exactly the staker's principal (critical bug §4 item 19 must be fixed before mainnet) | NdiStaking |
| P1 | `totalSupply() ≤ MAX_SUPPLY` at all times | NdiPoint |

---

## 6. Trust assumptions

1. **Oracle feeds** — price data comes from Chainlink `AggregatorV3Interface`. A stale, manipulated, or incorrect feed can cause mis-liquidations. See [`ORACLE.md`](ORACLE.md) for per-feed staleness configuration and fallback policy.
2. **Admin keys** — `onlyOwner` and role-based functions are gated on single EOAs today. Compromise of an owner key allows pausing the vault, draining via `emergencyWithdraw`, or changing the lending contract address. A multisig is planned.
3. **Authorised lending contract** — once set via `setAuthorizedLendingContract`, this address can pull arbitrary amounts of DAI from the vault up to its balance. It must be a trusted, audited contract.
4. **ERC-20 collateral tokens** — the protocol assumes collateral tokens are standard ERC-20 with correct `decimals()` and no fee-on-transfer or rebasing behaviour. Non-standard tokens must be evaluated individually before being added via `addCollateralToken`.
5. **Vault share price** — there is no slippage protection on `deposit`/`mint`. A large `withdrawForLoan` between a user's preview and their transaction can reduce the shares they receive. See [`VAULT_ERC4626.md`](VAULT_ERC4626.md) §5.
6. **NdiPoint supply** — the `MINTER_ROLE` and `REWARD_DISTRIBUTOR_ROLE` can mint up to 1 B tokens. These roles must be held by audited contracts or a trusted multisig.

---

## 7. Known issues (triage status)

The following issues from `docs/stellar/MIGRATION.md` §4 affect the Solidity
contracts. Each entry links to the source document for the full description.

| Item | Description | Severity | Status |
|---|---|---|---|
| §4-1 | `emergencyWithdraw(to, _initialOwner)` ignores `to`; funds go to `_initialOwner` | Medium | Open |
| §4-2 | `emergencyRedeem` parameter order is reversed (assets go to `from`, not `to`) | Medium | Open |
| §4-3 | Loan repayments stay in `NdiFiLending`, never return to vault — share price drop is permanent | High | Open |
| §4-4 | `mint()` bypasses `stakingCap` | Low | Open |
| §4-5 | `maxDeposit`/`maxMint`/`maxWithdraw`/`maxRedeem` ignore pause flag and cap | Low | Open |
| §4-8 | Origination fee charged twice (on gross amount, then deducted from net) | High | Open |
| §4-11 | Health factor and liquidation threshold math are inconsistent | High | Open |
| §4-19 | `NdiStaking.executeWithdrawal` redeems ALL vault shares, draining other stakers | Critical | Open |
| §4-27 | `README.md` describes Uniswap V3 staking and proxies that do not exist | Low | Open |

All items must be triaged (fix or accept with rationale) before an external
audit. See [`AUDIT_READINESS.md`](AUDIT_READINESS.md) §6.

---

## 8. Upgradeability

No proxy pattern is currently used. All contracts are deployed as immutable
implementations. Admin functions (pause, cap changes, parameter updates) provide
operational flexibility without upgradeability. The governance roadmap targets
a transparent proxy or UUPS pattern for a future release.

See [`UPGRADEABILITY.md`](UPGRADEABILITY.md) for the full upgrade plan, key
management guidance, and per-contract admin power matrix.

---

## 9. External dependencies

| Dependency | Version pin | Usage |
|---|---|---|
| OpenZeppelin Contracts | `lib/openzeppelin-contracts` (submodule) | ERC-4626, ERC-20, Ownable, ReentrancyGuard, Pausable, AccessControl, SafeERC20 |
| Chainlink Brownie Contracts | `lib/chainlink-brownie-contracts` (submodule) | `AggregatorV3Interface` price feeds |
| prb-math | `lib/prb-math` (submodule) | Fixed-point math (available; not yet used in core contracts) |
| Uniswap v3-core / v3-periphery | `lib/v3-core`, `lib/v3-periphery` (submodules) | Referenced in README; not used by current contracts |
| forge-std | `lib/forge-std` (submodule) | Test utilities only |

---

## 10. Source file and interface index

```
src/
├── NdiFiVault.sol          ERC-4626 vault — deposit, withdraw, mint, redeem,
│                           withdrawForLoan, emergencyWithdraw, emergencyRedeem
├── NdiFiLending.sol        Collateralised lending — depositCollateral,
│                           withdrawCollateral, takeLoan, repayLoan,
│                           liquidateLoan, calculateHealthFactor, getLoanDetails
├── NdiFiStaking.sol        Fixed-APY staking — stake, claimRewards,
│                           requestWithdrawal, executeWithdrawal, skimProfits
├── NdiPoint.sol            Reward-points ERC-20 — mint, distributeReward,
│                           distributeRewards, pause, unpause, recoverTokens
├── NdiPointIntegrationExample.sol
│                           Example of how to integrate NdiPoint rewards
└── testMockDai.sol         Test-only mock (never deployed)

test/
├── NdiFiVault.t.sol        27 Foundry tests (all passing)
├── NdiFiLending.t.sol      (placeholder — full suite pending)
├── NdiFiStaking.t.sol      Staking tests (critical withdrawal bug open)
├── NdiPoint.t.sol          NdiPoint unit tests
└── Placeholder.t.sol       Stub

script/
└── DeployNdiPoint.s.sol    Foundry deployment script for NdiPoint
```
