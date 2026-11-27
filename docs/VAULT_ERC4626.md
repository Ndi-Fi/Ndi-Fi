# NdiFiVault: ERC-4626 conformance and limits

What `src/NdiFiVault.sol` conforms to, where it deviates from ERC-4626, how
fees and rounding behave, what slippage protection exists, what property
tests cover, and how asset recovery works. The Soroban counterpart
(`stellar/contracts/ndi_lending`) is summarised at the end.

Related docs: [`UPGRADEABILITY.md`](UPGRADEABILITY.md) (admin powers),
[`AUDIT_READINESS.md`](AUDIT_READINESS.md) (checklist),
[`docs/stellar/MIGRATION.md`](stellar/MIGRATION.md) (§4 known issues,
referenced below as "MIGRATION §4").

---

## 1. What NdiFiVault is

`NdiFiVault` is an ERC-4626 vault over a single ERC-20 asset (deployed against
a DAI-like token in tests), inheriting from OpenZeppelin's `ERC4626` and
`Ownable`. Share token: name `NDITOKEN`, symbol `NDI` (note: the symbol
collides with `NdiPoint`'s "NDI" — MIGRATION §4 item 6).

Vault-specific rules layered on top of the standard:

- `stakingCap` — a cap on `totalAssets()`, default `100_000e18`, settable by
  the owner via `setStakingCap` (reverts on zero; may be set below current
  `totalAssets()`, which only blocks *new* deposits, never withdrawals —
  covered by `testRevert_SetStakingCapBelowTotalAssets`).
- `maintenanceOngoing` — a maintenance flag; while it is set (owner
  `pauseVault()`), `deposit`, `mint`, `withdraw` and `redeem` revert with
  `underMaintenance()`. `unpauseVault()` lifts it.
- `authorizedLendingContract` — one address (set via
  `setAuthorizedLendingContract`, owner-only, zero-check + event) allowed to
  pull idle assets via `withdrawForLoan` for loan distribution.

## 2. ERC-4626 method conformance

| Method | Status | Behaviour |
|---|---|---|
| `asset()` | ✅ inherited | The constructor's DAI-like token (zero address reverts) |
| `totalAssets()` | ✅ inherited | The asset balance held by the vault. **Deviation:** when funds are lent via `withdrawForLoan`, the balance drops and the share price falls for everyone; repayments made to `NdiFiLending` never return to the vault (MIGRATION §4 item 3) |
| `deposit(assets, receiver)` | ✅ overridden | Zero-address/zero-amount checks, cap check (`super.totalAssets() + assets > stakingCap` → `stakingCapExceeded`), then the OZ implementation. Under maintenance: revert |
| `mint(shares, receiver)` | ⚠️ partial | Zero checks only. **Deviation: the cap is not checked in `mint`** — a depositor can bypass `stakingCap` by minting (MIGRATION §4 item 4) |
| `withdraw(assets, receiver, owner)` | ✅ overridden | Zero-address checks on receiver and owner, then OZ. Under maintenance: revert |
| `redeem(shares, receiver, owner)` | ✅ overridden | Zero checks, then OZ. Under maintenance: revert |
| `maxDeposit` | ❌ not overridden | Returns `type(uint256).max` — **ignores `stakingCap` and the maintenance flag** (ERC-4626 expects 0 when deposits are impossible; MIGRATION §4 item 5) |
| `maxMint` | ❌ not overridden | Same issue; also reflects the missing mint cap |
| `maxWithdraw` | ❌ not overridden | Returns `balanceOf(owner)` — ignores the maintenance flag and any funds lent out |
| `maxRedeem` | ❌ not overridden | Same |
| `preview*` / `convertTo*` | ✅ inherited | OpenZeppelin math (rounding: §4) |
| ERC-20 behaviour of shares | ✅ inherited | Standard `ERC20` (`permit` is **not** included) |
| Events | ✅ inherited + extra | OZ `Deposit`/`Withdraw`/`Transfer`; extra `minted(shares)`, `redeemed()`, `deposited(amount)` (declared but never emitted — MIGRATION §4 item 7), `withdrawSuccessful()`, `LendingTokensWithdrawn`, `LendingContractUpdated` |

## 3. Fee model

**None.** `NdiFiVault` charges no deposit, withdrawal, management or
performance fee, and has no fee hooks. All of a depositor's assets are
accounted 1:1 at deposit; yield (if any) comes only from value added to the
vault (e.g. a donation). Consequences:

- `previewRedeem(shares)` == `previewWithdraw`-equivalent 1:1 modulo rounding.
- Any future fee design must state rounding direction and whose favour; the
  audit checklist (`AUDIT_READINESS.md` §3) treats share-price monotonicity
  as an invariant partly *because* there are no fee skims today.

## 4. Rounding directions

Inherited from OpenZeppelin's `ERC4626` and consistent with the standard's
recommendation that rounding favours the vault (the protocol's solvency):

| Call | Rounding |
|---|---|
| `convertToShares` / `previewDeposit` | assets → shares, **down** |
| `previewMint` | shares → assets, **up** |
| `previewWithdraw` | assets → shares, **up** |
| `convertToAssets` / `previewRedeem` | shares → assets, **down** |

No fee accrual means rounding dust is negligible for a single user, but the
existing test tolerates it explicitly: `testRoundtripMintRedeem` asserts
`mint → redeem` returns the original amount within `1e6` wei on an 18-decimal
asset. Zero-share/zero-asset edge cases: `deposit(0)` and `mint(0)` revert
(`invalidDepositAmount`) and `redeem(0)` reverts (`invalidAmount`);
`withdraw(0, …)` is **not** rejected by the override — it falls through to
OpenZeppelin's implementation, which burns 0 shares and transfers 0 assets as
a silent no-op.

## 5. Slippage-limit variants

**Not implemented.** The vault exposes no `depositWithSlippage`,
`minSharesOut`, `maxLoss` or similar parameter, and ERC-4626 itself defines
none. Practical protections today:

- deposit/mint against a public `preview*`/`convert*` quote is fully
  trust-the-chain — a sandwiched donation or loan-driven `totalAssets`
  change is not bounded on-chain.
- The realistic attack surface is share-price manipulation around
  `withdrawForLoan` (a large pull drops `totalAssets()`): users should quote
  off-chain immediately before submitting and set slippage bounds at the
  frontend until variants land.

**Recommended additions** (tracked for the audit-hardening roadmap): a
`minShares` parameter on deposit/mint and `minAssets` on withdraw/redeem that
revert when the realized conversion is worse than the caller's bound.

## 6. Property tests and results

`test/NdiFiVault.t.sol` (Foundry) covers the following properties; all are
**currently passing** as written:

| # | Property (test) | Result |
|---|---|---|
| 1 | Deposit to zero address reverts (`testRevert_DepositToZeroAddress`) | pass |
| 2 | Zero-amount deposits reverts (`testRevert_DepositZeroAmount`) | pass |
| 3 | Withdraw with zero receiver/owner reverts (`testRevert_WithdrawToZeroAddress`, `testRevert_WithdrawFromZeroAddress`) | pass |
| 4 | Mint zero shares / to zero address reverts (`testRevert_MintZeroShares`, `testRevert_MintToZeroAddress`) | pass |
| 5 | Redeem zero shares / to zero address reverts (`testRevert_RedeemZeroShares`, `testRevert_RedeemToZeroAddress`) | pass |
| 6 | Deposit above `stakingCap` reverts (`testRevertStakingCapExceeded`) | pass |
| 7 | Pause blocks deposit, withdraw, mint, redeem (`testPauseVaultBlocksCoreOps`) | pass |
| 8 | Admin functions are owner-only (`testOnlyOwnerModifiers`, plus per-function non-owner reverts) | pass |
| 9 | `emergencyWithdraw` transfers the full asset balance (`testEmergencyWithdrawTransfersAllFunds`) | pass |
| 10 | `emergencyRedeem` burns user shares against prior approval (`testEmergencyRedeemTransfersUserShares`) | pass — but see the parameter-bug caveat in §7 |
| 11 | `setStakingCap(0)` reverts; `type(uint256).max` accepted (`testRevert_setStakingCapZero`, `testSetStakingCapLargeValue`) | pass |
| 12 | Deposit→withdraw roundtrip returns exact assets; `maxWithdraw` correct (`testRoundtripDepositWithdraw`) | pass |
| 13 | Mint→redeem roundtrip returns assets within `1e6` (`testRoundtripMintRedeem`) | pass |
| 14 | Deposit without approval / above allowance reverts (`testRevert_DepositWithoutApprove`, `testRevert_DepositMoreThanAllowance`) | pass |
| 15 | Zero asset address at deploy reverts (`testRevert_ZeroAssetOnDeploy`) | pass |
| 16 | Cap below current `totalAssets` blocks only new deposits (`testRevert_SetStakingCapBelowTotalAssets`) | pass |

Gaps the suite does **not** yet cover (tracked in `AUDIT_READINESS.md` §3):
formal ERC-4626 property suites (e.g. a full OZ `ERC4626` conformance
harness), the `mint` cap bypass, `max*` vs pause/cap consistency, and
share-price behaviour across `withdrawForLoan`/repay flows.

## 7. Asset recovery behaviour

Three paths move assets/shares in emergencies or for the lending flow:

| Function | Who | What it does | Caveats |
|---|---|---|---|
| `emergencyWithdraw(to, _initialOwner)` | owner | Transfers the **entire asset balance** to `_initialOwner` if nonzero, emits `withdrawSuccessful()` | **As coded:** `to` is zero-checked but otherwise unused; funds always go to `_initialOwner`, which is never validated. Naming/behaviour mismatch is a known issue (MIGRATION §4 item 1). It also drains depositor funds 1:1 against shares that remain outstanding |
| `emergencyRedeem(from, to)` | owner | Reads `from`'s full share balance, previews redeem and calls OZ `_withdraw(msg.sender, from, to, assets, shares)` | **As coded:** the OZ `_withdraw` signature is `(caller, receiver, owner, …)`, so assets go to `from` and shares are burned from `to` — the reverse of the parameter names — and `to`'s allowance is spent, so it is not a forced redeem (MIGRATION §4 item 2). The only test exercises `from == to` with prior approval |
| `withdrawForLoan(to, amount)` | `authorizedLendingContract` only, not under maintenance | Pulls up to the vault's asset balance to `to` for loan distribution, emits `LendingTokensWithdrawn` | Reduces `totalAssets()` (share price) while loans are out; nothing routes repayments back automatically (MIGRATION §4 item 3) |

`getAvailableLiquidity()` exposes the idle asset balance to the lending
contract and off-chain monitoring.

## 8. Stellar counterpart: `ndi_lending`

`stellar/contracts/ndi_lending` is the Soroban port of the vault idea, with
the ERC-4626-style interface of OpenZeppelin Stellar `FungibleVault`. Where
it differs from the Solidity vault, it mostly fixes the deviations above:

- `total_assets` = idle balance **+ outstanding borrower debt with interest**,
  so the share price does not drop while funds are lent out.
- `max_deposit`/`max_mint`/`max_withdraw`/`max_redeem` **are** implemented:
  they respect the deposit cap, idle liquidity and the pause flag (return 0
  while paused), and the cap is enforced in **both** `deposit` and `mint`.
- Shares use a virtual offset of 0 but the OZ vault adds one virtual share
  and one virtual asset, making donation attacks unprofitable.
- Rounding follows the same favour-the-vault directions as §4.
- No fees; `emergency_withdraw` is owner-only and **only while paused**;
  forced redemption (`emergencyRedeem`) was intentionally dropped
  (MIGRATION §4 item 2 rationale).

Full function mapping and the list of intentional deviations:
`docs/stellar/MIGRATION.md` §2–§3.
