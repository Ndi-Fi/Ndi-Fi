# Ndi-Fi Interest Rate Model

This document describes the fixed-fee model currently in production and the
utilization-based dynamic model planned for Phase 2 of the
[roadmap](../Roadmap.md#phase-2-ecosystem-expansion--feature-growth-q1-q2-2026).

---

## Current model: fixed origination fee

### How it works

The MVP uses a **one-time origination fee** charged when a loan is opened.
There is no ongoing interest accrual; the borrower's total repayment obligation
is fixed at origination.

| Parameter | Storage variable | Configured as |
|---|---|---|
| Origination fee rate | `originationFeeRate` | Basis points (1 bp = 0.01 %) |
| Collateral factor | `collateralFactor` | Percentage (e.g., `75` = 75 %) |
| Liquidation threshold | `liquidationThreshold` | Percentage (e.g., `85` = 85 %) |

**Basis points:** `originationFeeRate = 50` means a 0.5 % fee.

### Fee calculation

When `takeLoan(amount)` is called:

```
originationFee = (amount × originationFeeRate) / BASIS_POINTS
totalOwed      = amount + originationFee
```

`BASIS_POINTS` is the constant `10 000`.

The `originationFee` is recorded in the `Loan` struct and must be repaid
together with the principal to close the loan.

### Worked example — borrower perspective

> Alice wants to borrow **1 000 DAI**. The origination fee rate is **50 bp
> (0.5 %)**.

```
originationFee = (1 000 × 50) / 10 000 = 5 DAI
totalOwed      = 1 000 + 5             = 1 005 DAI
```

Alice calls `repayLoan()` at any time and pays back **1 005 DAI** to unlock her
collateral. The 5 DAI fee is routed to the protocol vault.

### Worked example — collateral requirement

> Alice's chosen collateral is ETH, priced at 2 000 DAI.  
> The collateral factor is 75 %.  
> She wants to borrow 1 000 DAI.

```
Minimum collateral value = borrowAmount / (collateralFactor / 100)
                         = 1 000 / 0.75 ≈ 1 333.33 DAI

ETH needed               = 1 333.33 / 2 000 ≈ 0.667 ETH
```

Alice must deposit at least **0.667 ETH** to open this loan.

### Updating the fee rate

The contract owner calls `updateOriginationFeeRate(uint256 newRate)`.  
The event `OriginationFeeRateUpdated(oldRate, newRate)` is emitted.  
The change applies only to loans opened **after** the update; existing loans
retain the fee baked in at origination.

---

## Planned model: utilization-based dynamic rate (Phase 2)

The dynamic model replaces the flat origination fee with a **continuously
accruing borrow rate** that adjusts automatically based on how much of the
vault's liquidity is currently borrowed.

### Motivation

A fixed fee does not respond to supply and demand. When the vault is nearly
empty, borrowers should pay more to protect liquidity; when it is under-used,
rates should be low to attract borrowers. A utilization-based model aligns
incentives and improves capital efficiency.

### Utilization rate

```
U = totalBorrowed / totalAssets
```

Where `totalAssets` is the sum of assets held in the vault plus assets lent out.

| Utilization | Meaning |
|---|---|
| `U = 0` | All liquidity is idle — lowest borrowing cost |
| `U = 1` | All liquidity is borrowed — highest borrowing cost, withdrawals unavailable |

### Two-slope interest rate curve

The planned model uses the standard two-slope (kinked) curve common in Aave and
Compound:

```
if U ≤ U_optimal:
    borrowRate = R_base + U × (R_slope1 / U_optimal)
else:
    borrowRate = R_base + R_slope1 + (U − U_optimal) × (R_slope2 / (1 − U_optimal))
```

Proposed initial parameters (subject to governance):

| Parameter | Symbol | Proposed value |
|---|---|---|
| Base rate | `R_base` | 1 % APR |
| Optimal utilization | `U_optimal` | 80 % |
| Slope below optimal | `R_slope1` | 4 % APR |
| Slope above optimal | `R_slope2` | 75 % APR |

The steep `R_slope2` above 80 % utilization discourages borrowers from draining
the vault and incentivizes depositors to add liquidity.

### Worked examples — dynamic rate

**Example A — low utilization (U = 40 %)**

```
borrowRate = 0.01 + 0.40 × (0.04 / 0.80)
           = 0.01 + 0.02
           = 3 % APR
```

**Example B — optimal utilization (U = 80 %)**

```
borrowRate = 0.01 + 0.80 × (0.04 / 0.80)
           = 0.01 + 0.04
           = 5 % APR
```

**Example C — above optimal (U = 90 %)**

```
borrowRate = 0.01 + 0.04 + (0.90 − 0.80) × (0.75 / 0.20)
           = 0.05 + 0.375
           = 42.5 % APR
```

The sharp rate spike above 80 % gives borrowers a strong incentive to repay and
creates yield for depositors during periods of tight liquidity.

### Supplier rate

The lend (supply) APR is lower than the borrow APR because only the borrowed
fraction of the pool is earning:

```
supplyRate = borrowRate × U × (1 − reserveFactor)
```

Where `reserveFactor` is a protocol-owned slice of interest (proposed: 10 %).

**Example — supply rate at 90 % utilization:**

```
supplyRate = 0.425 × 0.90 × (1 − 0.10) = 34.4 % APR
```

### Implementation notes

- Rates accrue per second using a time-weighted accumulator, similar to
  Compound's `borrowIndex`.
- An on-chain `InterestRateModel` contract will be deployed separately and
  referenced by `NdiFiLending` via an interface, so the model can be upgraded
  by governance without migrating principal balances.
- Parameter changes will require a two-day time-lock once the DAO is live
  (Phase 3).

---

## Summary comparison

| Dimension | Phase 1 (fixed fee) | Phase 2 (dynamic) |
|---|---|---|
| Cost to borrower | One-time fee at origination | Accruing APR, rate depends on utilization |
| Responds to demand | No | Yes |
| Complexity | Low | Medium |
| Depositor yield | None from interest | Proportional to utilization |
| Governance surface | `updateOriginationFeeRate` | Rate curve parameters via DAO |

---

## Related docs

- [Roadmap — Phase 2](../Roadmap.md#phase-2-ecosystem-expansion--feature-growth-q1-q2-2026)
- [Vault ERC-4626 conformance](VAULT_ERC4626.md)
- [Risk disclosures](risk-disclosures.md)
- [Audit readiness](AUDIT_READINESS.md)
