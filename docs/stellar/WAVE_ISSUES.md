# Stellar Wave: draft issue backlog

Draft issues for maintainers to post on GitHub with the **Wave task** template
(`.github/ISSUE_TEMPLATE/wave-task.md`). Each one is self-contained. Suggested
labels: `stellar`, `wave`, plus `trivial` / `medium` / `high`.

Reminder for every issue: *Do not start work until a maintainer assigns the
issue to you. Comment on the issue to express interest. PRs must include
`Closes #<issue>`.*

| # | Title | Complexity |
|---|---|---|
| 1 | Add CLI usage examples to `stellar/README.md` | Trivial |
| 2 | Test NdiToken `burn_from` and expired allowances | Trivial |
| 3 | Test negative amounts in all three contracts | Trivial |
| 4 | Write an error-code reference page | Trivial |
| 5 | Test lending deposits through an asset allowance | Trivial |
| 6 | Assert every custom event in tests | Medium |
| 7 | Add position/status view functions | Medium |
| 8 | Verify and centralise TTL handling | Medium |
| 9 | Make the deploy script network-aware and idempotent | Medium |
| 10 | Add a local-network smoke test script | Medium |
| 11 | Add a max-utilisation guard to `borrow` | Medium |
| 12 | Staking reward accounting: top-ups, rate changes and pool shortfalls | High |
| 13 | Design: Reflector oracle integration for collateralised loans | High |
| 14 | Upgrade and storage-migration tests for all contracts | High |

---

## 1. Add CLI usage examples to `stellar/README.md`

**Summary**
Document how to call each contract with the `stellar` CLI after a testnet deploy.

**Context**
`stellar/README.md` explains build, test and deploy, but not how to use the deployed contracts. New contributors and testers need copy-paste commands.

**Acceptance criteria**
- [ ] A "Using the contracts" section with one example per main function: `deposit`, `withdraw`, `borrow`, `repay`, `stake`, `claim`, `request_unstake`, `unstake`, `emergency_withdraw`, `fund_rewards`, `distribute_reward`.
- [ ] Examples read contract IDs from `deployments/testnet.json` (for example with `jq`).
- [ ] Amounts explained in stroops (7 decimals).
- [ ] No secret keys in examples; use identity names.

**Files likely involved**
`stellar/README.md`

**Complexity**
Trivial

**How to test**
Follow the examples against a fresh testnet deployment from `scripts/deploy_testnet.sh`.

**Resources**
- https://developers.stellar.org/docs/tools/cli/stellar-cli
- `docs/stellar/ARCHITECTURE.md`

---

## 2. Test NdiToken `burn_from` and expired allowances

**Summary**
Add unit tests for `burn_from` and for allowances that expire at `live_until_ledger`.

**Context**
`ndi_token` tests cover `burn` and `transfer_from`, but not `burn_from` or allowance expiry.

**Acceptance criteria**
- [ ] Test: `burn_from` with enough allowance burns and reduces both allowance and total supply.
- [ ] Test: `burn_from` above the allowance fails.
- [ ] Test: `transfer_from` fails after the ledger sequence passes `live_until_ledger`.
- [ ] Test: `burn_from` is blocked while paused.

**Files likely involved**
`stellar/contracts/ndi_token/src/test.rs`

**Complexity**
Trivial

**How to test**
`cd stellar && cargo test -p ndi-token`

**Resources**
- SEP-41: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md
- `soroban_sdk::testutils::Ledger::set_sequence_number`

---

## 3. Test negative amounts in all three contracts

**Summary**
Make sure every function that takes an `i128` amount rejects negative values with the right error.

**Context**
Amounts are `i128`. The contracts check `amount <= 0`, but tests only use `0`.

**Acceptance criteria**
- [ ] Tests pass `-1` to: token `mint`, `distribute_reward`, `distribute_rewards`, `recover_tokens`; lending `deposit`, `mint`, `withdraw`, `redeem`, `borrow`, `repay`, `set_deposit_cap`, `set_interest_rate`; staking `stake`, `fund_rewards`.
- [ ] Each test asserts the exact error code, not just `is_err()`.
- [ ] No contract changes unless a test reveals a bug (describe it in the PR).

**Files likely involved**
`stellar/contracts/*/src/test.rs`

**Complexity**
Trivial

**How to test**
`cd stellar && cargo test`

**Resources**
`stellar/contracts/*/src/errors.rs`

---

## 4. Write an error-code reference page

**Summary**
Create `docs/stellar/ERRORS.md` listing every error code users can hit, with a plain-English cause and fix.

**Context**
Wallets and frontends show raw codes like `Error(Contract, #4)`. Each contract has its own enum, and OpenZeppelin modules add more (100+, 400+, 1000+, 1500+, 2100+).

**Acceptance criteria**
- [ ] One table per contract: code, name, when it happens, what the caller should do.
- [ ] A section for the OpenZeppelin codes these contracts can return (fungible, vault, pausable, ownable, math).
- [ ] Linked from `stellar/README.md`.

**Files likely involved**
`docs/stellar/ERRORS.md` (new), `stellar/README.md`

**Complexity**
Trivial

**How to test**
Review against `errors.rs` files and the OpenZeppelin `stellar-tokens`, `stellar-access` and `stellar-contract-utils` 0.8.0 sources.

**Resources**
https://github.com/OpenZeppelin/stellar-contracts

---

## 5. Test lending deposits through an asset allowance

**Summary**
Test the `deposit`/`mint` path where `operator != from` (the operator spends `from`'s asset allowance).

**Context**
OpenZeppelin's `deposit_internal` uses `transfer_from` when the operator is not the payer. Current tests only cover `operator == from`.

**Acceptance criteria**
- [ ] Test: `from` approves `operator` on the asset; `operator` deposits for `receiver`; balances and allowance update correctly.
- [ ] Test: same call without allowance fails.
- [ ] Test: `mint` through the same path.

**Files likely involved**
`stellar/contracts/ndi_lending/src/test.rs`

**Complexity**
Trivial

**How to test**
`cd stellar && cargo test -p ndi-lending`

**Resources**
`stellar-tokens` 0.8.0 `vault/storage.rs` (`deposit_internal`)

---

## 6. Assert every custom event in tests

**Summary**
Add tests that check the exact payload of every event Ndi-Fi code emits.

**Context**
Some events are already asserted (`Staked`, `RewardClaimed`, `Unstaked`, `EmergencyWithdrawn` in staking; `Borrowed`, `Repaid` in lending; `RewardDistributed` in the token). Others are not: `BorrowerUpdated`, `DepositCapUpdated`, `InterestRateUpdated`, lending `EmergencyWithdrawn`, `UnstakeRequested`, `RewardsFunded`, `TokensRecovered`. Indexers depend on these.

**Acceptance criteria**
- [ ] One test per missing event, using `Event::to_xdr` and `env.events().all()`.
- [ ] Topics and data match the struct definitions.
- [ ] Also assert OpenZeppelin `Paused`/`Unpaused` are emitted by each contract's `pause`/`unpause`.
- [ ] Document the event list in `docs/stellar/ARCHITECTURE.md` if anything changes.

**Files likely involved**
`stellar/contracts/*/src/test.rs`, possibly `docs/stellar/ARCHITECTURE.md`

**Complexity**
Medium

**How to test**
`cd stellar && cargo test`

**Resources**
`soroban_sdk::testutils::Events`, existing event tests in `ndi_staking/src/test.rs`

---

## 7. Add position/status view functions

**Summary**
Add read-only helpers so a frontend can load a user's position in one call.

**Context**
Today a UI needs several calls (`balance`, `convert_to_assets`, `max_withdraw`, `get_stake`, `pending_rewards`, …).

**Acceptance criteria**
- [ ] `ndi_lending::position(user) -> Position { shares, assets, max_withdraw, max_redeem }`.
- [ ] `ndi_staking::status(user) -> Option<StakeStatus { amount, pending_rewards, unstake_available_at: Option<u64>, can_unstake: bool }>`.
- [ ] New structs are `#[contracttype]` with `///` docs.
- [ ] Unit tests for each view, including empty positions and paused state.
- [ ] `docs/stellar/MIGRATION.md` function table updated.

**Files likely involved**
`stellar/contracts/ndi_lending/src/contract.rs`, `stellar/contracts/ndi_staking/src/contract.rs`, their `test.rs`, `docs/stellar/MIGRATION.md`

**Complexity**
Medium

**How to test**
`cd stellar && cargo test`

**Resources**
`docs/stellar/ARCHITECTURE.md`

---

## 8. Verify and centralise TTL handling

**Summary**
Prove with tests that storage TTLs are extended as intended, and move the TTL constants into one place per contract.

**Context**
Each contract defines its own `DAY_IN_LEDGERS` and threshold constants and extends TTL inline. Nothing tests that entries actually stay alive.

**Acceptance criteria**
- [ ] Tests use `env.as_contract` + `storage().instance().get_ttl()` / `persistent().get_ttl(&key)` to check TTLs after `stake`, `claim`, `distribute_reward`, `deposit`, `borrow`.
- [ ] Test: advance the ledger close to expiry, call a function, confirm TTL was bumped.
- [ ] TTL constants live in one `ttl.rs` (or similar) module per crate, documented.
- [ ] Short "Storage rent" section in `stellar/README.md` explaining who pays to extend entries.

**Files likely involved**
`stellar/contracts/*/src/contract.rs`, new `ttl.rs` modules, `test.rs`, `stellar/README.md`

**Complexity**
Medium

**How to test**
`cd stellar && cargo test`

**Resources**
https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival

---

## 9. Make the deploy script network-aware and idempotent

**Summary**
Improve `scripts/deploy_testnet.sh` so it can target other networks and does not redeploy by accident.

**Context**
The script only targets testnet and always deploys three new contracts.

**Acceptance criteria**
- [ ] `--network <testnet|futurenet|local>` flag (default `testnet`); output goes to `deployments/<network>.json`. Mainnet is refused.
- [ ] If the output file exists, the script stops unless `--force` is passed.
- [ ] Optional `--fund-rewards <stroops>` calls `fund_rewards` after deploy.
- [ ] Uploads each WASM once (`stellar contract upload`) and deploys by hash.
- [ ] Still never prints or writes secret keys; `shellcheck` passes.

**Files likely involved**
`stellar/scripts/deploy_testnet.sh` (or a renamed `deploy.sh`), `stellar/README.md`

**Complexity**
Medium

**How to test**
Run against testnet twice (second run must stop), then with `--force`. Run `shellcheck`.

**Resources**
https://developers.stellar.org/docs/tools/cli/stellar-cli

---

## 10. Add a local-network smoke test script

**Summary**
A script that starts a local Stellar network (quickstart Docker image), deploys all contracts and runs one deposit/borrow/repay/withdraw and one stake/claim/unstake through the CLI.

**Context**
Unit and integration tests use the Rust test environment. Nothing exercises the real WASM through RPC.

**Acceptance criteria**
- [ ] `stellar/scripts/smoke_local.sh` starts `stellar container start local` (or the quickstart image), deploys, runs both flows, and exits non-zero on any failure.
- [ ] Uses short cooldowns so it finishes in a few minutes.
- [ ] Optional CI job (manual trigger) that runs it.

**Files likely involved**
`stellar/scripts/smoke_local.sh` (new), optionally `.github/workflows/stellar.yml`

**Complexity**
Medium

**How to test**
Run the script locally with Docker installed.

**Resources**
https://developers.stellar.org/docs/tools/quickstart

---

## 11. Add a max-utilisation guard to `borrow`

**Summary**
Let the owner cap how much of the vault can be lent out, so depositors always have some withdrawal liquidity.

**Context**
Today the borrower can draw every idle asset, which blocks all withdrawals until repayment.

**Acceptance criteria**
- [ ] New instance setting `max_utilization` (scaled 1e7), set in the constructor and via owner-only `set_max_utilization`, with an event.
- [ ] `borrow` fails with a new `UtilizationTooHigh` error if utilisation after the borrow would exceed the limit.
- [ ] Tests: at the limit, just above, owner-only setter, invalid values.
- [ ] Docs (`MIGRATION.md`, `ARCHITECTURE.md`) and deploy script updated.

**Files likely involved**
`stellar/contracts/ndi_lending/src/{contract.rs,errors.rs,interest.rs,test.rs}`, `stellar/scripts/deploy_testnet.sh`, docs

**Complexity**
Medium

**How to test**
`cd stellar && cargo test -p ndi-lending`

**Resources**
`ndi_lending/src/interest.rs` (`utilization`)

---

## 12. Staking reward accounting: top-ups, rate changes and pool shortfalls

**Summary**
Rework staking rewards to use a reward-per-token accumulator so users can add to a stake, the owner can change the rate safely, and payouts behave well when the pool runs low.

**Context**
`ndi_staking` allows one stake per user and a fixed rate set at deploy. If the pool cannot cover a claim, `claim` and `unstake` fail and users must use `emergency_withdraw`, losing rewards.

**Acceptance criteria**
- [ ] `stake` can add to an existing stake without losing accrued rewards.
- [ ] Owner-only `set_reward_rate` that settles rewards at the old rate first.
- [ ] Rewards owed but not payable are recorded and paid later instead of blocking `unstake`.
- [ ] Decide and document whether rewards stop at `request_unstake`.
- [ ] Tests: top-up mid-period, rate change mid-period, empty pool then refill, many users with rounding (sum of payouts never exceeds funded rewards), very small and very large stakes.
- [ ] Storage changes documented, with an upgrade path for existing stakes (see issue 14).

**Files likely involved**
`stellar/contracts/ndi_staking/src/*`, `stellar/tests/integration.rs`, `docs/stellar/*`

**Complexity**
High

**How to test**
`cd stellar && cargo test`. Add property-style tests (random sequences of stake/claim/unstake) if possible.

**Resources**
- Synthetix StakingRewards accumulator pattern
- `docs/stellar/MIGRATION.md` §6 (open questions)

---

## 13. Design: Reflector oracle integration for collateralised loans

**Summary**
Write a design document for porting `NdiFiLending` (collateral, health factor, liquidation) to Soroban using the Reflector price oracle.

**Context**
`NdiFiLending.sol` uses Chainlink and was not ported because oracles were out of scope for the MVP. `MIGRATION.md` §4 lists several bugs in that contract that the port must not copy.

**Acceptance criteria**
- [ ] `docs/stellar/ORACLE_DESIGN.md` covering: Reflector feed selection (SEP-40 interface), decimals handling, staleness and deviation checks, fallback when a price is missing.
- [ ] Proposed contract layout: a collateral/loan contract acting as the `ndi_lending` borrower, or another design with reasons.
- [ ] Health factor and liquidation formulas in fixed-point integer math, with worked examples.
- [ ] How each Solidity issue from `MIGRATION.md` §4 (items 8–17) is avoided.
- [ ] Testing strategy using a mock oracle contract.
- [ ] No production code required; a small prototype is optional.

**Files likely involved**
`docs/stellar/ORACLE_DESIGN.md` (new)

**Complexity**
High

**How to test**
Maintainer review. If a prototype is included, `cargo test` must pass.

**Resources**
- https://reflector.network
- SEP-40: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0040.md
- `src/NdiFiLending.sol`

---

## 14. Upgrade and storage-migration tests for all contracts

**Summary**
Prove that each contract can be upgraded in place without losing state, and set up a pattern for future storage migrations.

**Context**
All three contracts expose OpenZeppelin `upgrade(new_wasm_hash, operator)`, but nothing tests it.

**Acceptance criteria**
- [ ] A test-only "v2" WASM per contract (for example adding a `version()` function) built in the test or kept as a fixture.
- [ ] Tests: deploy v1 from WASM, create state (balances, deposits, debt, stakes), upgrade as owner, confirm state and behaviour are unchanged and `version()` works.
- [ ] Test: non-owner upgrade fails.
- [ ] Use `stellar_contract_utils::upgradeable::set_schema_version` / `get_schema_version` and document a migration pattern (a `migrate` function gated by schema version).
- [ ] Section in `docs/stellar/ARCHITECTURE.md` describing the upgrade procedure.

**Files likely involved**
`stellar/tests/` (new upgrade test), possibly a `stellar/contracts/*_v2` fixture crate, `docs/stellar/ARCHITECTURE.md`

**Complexity**
High

**How to test**
`cd stellar && stellar contract build && cargo test`

**Resources**
- https://developers.stellar.org/docs/build/guides/conventions/upgrading-contracts
- OpenZeppelin `stellar-contract-utils` `upgradeable` module
