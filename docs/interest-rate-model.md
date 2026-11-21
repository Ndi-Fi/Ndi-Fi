# Ndi-Fi Interest Rate Model

This document describes the current fixed-fee model in production and the utilization-based dynamic model planned for Phase 2 of the [roadmap](../Roadmap.md#phase-2-ecosystem-expansion--feature-growth-q1-q2-2026).

---

## Current Model: Fixed Origination Fee

### How it works

Ndi-Fi's MVP uses a **one-time origination fee** charged at the moment a loan is opened. There is no ongoing interest accrual — the borrower's total repayment obligation is fixed at origination.

| Parameter | Storage variable | Default |
|---|---|---|
| Origination fee rate | `originationFeeRate` | Configurable in basis points |
| Collateral factor | `collateralFactor` | e.g. 75 (= 75 %) |
| Liquidation threshold | `liquidationThreshold` | e.g. 85 (= 85 %) |

**Basis points:** 1 bp = 0.01 %, so `originationFeeRate = 50` means a 0.5 % fee.

### Fee calculation

When `takeLoan(amount)` is called:

```
originationFee = (amount × originationFeeRate) / BASIS_POINTS
totalOwed      = amount + originationFee
```

`BASIS_POINTS` is the constant `10 000`.

The `originationFee` is recorded in the `Loan` struct and must be repaid together with the principal to close the loan.

### Worked example

> Alice wants to borrow **1 000 DAI**. The origination fee rate is **50 bp (0.5 %)**.

```
originationFee = (1 000 × 50) / 10 000 = 5 DAI
totalOwed      = 1 000 + 5 = 1 005 DAI
```

Alice calls `repayLoan()` at any time and pays back 1 005 DAI to unlock her collateral. The 5 DAI fee goes to the protocol vault.

### Fee update

The owner can call `updateOriginationFeeRate(uint256 newRate)`. The event `OriginationFeeRateUpdated(oldRate, newRate)` is emitted. The change applies only to loans opened after the update — existing loans retain the fee they were created with.

---

## Planned Model: Utilization-Based Dynamic Rate (Phase 2)

The dynamic model replaces the flat origination fee with a **continuously accruing borrow rate** that adjusts automatically based on how much of the vault's liquidity is currently borrowed.

### Motivation

A fixed fee does not respond to supply and demand. When the vault is nearly empty, borrowers should pay more to protect liquidity; when it is under-utilized, rates should be low to attract borrowers. A utilization-based model aligns incentives and maximizes capital efficiency.

### Core concept: utilization rate

```
utilizationRate = totalBorrowed / totalLiquidity
```

Where `totalLiquidity = totalDeposited − totalBorrowed`.

Utilization ranges from 0 (no borrows) to 1 (all liquidity borrowed).

### Two-slope interest rate curve

The planned model uses a kinked (two-slope) curve, a standard approach used by Compound and Aave:

```
if utilizationRate ≤ OPTIMAL_UTILIZATION:
    borrowRate = BASE_RATE + (utilizationRate / OPTIMAL_UTILIZATION) × SLOPE_1

else:
    excessUtilization = utilizationRate − OPTIMAL_UTILIZATION
    maxExcess         = 1 − OPTIMAL_UTILIZATION
    borrowRate = BASE_RATE + SLOPE_1 + (excessUtilization / maxExcess) × SLOPE_2
```

**Parameters (illustrative, to be set by governance):**

| Parameter | Symbol | Illustrative value |
|---|---|---|
| Optimal utilization | `OPTIMAL_UTILIZATION` | 80 % |
| Base borrow rate (annual) | `BASE_RATE` | 2 % |
| Slope below optimal | `SLOPE_1` | 8 % |
| Slope above optimal | `SLOPE_2` | 100 % |

The steep `SLOPE_2` above the optimal point strongly incentivizes repayment and new deposits when liquidity is scarce.

### Accrual mechanism

Interest accrues per second using the current borrow rate:

```
accrualFactor   = borrowRate × secondsElapsed / SECONDS_PER_YEAR
interestOwed    = principal × accrualFactor
```

An `accumulatedIndex` (similar to Compound's borrow index) will be stored on-chain and updated each time the state changes (deposit, borrow, repay, liquidate). Individual debt is computed as:

```
currentDebt = initialDebt × (currentIndex / indexAtBorrow)
```

This avoids iterating over all borrowers on every block.

### Worked example

> The vault holds **500 000 DAI** in deposits and **400 000 DAI** is currently borrowed.
>
> Utilization = 400 000 / 500 000 = **80 %** (exactly at optimal).
>
> `borrowRate = 2 % + (80 % / 80 %) × 8 % = 2 % + 8 % = 10 % APR`

> Bob borrows **10 000 DAI** at this rate. After **30 days**:
>
> ```
> interestOwed = 10 000 × (10 % × 30 / 365) ≈ 82.19 DAI
> ```

> If utilization climbs to **95 %** (above optimal):
>
> ```
> excessUtilization = 95 % − 80 % = 15 %
> maxExcess         = 100 % − 80 % = 20 %
> borrowRate = 2 % + 8 % + (15 % / 20 %) × 100 % = 85 % APR
> ```
>
> At 85 % APR, 30-day interest on the same 10 000 DAI ≈ **698.63 DAI** — a strong signal for borrowers to repay or depositors to add liquidity.

### Governance parameters

All rate parameters (`BASE_RATE`, `SLOPE_1`, `SLOPE_2`, `OPTIMAL_UTILIZATION`) will be adjustable via the Ndi-Fi DAO governance process introduced in Phase 3. Changes will be subject to a time-lock to prevent sudden adverse rate changes.

---

## Roadmap cross-reference

| Feature | Phase | Status |
|---|---|---|
| Fixed origination fee | Phase 1 | ✅ Live |
| Dynamic utilization-based rate | Phase 2 | 🔜 Planned (Q1–Q2 2026) |
| DAO governance of rate parameters | Phase 3 | 🔜 Planned (Q3–Q4 2026) |

See [Roadmap.md](../Roadmap.md) for full milestone details.
