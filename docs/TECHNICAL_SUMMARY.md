# Ndi-Fi: Technical Summary for Contributors

This document gives a contributor-oriented overview of the Ndi-Fi codebase:
what each contract does, how the contracts interact, the key design decisions,
and the areas that need the most care when making changes. Read this alongside
`TechnicalAnalysis.md` (detailed per-contract breakdown) and
`docs/stellar/ARCHITECTURE.md` (Stellar/Soroban version).

---

## 1. Repository layout

```
src/                    Solidity contracts (Foundry project)
  NdiPoint.sol          ERC-20 reward/governance token (NDI)
  NdiFiVault.sol        ERC-4626 yield vault
  NdiFiStaking.sol      Single-asset staking with 21-day withdrawal wait
  NdiFiLending.sol      Over-collateralised lending with Chainlink price feeds
  NdiPointIntegrationExample.sol  Integrator demo (not production code)
  testMockDai.sol       Mock DAI for tests

test/                   Foundry test suite
script/                 Deployment scripts (Foundry)
lib/                    Git submodules: OpenZeppelin, Chainlink, forge-std

stellar/                Rust/Soroban contracts (Cargo workspace)
  contracts/
    ndi_token/          SEP-41 reward token
    ndi_lending/        Fungible vault with fixed-APR borrower
    ndi_staking/        LP-token staking with NDI rewards
  tests/                Integration tests
  scripts/              Testnet deploy script

docs/
  stellar/
    ARCHITECTURE.md     Soroban contract design and diagrams
    MIGRATION.md        Solidity→Soroban mapping and known bugs
    WAVE_ISSUES.md      Issue backlog for Wave contributors
```

---

## 2. Solidity contracts at a glance

### NdiPoint (ERC-20 reward token)

`NdiPoint` is the protocol's NDI token. It uses OpenZeppelin's `AccessControl`
for two roles:

| Role | Capability |
|---|---|
| `MINTER_ROLE` | Call `mint` |
| `REWARD_DISTRIBUTOR_ROLE` | Call `distributeRewards` |

The hard supply cap (`MAX_SUPPLY = 1,000,000,000 NDI`) is enforced in both
`mint` and `distributeRewards`. The contract is `Pausable`; transfers and burns
are blocked while paused.

**Key invariants to preserve:**
- `totalSupply() <= MAX_SUPPLY` at all times.
- `mint` and `distributeRewards` are `nonReentrant`.
- `distributeRewards` is atomic: it either mints to every recipient or reverts entirely.

### NdiFiVault (ERC-4626 yield vault)

`NdiFiVault` holds the protocol's liquidity. It follows the ERC-4626 tokenised
vault standard, so depositors receive share tokens that appreciate as yield
accrues.

The vault's only yield source is the lending contract: `withdrawForLoan` lets
the single authorised lender pull liquidity. This creates the core coupling:

```
User → deposit(DAI) → NdiFiVault → withdrawForLoan → NdiFiLending → borrower
```

**Configuration knobs (owner-only):**
- `setStakingCap(uint256)` — total asset ceiling.
- `setAuthorizedLendingContract(address)` — the one address allowed to call `withdrawForLoan`.
- `pauseVault()` / `unpauseVault()` — block deposits and withdrawals.
- `emergencyWithdraw(address to, address)` — drain assets to `to` (note the
  second parameter is unused; see `docs/stellar/MIGRATION.md §4` item 1).

**Known issues to be aware of** (do not introduce the same patterns):
- `totalAssets()` falls when `withdrawForLoan` moves funds out, so depositors
  bear loan losses. The Soroban version fixes this.
- `stakingCap` is not enforced by `mint`, only by `deposit`.

### NdiFiStaking

Users stake a designated ERC-20 token; the contract immediately deposits it
into `NdiFiVault` and records the user's vault shares. Rewards are paid in a
separate reward token held in the contract's balance.

The two-step withdrawal (`requestWithdrawal` → 21-day wait → `executeWithdrawal`)
protects protocol liquidity from sudden exits.

**Critical known bug** (do not copy this pattern):
`executeWithdrawal` redeems `vault.balanceOf(address(this))` — the total shares
held by the staking contract — to the caller. The first withdrawer therefore
receives every staker's principal. Any refactor of this contract must fix this.

### NdiFiLending

The most complex contract. Users deposit collateral (priced by Chainlink feeds),
take loans of the vault's underlying token (DAI), and repay a fixed origination
fee. The owner is the only liquidator.

The health factor formula:

```
healthFactor = (collateralValue × liquidationThreshold) / (100 × loanValue)
```

A health factor below 100 triggers liquidation.

**Key parameters set by `initialize()`:**

| Parameter | Meaning | Constraint |
|---|---|---|
| `collateralFactor` | Max borrow as % of collateral value | 1–99 |
| `liquidationThreshold` | HF numerator threshold | > `collateralFactor` |
| `originationFeeRate` | One-time fee in basis points | ≤ 1000 (10%) |
| `liquidationPenalty` | Bonus collateral seized on liquidation | ≤ 2000 (20%) |

**Known issues** (documented in `docs/stellar/MIGRATION.md §4`):
- The origination fee is charged twice (items 8).
- Repayments stay in the lending contract, not the vault (item 9).
- No oracle staleness check (item 10).
- Unbounded loops over collateral tokens (item 16).

---

## 3. Contract interaction diagram

```
                        ┌──────────────┐
                        │  NdiPoint    │
                        │  (NDI token) │
                        └──────┬───────┘
                               │  mint / distributeRewards
                               ▼
   User ──deposit──▶ ┌──────────────────┐ ◀── withdrawForLoan ── ┌───────────────┐
                     │   NdiFiVault     │                         │ NdiFiLending  │
   User ◀─withdraw── │  (ERC-4626)      │ ──► shares              │               │
                     └──────────────────┘                         │  Chainlink    │
                               ▲                                  │  price feeds  │
                               │  deposit / redeem shares         └───────────────┘
                     ┌─────────┴────────┐
                     │  NdiFiStaking    │
                     │  (21-day wait)   │
                     └──────────────────┘
```

---

## 4. Soroban contracts at a glance

The Soroban implementation in `stellar/` is a parallel, Rust-based version of
the protocol. It does not replace the Solidity contracts; both coexist in the
repository.

| Soroban contract | Solidity equivalent | Key difference |
|---|---|---|
| `ndi_token` | `NdiPoint` | 7 decimals, `Ownable` instead of `AccessControl` |
| `ndi_lending` | `NdiFiVault` + interest model | Tracks debt separately; share price stays fair when funds are lent out |
| `ndi_staking` | `NdiFiStaking` | LP-token staking; explicit `fund_rewards`; fixes the shared-shares bug |

`NdiFiLending` is not ported (oracle dependency). See `WAVE_ISSUES.md` issue 13
for the planned Reflector oracle integration.

For the full function-by-function mapping see `docs/stellar/MIGRATION.md`.
For the architecture diagram see `docs/stellar/ARCHITECTURE.md`.

---

## 5. Development workflow

### Solidity (Foundry)

```bash
# Install dependencies (git submodules)
git submodule update --init --recursive

# Build
forge build

# Run tests
forge test

# Run a specific test
forge test --match-test testStakeAndWithdraw -vvv
```

### Soroban (Rust)

```bash
cd stellar

# Build all contracts to WASM
stellar contract build

# Run all tests (unit + integration)
cargo test

# Run tests for one contract
cargo test -p ndi-lending

# Lint
cargo fmt --all --check
cargo clippy --all-targets -- -D warnings

# Deploy to testnet
./scripts/deploy_testnet.sh
```

---

## 6. Areas that need the most care

### Oracle calls in NdiFiLending

`_getLatestPrice` casts `int256 → uint256` without checking for negative
values, and assumes exactly 8 decimal places with no staleness check. Any
change to price-feed handling must address all three issues.

### Shared vault shares in NdiFiStaking

The staking contract tracks each user's principal as a number of DAI-tokens
staked, but it deposits all principal into the vault under a single address
(the staking contract). `executeWithdrawal` redeems the full contract balance
instead of each user's pro-rata share. Any change to the withdrawal path must
introduce per-user share accounting.

### Re-entrancy surface

`NdiFiLending.takeLoan` calls `vault.withdrawForLoan` after updating state.
`NdiFiVault.withdrawForLoan` calls `IERC20.transfer`. The `nonReentrant` guard
on `takeLoan` protects the lending contract, but the vault itself has no
re-entrancy guard. Keep this in mind when modifying either contract.

### Gas costs and unbounded loops

`NdiFiLending` iterates over `supportedCollateralTokenAddresses` in
`getCollateralValue`, `takeLoan`, `repayLoan`, and `liquidateLoan`. The
insertion sort in `_sortCollateral` is O(n²). Adding more collateral types
increases gas costs linearly in read functions and quadratically in `_sortCollateral`.
Keep the supported collateral list short, or refactor to a bounded approach.

---

## 7. Key invariants to test

When writing or reviewing tests, verify these properties:

**Token supply**
- `NdiPoint.totalSupply() <= NdiPoint.MAX_SUPPLY` after any mint.

**Vault share accounting**
- Shares minted on deposit match `previewDeposit` output.
- Shares redeemed on withdrawal match `previewWithdraw` output.
- Deposits above `stakingCap` revert.

**Lending health factor**
- A loan taken at the maximum collateral factor should start with a health
  factor at or above 100.
- Reducing collateral below the liquidation threshold should drop the health
  factor below 100.

**Staking withdrawal**
- A user cannot call `executeWithdrawal` before the 21-day wait expires.
- Calling `executeWithdrawal` returns exactly the principal staked by that
  user, not more.

---

## 8. Where to get help

- `README.md` — project overview and feature summary.
- `TechnicalAnalysis.md` — detailed per-contract analysis.
- `docs/stellar/ARCHITECTURE.md` — Soroban architecture diagrams.
- `docs/stellar/MIGRATION.md` — Solidity→Soroban mapping and known bugs.
- `CONTRIBUTING.md` — contribution guidelines and branch naming conventions.
- GitHub Issues — open tasks and feature requests.
