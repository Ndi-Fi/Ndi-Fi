# Ndi-Fi Glossary

A reference of DeFi and protocol-specific terms used across the Ndi-Fi codebase, documentation, and UI tooltips. Terms are listed alphabetically within each section.

---

## DeFi fundamentals

**Annual Percentage Rate (APR)**
The annualised cost of borrowing or the annualised reward for staking, expressed as a percentage of the principal. Ndi-Fi does not compound APR into APY within the protocol; interest accrues linearly per second.

**Collateral**
An asset deposited by a borrower to secure a loan. In `NdiFiLending`, supported ERC-20 tokens are locked when a loan is opened and released when the loan is fully repaid. In the Stellar `NdiLending` contract, the vault asset itself serves as the borrowable asset while vault shares represent the depositor's claim.

**Collateral Factor**
The maximum loan-to-value ratio permitted by the protocol, expressed as a whole-number percentage (e.g. 75 means you may borrow up to 75 % of your collateral's USD value). Set via `NdiFiLending.initialize()` and adjustable by the owner. Must always be lower than the liquidation threshold.

**Health Factor**
A single number that summarises the safety of an open loan:

```
health factor = (collateral value × liquidation threshold) / loan value × 100
```

A health factor at or above 100 means the position is safe. When it falls below 100, the position is eligible for liquidation. `type(uint256).max` is returned for accounts with no active loan.

**Liquidation**
Forced closure of an undercollateralised loan. A liquidator repays the full outstanding debt (principal + origination fee) and receives the borrower's locked collateral plus a liquidation penalty as a reward.

**Liquidation Threshold**
The collateral-to-loan ratio at which a position becomes eligible for liquidation, expressed as a whole-number percentage (e.g. 85). Must be higher than the collateral factor. Set via `NdiFiLending.initialize()`.

**Loan-to-Value (LTV)**
The ratio of the borrowed amount to the value of the collateral posted. A lower LTV means the position is safer. The collateral factor defines the maximum allowed LTV at origination.

**Origination Fee**
A one-time fee charged when a loan is opened, expressed in basis points (hundredths of a percent). Deducted from the gross loan amount before the net proceeds are sent to the borrower. For example, with a 50 bp fee on a 1 000 DAI loan, the borrower receives 995 DAI but must repay 1 000 DAI.

**Staking**
Locking tokens in a contract in exchange for rewards over time. In `NdiStaking` (Solidity), users deposit the vault's underlying asset, which is then deployed into the ERC-4626 vault. In `NdiStaking` (Soroban), users stake an LP token and earn NDI from a pre-funded reward pool.

**Vault (ERC-4626)**
A tokenised vault standard. Depositors send an underlying asset and receive proportional share tokens (NDI shares). Shares can be redeemed for the underlying asset at any time, subject to available liquidity. Ndi-Fi's `NdiFiVault` (Solidity) and `NdiLending` (Soroban) both implement this pattern.

---

## Protocol-specific terms

**Cooldown / Withdrawal Wait**
The mandatory delay between requesting an unstake and executing it. In the Solidity staking contract the cooldown is fixed at 21 days (`WITHDRAW_WAIT`). In the Soroban staking contract it is configurable per deployment (`cooldown` in the constructor, in seconds). Rewards continue to accrue during the cooldown.

**NDI**
The ERC-20 / SEP-41 share token minted by `NdiFiVault` / `NdiLending`. When you deposit DAI into the vault you receive NDI shares in return. NDI shares represent a proportional claim on the vault's total assets.

**NdiPoint (NDI points)**
A separate ERC-20 / SEP-41 reward token (ticker `NDI` on the Soroban side, `Ndi-Point` on the Solidity side) earned through staking, lending, and borrowing activity. NdiPoints are minted by the protocol and are non-transferable in concept but technically transferable on-chain. They are distinct from vault shares.

**NdiToken**
The Soroban (Stellar) implementation of NdiPoint. Capped at 1 billion tokens with 7 decimals. Minted to an initial owner at deployment (`INITIAL_SUPPLY` = 100 million). The owner distributes rewards via `distribute_reward` and `distribute_rewards`.

**Reward Pool**
In the Soroban staking contract, the balance of reward tokens held by the staking contract. Anyone can add to the pool via `fund_rewards`. If the pool is empty, `claim` and `unstake` will fail with `InsufficientRewardPool`.

**Reward Rate**
In Soroban staking, the annual reward per staked token, scaled by `1e7` (i.e. `RATE_SCALE = 10_000_000`). A `reward_rate` of `10_000_000` equals 100 % APR. In Solidity staking, the APY is passed as a whole-number percentage (e.g. `15` = 15 % APY).

**Staking Cap**
The maximum total assets the `NdiFiVault` will accept (default 100 000 DAI, adjustable by the owner via `setStakingCap`). Deposits that would push total assets above the cap are rejected.

**Vault Shares**
Tokens received when depositing into `NdiFiVault` or `NdiLending`. Each share represents a proportional claim on the vault's total assets. The share-to-asset ratio increases as the vault earns yield (via staking profits or interest).

---

## See also

- [Ndi-Fi Staking README](../NdiFiStaking_README.md)
- [NdiPoint README](../NdiPoint_README.md)
- [Event Catalogue](EventCatalogue.md)
- [Environment Variables](Environment.md)
