# Upgradeability & admin model

Who can do what today on each chain, what "upgradeability" actually means
here, how an upgrade is verified, the governance roadmap, and how admin keys
should be managed.

Related docs: [`ORACLE.md`](ORACLE.md) (admin-settable feeds),
[`VAULT_ERC4626.md`](VAULT_ERC4626.md),
[`AUDIT_READINESS.md`](AUDIT_READINESS.md).

---

## 1. Ethereum (Solidity): status — *no upgradeability in the code*

Honest statement first: **the Solidity contracts are not upgradeable.**
Despite the root `README.md` mentioning "OpenZeppelin proxy pattern", none of
the contracts in `src/` use a proxy, `UUPSUpgradeable`, `Initializable` or
any upgrade mechanism. `openzeppelin-contracts-upgradeable` is vendored in
`lib/` but imported by nothing. Changing Solidity contract logic today means
deploying a new contract and migrating state manually.

What the contracts *do* have is an **admin model**:

### 1.1 Admin surfaces (current)

| Contract | Admin authority | Admin functions | Risk notes |
|---|---|---|---|
| `NdiFiVault` | `Ownable` (single EOA) | `pauseVault`, `unpauseVault`, `emergencyWithdraw`, `emergencyRedeem`, `setStakingCap`, `setAuthorizedLendingContract` | `emergencyWithdraw` drains the entire asset balance (parameter bug documented in [`VAULT_ERC4626.md`](VAULT_ERC4626.md) §7) |
| `NdiFiLending` | `Ownable` | `initialize` (risk params, once), `addCollateralToken`, `removeCollateralToken`, `setCollateralFactor`, `setLiquidationThreshold`, `setOriginationFeeRate`, `setLiquidationPenalty`, `pause`, `unpause`, `emergencyWithdraw` (any token) | `emergencyWithdraw` can take any token including user collateral; collateral removal while positions are open drops their valuation (MIGRATION §4 items 15, 17) |
| `NdiFiStaking` | `Ownable` | `skimProfits` | the withdrawal bug (MIGRATION §4 item 19) interacts with vault state — must be fixed before any mainnet staking |
| `NdiPoint` | `AccessControl` roles | `mint` (MINTER_ROLE), `distributeReward(s)` (REWARD_DISTRIBUTOR_ROLE), `pause/unpause` (PAUSER_ROLE), `setContractAuthorization`, `recoverTokens` (DEFAULT_ADMIN_ROLE) | roles are granted to the initial owner at construction |

All admin functions are **immediate** (no timelock) and all authorities are
**single EOAs** at the time of writing.

### 1.2 Roadmap: UUPS + timelock + multisig

The intended target architecture (not yet implemented):

1. **Proxy pattern.** Wrap the core contracts in an
   [ERC-1967 proxy with UUPS upgrade logic](https://docs.openzeppelin.com/contracts/5.x/api/proxy)
   (`ERC1967Proxy` + `UUPSUpgradeable`). Only the proxy address becomes the
   user-facing contract; the implementation behind it can change.
2. **Initializer discipline.** Use OpenZeppelin upgradeable base contracts
   with initializers; disable initializers on implementation contracts
   (`_disableInitializers()`); version storage changes with storage gaps
   (`__gap`) where inherited contracts are used.
3. **Governance stack.** Admin powers move from an EOA to:
   a multisig (e.g. a Safe; suggested threshold 2-of-3 for testnet, 3-of-5
   for mainnet) that is the proxy **admin/owner**, and a
   **timelock controller** in front of parameter changes and upgrades
   (suggested 24–48 h delay for upgrades and risk-parameter changes, with an
   emergency bypass restricted to pausing — never to upgrades or fund
   movement).
4. **Precondition.** The UUPS pattern is only safe for audited,
   initializer-hardened contracts; get to the state in
   [`AUDIT_READINESS.md`](AUDIT_READINESS.md) first.

## 2. Stellar (Soroban): implemented upgrade path

The three Soroban contracts (`ndi_token`, `ndi_lending`, `ndi_staking`) all
implement OpenZeppelin Stellar `Upgradeable` — there are **no proxies**.
Soroban upgrades the contract's WASM **in place**: the contract address and
its storage (instance + persistent entries) are preserved, only the code
changes.

```rust
impl Upgradeable for NdiLending {
    #[only_owner]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, _operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}
```

- **Authorized upgraders:** the contract **owner** only (`#[only_owner]`).
  Ownership is a two-step OZ `Ownable`: `transfer_ownership(new)` →
  `accept_ownership()` by the new owner; `renounce_ownership()` gives it up
  permanently.
- **Conditions:** the new WASM must already be uploaded to the network
  (`stellar contract upload`), producing a `BytesN<32>` WASM hash.
- **Constraints:** Soroban forbids re-entrant calls and the authorizations
  are checked at entry, so an upgrade cannot be front-run inside another
  call — but an owner key compromise is still game over (see §4).

### 2.1 Upgrade procedure (Stellar)

1. Modify the crate, bump any behaviour-affecting logic.
2. `cd stellar && stellar contract build` — produces the release WASM under
   `target/wasm32v1-none/release/` (overflow checks are on in the release
   profile).
3. Test the **v2 WASM against the v1 storage**: build a test-only fixture
   WASM (e.g. adds a `version()` function), deploy v1, create state
   (balances, debt, stakes), upgrade as owner, verify state and behaviour
   unchanged. This is backlog issue 14 in `docs/stellar/WAVE_ISSUES.md` —
   the pattern to follow.
4. **Storage migrations.** If the storage layout changed, add a one-shot
   `migrate()` entry point gated by
   `stellar_contract_utils::upgradeable::set_schema_version` /
   `get_schema_version` so it runs at most once and only when versions
   differ. Document the migration plan next to the PR
   (`docs/stellar/ARCHITECTURE.md` §Upgrades already flags this).
5. Verify determinism: build the WASM twice from a clean tree and compare
   hashes before uploading.
6. Upload to the target network, record the WASM hash, call
   `upgrade(new_wasm_hash, operator)` **as the owner** (operator argument is
   ignored by the current implementations).
7. Post-upgrade verification: call a handful of views
   (`total_assets`, `total_debt`, `deposit_cap`, `get_stake`) and confirm
   values are unchanged from before the upgrade; check the new behaviour
   with a small live transaction on testnet first.

## 3. Upgrade verification steps (both chains)

- [ ] Code freeze + tag; audit or review of the diff between the deployed
      implementation and the new one (`AUDIT_READINESS.md`).
- [ ] Static analysis re-run clean on the new code.
- [ ] Storage compatibility argued in writing (variable ordering, types,
      Solidity storage gaps / Soroban `DataKey` enums — **appending** new
      keys, never renumbering).
- [ ] Testnet upgrade executed with the same procedure and state checks.
- [ ] (Solidity, once UUPS lands) proxy/implementation addresses recorded;
      implementation verified on Etherscan/Sourcify; ERC-1967 admin slot
      confirmed pointing at the multisig/timelock.
- [ ] Post-deploy monitoring wired: admin-action events, pause state, oracle
      health ([`ORACLE.md`](ORACLE.md) §4).

## 4. Admin key management guidance

- **Never hold admin keys in this repository.** The Stellar deploy flow
  already follows this: keys live in the Stellar CLI config directory
  outside the repo and the scripts never print them (`stellar/README.md`).
  The Solidity deployment path should adopt the same rule (hardware wallet +
  Foundry `--ledger`/`--trezor`).
- **Target:** admin powers on Ethereum belong to a multisig (Safe) behind a
  timelock; on Stellar, to a Stellar multisig account (ed25519 signed
  payloads with weighted thresholds). Single-EOA ownership is acceptable
  only on testnet and must be recorded as an assumption in the audit scope
  ([`AUDIT_READINESS.md`](AUDIT_READINESS.md) §8).
- **Least privilege:** split roles (`NdiPoint` already uses AccessControl
  roles; extend that idea when contracts are upgraded) so pausing, parameter
  changes and upgrades have separate holders where feasible.
- **Rotation & recovery:** document key-holder contacts and a rotation
  procedure; for two-step ownership on Stellar, rotation is
  `transfer_ownership` → `accept_ownership` (never renounce before the new
  owner accepts).
- **Emergency response:** the pause keys should be *more* available than
  upgrade keys (fast reaction), while upgrade keys should be *less*
  available (long timelock, multi-party). A compromised pause key cannot
  steal funds; a compromised upgrade key can.
- **Monitoring:** alert on every admin transaction (ownership events,
  `upgrade` calls, cap/fee/role changes) — these are the highest-value
  signals the protocol has.

## 5. Summary table

| Aspect | Ethereum (today) | Ethereum (roadmap) | Stellar (today) |
|---|---|---|---|
| Upgrade mechanism | none — redeploy | UUPS behind ERC-1967 proxy | OZ `Upgradeable` (WASM swap in place) |
| Who upgrades | n/a | multisig via timelock | contract owner |
| Parameter changes | owner EOA, immediate | multisig + timelock; pause exempt | owner, immediate |
| Pause | owner EOA per contract | same, emergency path | owner |
| Key management | single EOAs | Safe multisig + timelock | Stellar multisig (planned; single key on testnet) |
