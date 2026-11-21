# Audit-readiness checklist

A repeatable checklist for getting Ndi-Fi to an external-audit-ready state.
Run through it before contacting an auditor and again after every code change
so the state is always known. It covers tests, invariants, documentation,
static analysis, known issues/assumptions, and the scope template to send an
auditor.

Related docs: [`ORACLE.md`](ORACLE.md), [`UPGRADEABILITY.md`](UPGRADEABILITY.md),
[`VAULT_ERC4626.md`](VAULT_ERC4626.md),
[`docs/stellar/MIGRATION.md`](stellar/MIGRATION.md) (§4 known issues).

---

## 0. What the repository actually has today

| Chain | Contract | Tests | Notes |
|---|---|---|---|
| Ethereum | `src/NdiFiVault.sol` | `test/NdiFiVault.t.sol` (27 Foundry tests) | see [`VAULT_ERC4626.md`](VAULT_ERC4626.md) |
| Ethereum | `src/NdiFiLending.sol` | **placeholder only** (`test/Placeholder.t.sol`) | no real tests yet — `MIGRATION.md` §4 item 18 |
| Ethereum | `src/NdiFiStaking.sol` | `test/NdiFiStaking.t.sol` | has a critical withdrawal bug (§4 item 19) |
| Ethereum | `src/NdiPoint.sol` | `test/NdiPoint.t.sol` | |
| Stellar | `ndi_token`, `ndi_lending`, `ndi_staking` | `contracts/*/src/test.rs` + `stellar/tests/integration.rs` | unit + one integration flow |

The checklist below is written so items can be re-checked per release; each
section ends with a sign-off line to fill in.

## 1. Code freeze and repo hygiene

- [ ] A release tag exists and the audit runs against that exact commit hash.
- [ ] All dependencies are pinned (`lib/` submodules at recorded revisions,
      `foundry.toml` remappings, `stellar/Cargo.lock` committed).
- [ ] No secrets, private keys or seed phrases in history (deploy keys live in
      the CLI config outside the repo — see `stellar/README.md`).
- [ ] `README.md` claims match the code (the current README overstates
      Uniswap V3 staking, proxies and access control — `MIGRATION.md` §4
      item 27); reconciled or annotated.

**Sign-off:** date / commit / reviewer.

## 2. Tests

- [ ] Every contract has a dedicated Foundry (or Soroban) test suite; no
      placeholder tests (`test/Placeholder.t.sol`) remain.
- [ ] `NdiFiLending` has a full suite: collateral deposit/withdraw, takeLoan,
      repayLoan, liquidate (health above/below threshold), multi-token
      collateral locking, origination-fee math, and the double-fee bug (§4
      item 8) fixed or explicitly accepted.
- [ ] Fork tests against live feeds for every supported collateral (mock
      aggregators for unit tests, real feeds in fork tests).
- [ ] Access-control tests for every owner-only function (pattern exists in
      `test/NdiFiVault.t.sol::testOnlyOwnerModifiers` — replicate everywhere).
- [ ] Pause/upgrade interaction tests for each contract.
- [ ] Stellar: `cargo fmt --all --check`, `cargo clippy --all-targets -- -D
      warnings` and `cargo test` all pass; upgrade tests per
      `WAVE_ISSUES.md` issue 14.
- [ ] CI runs the full matrix on every PR.

**Sign-off:** date / commit / reviewer.

## 3. Invariant suites

Foundry `invariant` tests (or Echidna/Medusa properties) must at least cover:

**Vault (`NdiFiVault`)**
- [ ] sum of share balances == `totalSupply()` at all times
- [ ] `totalAssets()` == asset balance of the vault — except during
      `withdrawForLoan`/emergency flows, where the deviation must be bounded
      and explained (see [`VAULT_ERC4626.md`](VAULT_ERC4626.md))
- [ ] deposit → withdraw roundtrip never loses assets for a single user
- [ ] share price is non-decreasing except through documented owner/lending
      flows (donation-attack resistance)
- [ ] `stakingCap` is respected by **both** `deposit` and `mint` (mint
      currently bypasses it — §4 item 4)

**Lending (`NdiFiLending`)**
- [ ] `lockedCollateral[user][token] <= collateralBalances[user][token]`
- [ ] every active loan has locked collateral ≥ the required collateral value
      at origination
- [ ] `liquidateLoan` never seizes more than `debt + penalty` value and never
      touches users other than the borrower
- [ ] health-factor math is consistent with the liquidation math (currently
      divergent — §4 item 11)
- [ ] no state where repayment is impossible (e.g. locked collateral stuck —
      §4 item 12)

**Staking (`NdiFiStaking`) / Soroban**
- [ ] total rewards paid out ≤ reward pool funded
- [ ] a staker's withdrawal cannot be inflated by other stakers' principal
      (critical bug §4 item 19 must be fixed first)
- [ ] Soroban: `ndi_lending` debt accrual is monotonic in time; utilisation ≤
      100%; `sum(share balances) == total_supply`

**Sign-off:** date / commit / reviewer.

## 4. Static analysis

- [ ] `slither .` run on the latest commit; every high/medium finding fixed
      or explicitly waived in writing (waivers listed in §5).
- [ ] Optional but recommended: `mythril` or a fuzzing run
      (Echidna/Medusa/`forge invariant`) with a written report.
- [ ] Solidity lints: `forge lint` (or Solhint) clean.
- [ ] Stellar: `cargo clippy --all-targets -- -D warnings` (already the repo
      convention per `CONTRIBUTING.md`), `cargo fmt --all --check`, release
      build with `overflow-checks = true` (pinned in `stellar/Cargo.toml`).
- [ ] `stellar contract build` output WASMs compared between two clean builds
      (determinism check) before any deployment.

**Sign-off:** date / commit / tool versions / reviewer.

## 5. Documentation

- [ ] This document set is current: [`ORACLE.md`](ORACLE.md),
      [`UPGRADEABILITY.md`](UPGRADEABILITY.md),
      [`VAULT_ERC4626.md`](VAULT_ERC4626.md).
- [ ] `docs/stellar/ARCHITECTURE.md` and `MIGRATION.md` match the deployed
      contracts (function tables, events, storage layout).
- [ ] NatSpec/Rustdoc on all external/public functions; NatSpec `@custom:security`
      or equivalent annotations for admin functions.
- [ ] Deployment addresses, constructor arguments and verification
      (Etherscan/Sourcify, or Soroban network passphrases) recorded for every
      environment.
- [ ] Event/indexing reference complete (every event asserted in tests per
      `WAVE_ISSUES.md` issue 6).

**Sign-off:** date / commit / reviewer.

## 6. Known issues and assumptions (must be triaged, not hidden)

`docs/stellar/MIGRATION.md` §4 lists 27 numbered observations about the
Solidity code. **Every item must be triaged before the audit:**

- [ ] Each item marked **fix** (with PR) or **accept** (with a one-line
      rationale and risk owner). Nothing left "unknown".
- [ ] The two critical ones are resolved first: staking withdrawal draining
      other stakers (item 19) and the vault `emergencyWithdraw`/`emergencyRedeem`
      parameter bugs (items 1–2).
- [ ] Oracle gaps in [`ORACLE.md`](ORACLE.md) §3 either fixed or explicitly
      accepted with deployment-time mitigations (e.g. trusted feed list).
- [ ] Assumptions the audit should know about are written down in the scope
      template below (asset assumptions, admin trust assumptions, chain
      assumptions, fee assumptions).

**Sign-off:** date / triage doc link / reviewer.

## 7. Operational readiness

- [ ] Admin keys per `UPGRADEABILITY.md` key-management guidance (multisig
      planned; today single EOAs — stated as an assumption).
- [ ] Monitoring: events indexed, admin actions alerted, oracle staleness
      alerts (per [`ORACLE.md`](ORACLE.md) §4).
- [ ] Incident response: who can pause, how, on what authority; documented
      pause playbook per contract.

**Sign-off:** date / runbook link / reviewer.

---

## 8. Auditor scope & contact template

Fill this in and send it when engaging an auditor:

```markdown
## Engagement: Ndi-Fi audit — <release tag>

**Repository:** https://github.com/Ndi-Fi/Ndi-Fi
**Commit under review:** <full sha>
**Toolchains:** Solidity ^0.8.20 / Foundry (commit <sha>); Soroban
soroban-sdk 28.0.0, OpenZeppelin Stellar Contracts 0.8.0 (per
stellar/Cargo.lock)

### In scope
- Solidity: src/NdiFiVault.sol, src/NdiFiLending.sol, src/NdiFiStaking.sol, src/NdiPoint.sol
- Soroban: stellar/contracts/ndi_token, ndi_lending, ndi_staking
- Deployment scripts: script/DeployNdiPoint.s.sol, stellar/scripts/deploy_testnet.sh
- Test suites in test/ and stellar/tests/

### Out of scope
- Third-party dependencies (OpenZeppelin Contracts / Stellar Contracts,
  Chainlink, prb-math, Uniswap v3 periphery) — reviewed at their own upstreams
- Off-chain services (indexers, frontend, key management infrastructure)

### Known issues we are aware of (not to be re-reported)
- <link or paste the triaged list from §6, e.g. MIGRATION.md §4 items>

### Assumptions we make
- Admin keys are held as stated in docs/UPGRADEABILITY.md (current trust model)
- Oracle behaviour as stated in docs/ORACLE.md
- <asset/chain-specific assumptions>

### Deliverables & dates
- Report due <date>; fixes review by <date>
- Findings severity taxonomy: <auditor's or Critical/High/Medium/Low/Info>

### Contact
- Primary: <name, email, telegram/x handle>
- Security contact / bounty policy: <link to SECURITY policy>
- Escrow/confidentiality arrangements: <as agreed>

### Environment access
- Testnet RPC / faucet details for re-testing: <details>
- Any staging deployments to use: <addresses>
```

## 9. Final sign-off

| Gate | Status | Date | Reviewer |
|---|---|---|---|
| §1 Code freeze & hygiene | | | |
| §2 Tests | | | |
| §3 Invariants | | | |
| §4 Static analysis | | | |
| §5 Documentation | | | |
| §6 Known issues triaged | | | |
| §7 Operations | | | |
| Audit scheduled / completed | | | |
