# 02 — Lending flow screens

Closes #137 · Wireframes, state map, risk visualization and handoff notes for
deposit, withdraw, borrow, repay and liquidate.

> See [README.md](README.md) for tokens and shared components.

## Two lending models to design for

The frontend must present two Ethereum contracts and one Stellar contract under
one "Lending" surface. Which actions appear depends on the active chain and
the connected account.

| Action | Ethereum `NdiFiVault` (ERC-4626) | Ethereum `NdiFiLending` (collateralized) | Stellar `ndi_lending` (vault) |
|---|---|---|---|
| Deposit | ✓ supply ETH → `nzETH` shares | — (deposit **collateral** instead) | ✓ supply SEP-41 asset → shares |
| Withdraw | ✓ redeem shares → ETH | — (withdraw **collateral**) | ✓ redeem shares → asset |
| Borrow | — | ✓ borrow against collateral (`takeLoan`) | ✓* owner-approved single borrower only |
| Repay | — | ✓ repay full debt (`repayLoan`) | ✓* single borrower repays |
| Liquidate | — | ✓ operator-only (`liquidateLoan`) | — (no per-user liquidation) |

\* On Stellar, borrowing is a protocol-borrower action, not a retail one.
Surface it only when the connected address is the authorized borrower
(`ndi_lending::borrower()`). Mark these screens `ChainBadge = Stellar`.

> **Design decision:** keep one shared "Lending" hub; show/hide tabs and cards
> by capability rather than building three separate apps.

## Lending hub (entry screen)

```
┌────────────────────────────────────────────────────────────────────┐
│  Lending                                  [ETH ▾][0x1234…abcd ▾]   │
│                                                                      │
│  ┌─ Your position ────────────────────────┐  ┌─ Pool ──────────────┐ │
│  │ Supplied        —.— ETH   ≈ — shares   │  │ TVL        —.— ETH  │ │
│  │ Max withdraw    —.— ETH                │  │ Utilization — %    │ │
│  │ Health factor   1.40x  ●━━━━━○━━━━━━    │  │ Available  —.— ETH  │ │
│  └────────────────────────────────────────┘  └─────────────────────┘ │
│                                                                      │
│  [ Deposit ]  [ Withdraw ]   ─── collateral ───  [ Borrow ] [ Repay ] │
│                                                                      │
│  Active loan                                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ Principal 1,000 DAI · fee 10 DAI · debt 1,010 DAI               │ │
│  │ Collateral locked: 1.5 ETH ($3,000)   Health 1.40x  [ Repay ]   │ │
│  └────────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

Mobile collapses the two top cards into one column; the action row becomes a
sticky bottom bar `[Deposit][Withdraw]` with a segmented control that swaps to
`[Borrow][Repay]` under the "collateral" toggle.

Position card data:

- **Supplied** — `Base.balance(owner)` (shares) converted via
  `convertToAssets`. ETH vault: `NdiFiVault` shares → ETH. Stellar:
  `ndi_lending` share balance → asset.
- **Max withdraw** — `NdiFiVault.maxWithdraw(owner)` / `ndi_lending::max_withdraw(owner)`.
- **Health factor** — `NdiFiLending.calculateHealthFactor(owner)`, only when
  an active collateralized loan exists. Shown as `1.40x` (contract's integer
  `140` → `1.40x`). Stellar: not applicable; hide the row.
- **Pool TVL** — `NdiFiVault.totalAssets()` / `ndi_lending::total_assets()`.
- **Utilization** — `NdiFiLending.getContractStats().utilizationRate` /
  `ndi_lending::utilization()` (scaled 1e7 → %).
- **Available** — `NdiFiVault.getAvailableLiquidity()` /
  `ndi_lending::available_liquidity()`.

## Deposit

```
DESKTOP                                  MOBILE (bottom sheet)
┌──────────────────────────────┐         ┌──────────────────────────┐
│ Deposit into the vault        │         │ Deposit                  │
│                              │         │                          │
│ Asset  [ETH ▾]                │         │ Asset  [ETH ▾]           │
│ ┌──────────────────────┐ [Max]│         │ ┌────────────────┯───┐   │
│ │ 0.0                  │      │         │ │ 0.0            │Max│   │
│ └──────────────────────┘      │         │ └────────────────┴───┘   │
│ Balance 1.23 ETH              │         │ Balance 1.23 ETH         │
│ You receive ≈ 0.0 nzETH       │         │ ≈ 0.0 nzETH              │
│ Health after —  stays healthy │         │                          │
│                              │         │  Preview                 │
│ Rate —.—% APR · cap — ETH     │         │  Rate —.—% · cap — ETH   │
│ [          Deposit          ]│         │ [    Deposit    ]        │
└──────────────────────────────┘         └──────────────────────────┘
```

- **`<AmountInput>`** with `[Max]` set to `min(walletBalance, remainingCap)`.
  On Stellar, `remainingCap` = `ndi_lending::deposit_cap() − total_assets()`.
- **Preview** ("You receive ≈ X shares"): `convertToShares(amount)` /
  `preview_deposit(amount)`. Update live; round shares down.
- **Health after** — only for collateral deposits into `NdiFiLending`
  (`depositCollateral`): projected HF after adding collateral; show "n/a" for
  vault deposits.
- **Rate / cap** — `NdiFiVault` interest rate + `ndi_lending::interest_rate()`
  (APR); `stakingCap` / `deposit_cap`.
- **Confirm** → contract `deposit(assets, receiver, from, operator)` (Stellar)
  / vault `deposit(assets, receiver)` (ETH). Open `<TxToast>` (pending →
  success). On success, refresh position card and stats.

## Withdraw

```
┌──────────────────────────────┐
│ Withdraw from the vault       │
│                              │
│ Asset  [ETH ▾]                │
│ ┌──────────────────────┐ [Max]│   ← Max = maxWithdraw
│ │ 0.0                  │      │
│ └──────────────────────┘      │
│ Max withdraw 0.45 ETH         │
│ You burn ≈ 0.0 nzETH          │
│ ┌──────────────────────────┐ │
│ │ ⚠ Liquidity low: 0.45 of  │ │   ← only if amount > available
│ │   0.30 available          │ │
│ └──────────────────────────┘ │
│ [         Withdraw         ] │
└──────────────────────────────┘
```

- `[Max]` = `maxWithdraw(owner)` (capped by idle liquidity on both chains).
- Preview shares to burn = `previewWithdraw(amount)` /
  `preview_withdraw(amount)`.
- **Insufficient-liquidity state:** if `amount > available_liquidity`, disable
  the button and show the warning above with the available figure. This is
  `InsufficientLiquidity` on both `ndi_lending::withdraw` and
  `NdiFiVault.withdraw`.
- Confirm → `withdraw(assets, receiver, owner, operator)` (Stellar) /
  `redeem`/`withdraw` (ETH). On Stellar this fails while paused
  (`max_withdraw` returns 0); reflect that in the disabled state.

## Borrow (collateralized — Ethereum)

Two sub-flows: **deposit collateral**, then **take loan**.

```
DEPOSIT COLLATERAL                         TAKE LOAN
┌──────────────────────────────┐           ┌──────────────────────────────┐
│ Deposit collateral            │           │ Borrow                        │
│ Collateral [WETH ▾]           │           │ Borrow [DAI ▾]               │
│ ┌────────────────────┐ [Max]  │           │ ┌────────────────────┐ [Max]  │
│ │ 0.0                │        │           │ │ 0.0                │        │
│ └────────────────────┘        │           │ └────────────────────┘        │
│ Collateral value $0           │           │ Max borrow 0 DAI  (75% LTV)   │
│ Borrowable 0 DAI   (75% LTV)  │           │ Origination fee 0 DAI (0.5%)  │
│ Health factor  ∞              │           │ You receive 0 DAI             │
│ [   Deposit collateral    ]   │           │ Health after  ∞  ●━━━━━━━━    │
└──────────────────────────────┘           └──────────────────────────────┘
```

- **Collateral picker** lists only `supportedCollateralTokens` (filtered by
  non-zero `tokenAddress`).
- **Collateral value** = `getCollateralValue(user)` + the new amount, priced
  via `AggregatorV3.latestRoundData` (8 decimals → 18 by `*1e10`).
- **Borrowable** = `collateralValue × collateralFactor / 100` (factor is a
  percent, e.g. 75).
- **Max borrow** on the loan screen = borrowable minus existing debt, and also
  capped by `vault.getAvailableLiquidity()`. The contract rejects
  `requestedLoanValue > maxLoanValue` and `amount > availableLiquidity`.
- **Origination fee** = `amount × originationFeeRate / 10000`; **you receive** =
  `amount − fee`.
- **Health after** = projected `calculateHealthFactor`. At max borrow this is
  `liquidationThreshold / collateralFactor × 100` (≈ 1.13x at 85/75) — show it
  so users see the thin margin before they confirm.
- One active loan per user (`!loans[user].isActive`); if one exists, replace
  the Borrow button with "Repay your active loan first".
- Confirm → `depositCollateral(token, amount)` then `takeLoan(amount)`.

## Repay

```
┌──────────────────────────────┐
│ Repay loan                    │
│ Debt  1,010.00 DAI  (principal 1,000 + fee 10)   │
│ ┌────────────────────┐ [Max] │   ← Max = full debt (contract requires full)
│ │ 0.0                │        │
│ └────────────────────┘        │
│ Balance 2,000.00 DAI         │
│ After repay: collateral unlocked, loan closed
│ [        Repay full debt     ]│
└──────────────────────────────┘
```

- `repayLoan` requires `_amount == totalDebt` (principal + origination fee).
  The input is therefore **read-only-equivalent**: show the exact debt, a
  `[Max]` that fills it, and disable until the user has at least that balance.
  If `walletBalance < totalDebt`, show the insufficient-balance state and a
  link to deposit more DAI.
- Confirm → `repayLoan(totalDebt)`. On success, unlock collateral (contract
  clears `lockedCollateral`), close the loan, refresh HF to ∞.

## Liquidate (operator view)

Liquidation is **operator-gated**: `onlyLiquidator` is `owner()`. This is not a
public liquidator bounty page in the MVP. Surface it only when the connected
account is the owner/liquidator, behind a distinct "Risk ops" entry — do not
expose it to regular users.

```
RISK OPS (operator only)                      LIQUIDATE BORROWER
┌─────────────────────────────────────────┐   ┌──────────────────────────────┐
│ Liquidatable positions                  │   │ Liquidate 0x borrower         │
│ ┌─────────────────────────────────────┐ │   │ Debt 1,010 DAI ($1,010)       │
│ │ 0x1234…  HF 0.92x  debt $1,010  [Go]│ │   │ Collateral seized est. $1,161 │
│ │ 0x5678…  HF 0.88x  debt $500    [Go]│ │   │  = debt + penalty (5%)        │
│ └─────────────────────────────────────┘ │   │ You pay 1,010 DAI             │
│ Threshold: HF < 1.00x (liquidatable)    │   │ You receive ~1.161 ETH equiv  │
└─────────────────────────────────────────┘   │ [   Liquidate loan   ]        │
                                               └──────────────────────────────┘
```

- List borrowers where `calculateHealthFactor(b) < 100` (i.e. `< 1.00x`),
  sorted by HF ascending. Poll `loans` / a borrower list.
- Confirm sheet shows: debt (`principal + originationFee`), penalty
  (`liquidationPenalty` bps), collateral to seize
  (`totalDebtValue + penaltyValue`, seized largest-collateral-first per
  `_sortCollateral`), what the operator pays (full debt) and receives.
- Confirm → `liquidateLoan(borrower)`.
- **Flag for maintainers:** liquidation is owner-only today, which
  centralizes risk ops. If/when it becomes permissionless, the same screen
  becomes a public bounty page with a "race risk" note. The wireframe already
  supports that by listing all liquidatable positions.

## State map

A shared vocabulary applies to every action screen. Each screen is in exactly
one of these states; transitions are driven by wallet state, data loading and
tx status.

```
                 ┌─────────────┐
   open screen ─▶│   loading    │─ no data yet
                 └──────┬───────┘
                        │ data arrives
              ┌─────────┼──────────────────────────┐
              ▼         ▼                            ▼
        ┌─────────┐ ┌─────────┐               ┌───────────┐
        │  empty  │ │  ready  │◀── user edits ─│  error    │
        │ no pos. │ │ input ok│   amount      │ fetch/parse│
        └─────────┘ └────┬────┘               └───────────┘
                         │ user confirms
                         ▼
                   ┌───────────┐   tx sent  ┌──────────┐  ok   ┌─────────┐
                   │ submitting│──────────▶│ pending  │──────▶│ success │
                   │ (wallet)  │           │ (chain)  │       └─────────┘
                   └─────┬─────┘           └────┬─────┘
                         │ rejected            │ reverted
                         ▼                     ▼
                   ┌───────────┐          ┌───────────┐
                   │  rejected │          │  failed   │
                   └───────────┘          └───────────┘
```

Per-state behavior (applies to deposit/withdraw/borrow/repay/liquidate):

| State | Trigger | UI |
|---|---|---|
| `loading` | screen mounted, position/stats not yet loaded | skeleton shimmer on amounts; buttons disabled |
| `empty` | no position/loan for this user | `<EmptyState>` "No supply yet" / "No active loan" + primary CTA |
| `ready` | data loaded, amount valid | input live, preview live, button enabled |
| `insufficient-balance` | amount > wallet balance (or > max withdraw) | red helper under input, `[Max]` capped, confirm disabled |
| `insufficient-liquidity` | withdraw/redeem amount > `available_liquidity` (vault) | warning with available figure, confirm disabled |
| `insufficient-collateral` | borrow `requestedLoanValue > maxLoanValue` | "Max borrow X DAI" helper, confirm disabled |
| `submitting` | user confirmed, wallet prompt open | button → "Confirm in wallet…" spinner |
| `pending` | tx hash received | `<TxToast>` pending + explorer link |
| `success` | tx mined / Soroban confirmed | `<TxToast>` success, refresh position & stats |
| `error` | data fetch/parse failed | `<ErrorState>` with retry |
| `failed` | tx reverted | `<TxToast>` failed, raw revert reason + the contract error code for power users |
| `rejected` | user dismissed wallet prompt | toast "Cancelled" (non-blocking) |
| `paused` | `Pausable.paused()` true (ETH) / `paused(e)` (Stellar) | action disabled, banner "Lending is paused. Withdrawals disabled." Note: `ndi_lending` blocks deposit/mint/withdraw/redeem/borrow while paused; `repay` stays allowed. |

Edge cases to test in build:
- **Not connected:** action buttons route to the connect sheet (#140).
- **Wrong network:** see `04-wallet-connection.md`; the action screen shows the
  wrong-network banner and disables confirm.
- **Share-price rounding to 0 shares** (tiny deposit): block with "Amount too
  small" (`ZeroShares` on Stellar).
- **Cap reached** (`DepositCapExceeded`): disable deposit, show remaining cap.

## Health factor & risk visualization

### `<HealthGauge>`

A 180° gauge from `0x` (left) to `2.0x` (right), with the needle at the user's
HF. Used on the hub, the borrow screen and the active-loan card.

```
                  1.13x   1.50x
        liquidate   ▲       ▲
  0x ────┼──────────┼───────┼──────────── 2.0x
   ▲     │  amber   │ green │
  1.00x  │          │       │
   red   │          ▼ needle (1.40x = green)
        (zone)    safe
```

- **Liquidatable (red, ⚠ icon + "Liquidatable"):** HF < 1.00x
  (`calculateHealthFactor < 100`).
- **At risk (amber, ⚠ icon + "At risk"):** 1.00x ≤ HF < 1.25x.
- **Healthy (green, ✓ icon + "Healthy"):** HF ≥ 1.25x.
- Thresholds `LIQUIDATION = 1.00x`, `AT_RISK = 1.25x`, `SAFE = 1.50x` are
  constants, tunable. `1.13x` (max-borrow floor at default 85/75) is marked as a
  tick so users see how thin the origination margin is.
- Numeric readout `1.40x` in mono beside the gauge; `aria-live="polite"` so
  screen readers announce changes.

### LTV bar (companion)

A horizontal bar `0% → liquidationThreshold%`, with `collateralFactor%` marked:

```
  0% ──────────────●75% (max borrow) ──── ─85% (liquidation) ─── 100%
                   cf                  lt
                  [██████████████░░░░░░░░░░░░░░░░]  LTV 53%
```

`LTV = totalDebtValue / collateralValue × 100`. The fill color matches the
gauge zone. This is the intuitive view for "how much have I borrowed against
my collateral"; the gauge is the intuitive view for "how close to liquidation".

### Liquidation projection

On the borrow screen, a small line chart shows projected HF over a simulated
price drop of the collateral (−10%, −25%, −50%) so users see where they
liquidate before confirming. Static bars (no animation); data is a local
calculation from current `getCollateralValue` and debt.

## Units & formatting

- **Ethereum:** ETH/DAI amounts in native decimals (18), displayed to 6 sig
  digits. Shares (`nzETH`) shown as a secondary "≈ X shares" line.
- **Stellar:** amounts are `i128` in the asset's smallest unit (XLM = 7-decimal
  stroops; USDC = 6 decimals — read the token's `decimals`). Inputs and
  displays are in the human amount; the frontend multiplies by `10**decimals`
  for the call and divides the result by `10**decimals` for display. Never show
  the raw smallest unit in an input. Health factor does not exist on Stellar;
  hide the gauge.
- **Price denominator:** `NdiFiLending` normalizes everything to an 18-decimal
  USD-like value (`price * 1e10`); show USD with 2 decimals and a `$` prefix.
- **APR vs APY:** `ndi_lending::interest_rate()` and the vault rate are **APR**
  (simple, capitalised). Never label them APY.

## Handoff notes for engineers

Data sources per screen (single source of truth — read these, do not re-derive):

- **Position:** `Base.balance(owner)`, `convertToAssets`, `maxWithdraw`,
  `convertToShares` (ETH vault) / `balance`, `convert_to_assets`,
  `max_withdraw`, `convert_to_shares` (Stellar).
- **Collateralized loan:** `getLoanDetails(user)` returns
  `(principal, originationFee, totalDebt, collateralAmount, healthFactor, isActive)`
  in one call — use it. `getCollateralValue`, `getContractStats`,
  `calculateHealthFactor` for live HF.
- **Config:** `collateralFactor`, `liquidationThreshold`,
  `originationFeeRate`, `liquidationPenalty`, `supportedCollateralTokens`,
  `isInitialized()`.
- **Stellar config:** `deposit_cap()`, `interest_rate()`, `borrower()`,
  `total_debt()`, `available_liquidity()`, `utilization()`.

Action calls (confirm → these → toast):

| Action | Ethereum | Stellar |
|---|---|---|
| Deposit | `NdiFiVault.deposit(assets, receiver)` | `deposit(assets, receiver, from, operator)` |
| Withdraw | `NdiFiVault.withdraw/redeem(...)` | `withdraw(assets, receiver, owner, operator)` / `redeem(...)` |
| Deposit collateral | `NdiFiLending.depositCollateral(token, amount)` | — |
| Withdraw collateral | `NdiFiLending.withdrawCollateral(token, amount)` | — |
| Borrow | `NdiFiLending.takeLoan(amount)` | `borrow(amount)` (borrower only) |
| Repay | `NdiFiLending.repayLoan(totalDebt)` | `repay(from, amount)` |
| Liquidate | `NdiFiLending.liquidateLoan(borrower)` (owner only) | — |

Error mapping — show plain-English cause and the raw code:

| Contract code | Display |
|---|---|
| `Loan exceeds collateral limit` / `Insufficient collateral` | "Borrow amount too high. Max borrow: X DAI (75% of your collateral)." |
| `Insufficient vault liquidity` / `InsufficientLiquidity` | "Not enough liquidity in the vault to withdraw/borrow right now. Available: X." |
| `Existing loan must be repaid first` | "You already have an active loan. Repay it before borrowing again." |
| `Must repay full debt amount` | "Repay must cover the full debt (principal + fee): X DAI." |
| `Loan is not liquidatable` | "This loan's health factor is ≥ 1.00x and cannot be liquidated." |
| `DepositCapExceeded` / `DepositCapExceeded` | "Deposit cap reached. Remaining: X." |
| `ZeroShares` / `ZeroAssets` | "Amount too small to mint/redeem at the current share price." |
| `paused` checks | "Lending is paused. You can still repay." |
| `Not authorized liquidator` | "Only the authorized liquidator can call liquidation." |

Polling: position + stats every block (ETH) / every ~15s (Stellar RPC); deboun
to avoid thrash. Always optimistic-update on `success` then reconcile with the
next read.

Accessibility: every amount, HF and countdown is in an `aria-live` region; the
gauge conveys state via icon + word, not color alone; confirm sheets trap focus
and restore it on close.

## Acceptance criteria — #137

- [x] Wireframes for deposit, withdraw, borrow, repay, and liquidate — §Deposit, §Withdraw, §Borrow (collateral + loan), §Repay, §Liquidate (operator view).
- [x] State map: empty, loading, success, error, insufficient balance — §State map, incl. insufficient-balance/liquidity/collateral, paused, rejected, failed.
- [x] Health factor and risk visualization specs — §Health factor & risk visualization (`<HealthGauge>`, LTV bar, liquidation projection).
- [x] Handoff notes for engineers — §Handoff (data sources, action calls, error mapping, polling, a11y).
