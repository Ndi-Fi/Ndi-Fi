# Testing Strategy

This guide explains the testing approach across the three layers of the Ndi-Fi protocol: Stellar/Soroban contracts, Solidity contracts, and the frontend. It covers how to run each suite locally and in CI, coverage expectations, and how to write a new test.

---

## Overview

| Layer | Framework | Location | CI job |
|---|---|---|---|
| Stellar/Soroban | Rust + `soroban-sdk` test harness | `stellar/contracts/*/src/test.rs`, `stellar/tests/` | `stellar.yml` |
| Solidity | Foundry (`forge test`) | `test/` | `test.yml` |
| Frontend | (project-specific, see below) | `frontend/` | `test.yml` |

---

## Stellar / Soroban Tests

### Unit Tests

Each contract has a `test` module gated behind `#[cfg(test)]` in `src/test.rs` (e.g., `stellar/contracts/ndi_token/src/test.rs`). These tests use the `soroban-sdk` in-process environment (`Env::default()`) to deploy and exercise one contract at a time.

**Running unit tests:**

```bash
cd stellar
cargo test --locked
```

To run tests for a single contract:

```bash
cargo test --locked -p ndi-token
cargo test --locked -p ndi-lending
cargo test --locked -p ndi-staking
```

To run a single test by name:

```bash
cargo test --locked -p ndi-token token_mints_initial_supply
```

### Integration Tests

`stellar/tests/integration.rs` deploys all three contracts together and runs the main user journeys end to end:

1. `deposit → borrow → accrue interest → repay → withdraw with yield`
2. `stake LP → time passes → claim NDI → request_unstake → cooldown → unstake`

These tests use `e.ledger().set_timestamp(...)` to simulate the passage of time and `e.mock_all_auths()` to bypass auth in the test environment.

**Running integration tests:**

```bash
cd stellar
cargo test --locked -p ndi-tests
```

### Fuzz / Property Tests

The `soroban-sdk` environment does not natively integrate `proptest` or `cargo-fuzz`. Simple parametric coverage is achieved by calling contract functions with boundary values (`0`, `1`, `i128::MAX / 4`, etc.) inside unit tests. See `stellar/contracts/ndi_lending/src/interest.rs` for examples of boundary-value tests on the interest model.

For true fuzz testing, use `cargo-fuzz` on a pure-Rust target that wraps the interest math:

```bash
cargo install cargo-fuzz
cargo fuzz run fuzz_interest
```

Fuzz targets live in `stellar/fuzz/` if present.

### Invariant Tests

Key protocol invariants are expressed as assertions at the end of integration tests (e.g., `total_assets == idle_assets + total_debt`). To add a new invariant, assert it after every state-changing step in `integration.rs`.

---

## Solidity Tests

### Unit Tests

Foundry tests live in `test/` as `.t.sol` files. Each test contract inherits `forge-std/Test.sol` and uses `vm.prank`, `vm.expectEmit`, and `vm.expectRevert` to control state.

**Running tests:**

```bash
forge test -vvv
```

Verbosity flags:
- `-v` — show test names
- `-vv` — show assertion failures
- `-vvv` — show traces on failure
- `-vvvv` — show full traces for all tests

To run a single test file:

```bash
forge test --match-path test/NdiFiVault.t.sol -vvv
```

To run a single test function:

```bash
forge test --match-test test_depositAndWithdraw -vvv
```

### Fuzz Tests

Foundry runs fuzz tests on any test function whose parameters are not fixed. Mark them with `function testFuzz_<name>(uint256 amount)` — Foundry automatically fuzzes the inputs. The default run count is 256; override it in `foundry.toml`:

```toml
[fuzz]
runs = 1000
```

### Invariant Tests

Foundry invariant tests use the `invariant_<name>` naming convention. The test harness calls the contract through a `targetContract` and checks the invariant after every call sequence.

```solidity
function invariant_totalAssetsGEDebt() public {
    assertGe(vault.totalAssets(), vault.totalDebt());
}
```

### Coverage

Generate an HTML coverage report:

```bash
forge coverage --report lcov
genhtml lcov.info -o coverage-report
open coverage-report/index.html
```

**Coverage expectations:** aim for ≥ 90 % line coverage on `src/`. Every new function must have at least one happy-path test and one revert test.

---

## Frontend Tests

The frontend test suite lives in `frontend/`. Run it with:

```bash
cd frontend
npm test
```

For coverage:

```bash
npm run test:coverage
```

Frontend tests cover component rendering, wallet connection mocking, and contract call encoding. They do not make live RPC calls.

---

## Running Everything Together

The CI matrix runs all checks on every push and pull request. To replicate the full CI run locally:

```bash
# Stellar
cd stellar
cargo fmt --all --check
cargo clippy --all-targets --locked -- -D warnings
cargo test --locked
stellar contract build

# Solidity (from repo root)
cd ..
forge fmt --check
forge build --sizes
forge test -vvv

# Frontend
cd frontend
npm run lint
npm run build
```

---

## Writing a New Test

### New Stellar unit test

1. Open (or create) `stellar/contracts/<contract>/src/test.rs`.
2. Add a function inside `mod test`:

```rust
#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn mint_respects_supply_cap() {
        let e = Env::default();
        e.mock_all_auths();
        let owner = Address::generate(&e);
        let id = e.register(NdiToken, (owner.clone(),));
        let client = NdiTokenClient::new(&e, &id);

        // MAX_SUPPLY is already nearly reached; minting one more should fail.
        let result = client.try_mint(&owner, &(MAX_SUPPLY + 1));
        assert!(result.is_err());
    }
}
```

3. Run `cargo test --locked -p ndi-token mint_respects_supply_cap`.

### New Foundry test

1. Open (or create) `test/<ContractName>.t.sol`.
2. Add a test function:

```solidity
function test_depositRevertsOnZeroAmount() public {
    vm.expectRevert(NdiLending.InvalidAmount.selector);
    vault.deposit(0, alice, alice, alice);
}
```

3. Run `forge test --match-test test_depositRevertsOnZeroAmount -vvv`.

---

## CI

The Stellar CI job is defined in [`.github/workflows/stellar.yml`](../.github/workflows/stellar.yml). It runs `fmt → clippy → test → contract build` in sequence. The Solidity CI job is in [`.github/workflows/test.yml`](../.github/workflows/test.yml). Both must pass for a PR to merge.

Coverage is not currently enforced by CI, but the target is ≥ 90 % line coverage on new code.
