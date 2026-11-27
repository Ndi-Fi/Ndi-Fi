# Borrowing and Liquidation Guide

Ndi-Fi's lending contract (`src/NdiFiLending.sol`) lets you borrow against collateral you deposit. This guide explains how to open a loan, how to stay safe, what liquidation means, and how to avoid it.

---

## Overview of the lending model

You deposit a supported collateral token and borrow the protocol's lending token against it. The contract is an over-collateralised single-loan-per-address system: you must deposit more value than you borrow, and you can only hold one active loan at a time.

The loan amount you can take is capped by the **collateral factor** (e.g. 75%), meaning you can borrow up to 75% of the USD value of your collateral. If the value of your collateral falls—or if the lending token appreciates—your position becomes riskier, and eventually eligible for liquidation.

---

## Key parameters

| Parameter | Meaning | Example |
|---|---|---|
| `collateralFactor` | Maximum borrow-to-collateral ratio | 75 (75%) |
| `liquidationThreshold` | Collateral ratio below which liquidation is allowed | 85 (85%) |
| `originationFeeRate` | One-time fee charged at loan origination, in basis points | 50 (0.5%) |
| `liquidationPenalty` | Extra collateral seized by the liquidator as a bonus, in basis points | 500 (5%) |

These values are set by the owner at initialization and can be updated within on-chain bounds: `collateralFactor` must be less than `liquidationThreshold`; `originationFeeRate` is capped at 1,000 bps (10%); `liquidationPenalty` is capped at 2,000 bps (20%).

---

## Step-by-step: opening a loan

### 1. Deposit collateral

```solidity
function depositCollateral(address tokenAddress, uint256 amount) external
```

Transfers `amount` of `tokenAddress` from your wallet to the lending contract. The token must be in the supported-collateral list (check `supportedCollateralTokenAddresses`). You can deposit multiple supported tokens; their combined USD value determines your borrowing capacity.

### 2. Check how much you can borrow

```solidity
function getCollateralValue(address user) public view returns (uint256)
```

Returns your total collateral value in USD (8-decimal Chainlink price format, scaled to 18 decimals internally). Your maximum borrow amount in USD is:

```
maxBorrowUSD = getCollateralValue(user) × collateralFactor / 100
```

Convert from USD to lending token units using the lending token's Chainlink price feed.

### 3. Take a loan

```solidity
function takeLoan(uint256 amount) external
```

`amount` is in lending token units (the gross amount including the origination fee). The contract:

1. Calculates `originationFee = amount × originationFeeRate / 10000`.
2. Calculates `netLoanAmount = amount − originationFee`.
3. Checks that the vault has enough idle liquidity for `netLoanAmount`.
4. Checks that your collateral covers `amount` at the collateral factor.
5. Locks the minimum collateral needed to back the loan.
6. Records the `Loan` struct (principal, origination fee, locked collateral amount, start time).
7. Calls `vault.withdrawForLoan(msg.sender, netLoanAmount)` to send you the net amount.
8. Emits `LoanTaken(user, amount, collateralLocked)`.

You receive `netLoanAmount`. The origination fee is added to your total debt but not sent to you.

### 4. Repay the loan

```solidity
function repayLoan(uint256 amount) external
```

You must repay the **full debt** in one transaction: `principal + originationFee`. Partial repayments are not supported. The function:

1. Transfers `amount` of the lending token from you to the contract.
2. Clears the loan record.
3. Unlocks all collateral that was locked for the loan.
4. Emits `LoanRepaid(user, amount, originationFee)`.

After repayment, you can withdraw your collateral freely.

---

## Health factor

The health factor is a single number that expresses how close your loan is to liquidation. A health factor at or above 100 is safe; below 100 means your position is liquidatable.

```
healthFactor = (collateralValue × liquidationThreshold / 100) × 100 / loanValueUSD
```

Equivalently:

```
healthFactor = (collateralValueUSD × liquidationThreshold) / loanValueUSD
```

A health factor of exactly 100 means your collateral value (adjusted by the liquidation threshold) exactly equals your loan value. Any further drop in collateral value or rise in loan value pushes it below 100.

You can read it at any time:

```solidity
function calculateHealthFactor(address borrower) public view returns (uint256)
```

Returns `type(uint256).max` if the borrower has no active loan.

---

## Worked examples

### Example 1 — safe borrow

- Collateral: 1 ETH = $3,000
- Collateral factor: 75%
- Maximum borrow: $3,000 × 0.75 = $2,250 worth of lending token
- You borrow $2,000 worth of lending token

**Health factor immediately after borrowing:**

```
liquidationThreshold = 85%
healthFactor = ($3,000 × 85) / $2,000 = 127.5 → 127
```

Your position is healthy. 27 percentage points of buffer before liquidation.

---

### Example 2 — price drop scenario

Same position: $3,000 collateral, $2,000 loan.

ETH drops to $2,500:

```
healthFactor = ($2,500 × 85) / $2,000 = 106.25 → 106
```

Still safe, but the buffer has narrowed. Add more collateral or repay some debt.

ETH drops to $2,353:

```
healthFactor = ($2,353 × 85) / $2,000 = 99.99 → 99
```

The position is now **liquidatable**.

---

### Example 3 — origination fee effect

You call `takeLoan(1000 USDC)` with a 0.5% origination fee:

- `originationFee` = 5 USDC
- `netLoanAmount` you receive = 995 USDC
- Total debt to repay = 1,000 USDC

Your loan's USD value for the health factor calculation is based on the full `principal` (1,000 USDC), not the net amount you received.

---

### Example 4 — staying ahead of liquidation

Target health factor: ≥ 150. You have:

- ETH collateral worth $3,000
- Loan: $2,000 USD

Current HF = 127. To reach 150:

```
targetCollateral = (150 × loanValue) / liquidationThreshold
                 = (150 × 2,000) / 85
                 = $3,529
```

You need to add $3,529 − $3,000 = **$529 more collateral**, or repay approximately:

```
targetLoan = (collateralValue × liquidationThreshold) / 150
           = ($3,000 × 85) / 150
           = $1,700
```

Repay $300 to reach HF 150.

---

## Liquidation

### Trigger

Liquidation is available when `calculateHealthFactor(borrower) < 100`.

### Who liquidates?

Currently, only the contract owner can call `liquidateLoan`. This is enforced by the `onlyLiquidator` modifier:

```solidity
modifier onlyLiquidator() {
    require(msg.sender == owner(), "Not authorized liquidator");
    _;
}
```

### What happens during liquidation

```solidity
function liquidateLoan(address borrower) external onlyLiquidator
```

1. Verifies health factor is below 100.
2. Calculates `totalDebt = principal + originationFee` in token units.
3. Converts debt to USD using the Chainlink price feed.
4. Adds the liquidation penalty: `collateralToSeize = debtUSD + (debtUSD × liquidationPenalty / 10000)`.
5. Transfers `totalDebt` lending tokens from the liquidator to the contract (the liquidator repays the debt).
6. Seizes collateral worth `collateralToSeize` USD from the borrower's account, starting with the highest-value tokens, and sends it to the liquidator.
7. Clears the loan and unlocks remaining collateral for the borrower.
8. Emits `LoanLiquidated(borrower, liquidator, collateralSeized, debtRepaid)`.

The liquidator profits by the value of the penalty: they repay debt worth $X but receive collateral worth $X × (1 + penalty%). At a 5% penalty, liquidating a $2,000 debt yields $2,100 in collateral, a $100 gross profit before gas.

### After liquidation

Your loan is cleared. Any collateral not seized to cover the debt and penalty remains in your account balance and you can withdraw it normally.

---

## How to prevent liquidation

**Monitor your health factor.** Check `calculateHealthFactor` regularly, especially during volatile market conditions.

**Keep a large buffer.** A health factor of 150+ gives substantial room before liquidation. The difference between 85% (liquidation threshold) and your effective LTV is your safety margin.

**Add collateral proactively.** If your health factor drops toward 110, deposit more collateral before it falls below 100.

**Repay partially.** Because `repayLoan` requires full repayment, if you cannot repay in full, focus on adding collateral instead.

**Avoid borrowing at the maximum.** Taking the maximum loan (`collateralFactor` = 75%) leaves only a 10-point gap to the liquidation threshold (85%). A 13% drop in collateral value would immediately liquidate you at max borrow.

**Watch the lending token price.** If you borrowed a volatile token, its price rising increases your effective loan value and reduces your health factor even if your collateral price stays flat.

---

## Withdrawing collateral

```solidity
function withdrawCollateral(address tokenAddress, uint256 amount) external
```

You can withdraw any collateral that is not locked by an active loan. Locked collateral is tracked per token in `lockedCollateral[user][token]`. The function computes:

```
available = collateralBalance[user][token] − lockedCollateral[user][token]
```

and reverts if you request more than the available amount.

---

## Reading your position

```solidity
function getLoanDetails(address user) external view returns (
    uint256 principal,
    uint256 originationFee,
    uint256 totalDebt,
    uint256 collateralAmount,
    uint256 healthFactor,
    bool isActive
)
```

```solidity
function getCollateralValue(address user) public view returns (uint256)
```

```solidity
function getContractStats() external view returns (
    uint256 totalCollateral,
    uint256 totalBorrowed,
    uint256 availableLiquidity,
    uint256 utilizationRate
)
```

---

## Risk disclosures

1. **Oracle risk.** Collateral and lending token prices come from Chainlink price feeds. A stale or manipulated feed could trigger wrongful liquidation or allow undercollateralised borrowing. The contract uses `latestRoundData` without a staleness check in the current version.

2. **Full repayment only.** You must repay `principal + originationFee` in one transaction. If the lending token is illiquid, you may be unable to repay quickly enough to avoid liquidation.

3. **Single loan per address.** You cannot take a second loan without fully repaying the first. Plan your positions accordingly.

4. **Liquidation by owner only.** The current implementation restricts liquidation to the contract owner. This means third-party liquidation bots cannot participate. If the owner is slow to act, undercollateralised positions may persist briefly.

5. **Smart contract risk.** The contract has not been externally audited. Do not borrow amounts you cannot afford to lose.

6. **Pause risk.** The owner can pause the contract, which blocks all deposits, withdrawals, borrows, and repayments. Emergency withdrawal of non-loan ERC-20 tokens remains available to the owner.

---

## Related documentation

- [Staking Guide](Staking-Guide.md) — earn NDI rewards by staking LP tokens
- [NdiPoint Token Guide](NdiPoint-Guide.md) — NDI token roles and mechanics
- [Vault documentation](VAULT_ERC4626.md) — ERC-4626 vault backing the lending pool
- [Oracle documentation](ORACLE.md) — Chainlink price feed integration
