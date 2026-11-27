# Ndi-Fi Error Catalogue

This document is the single reference for every error that the Ndi-Fi protocol can raise, on both the Solidity (EVM) and Stellar (Soroban) stacks. Frontend teams should map these to user-facing messages using the tables below.

---

## Solidity contracts

### `NdiFiVault.sol`

Custom errors declared with `error` and thrown with `revert`.

| Error | Trigger condition | Suggested user-facing message |
|---|---|---|
| `underMaintenance()` | Called while `maintenanceOngoing == true` | "The vault is under maintenance. Please try again later." |
| `stakingCapExceeded()` | A deposit would push total managed assets above the staking cap | "Deposit limit reached. The vault is at capacity." |
| `onlyOwnerAction()` | A restricted function is called by a non-owner | "Only the contract owner can perform this action." |
| `invalidAddress()` | A zero address is passed where a real address is required | "Invalid address provided." |
| `invalidDepositAmount()` | Deposit amount or share count is zero or negative | "Deposit amount must be greater than zero." |
| `invalidWithdrawAmount()` | Withdraw share count is zero or negative | "Withdraw amount must be greater than zero." |
| `invalidAmount()` | A generic amount or cap value is zero, negative, or exceeds available assets | "Invalid amount." |
| `unauthorizedCaller()` | A function restricted to `authorizedLendingContract` is called by another address | "Only the authorized lending contract can call this function." |

---

### `NdiFiLending.sol`

Uses `require` with string messages; no custom `error` declarations.

| Revert string | Trigger condition | Suggested user-facing message |
|---|---|---|
| `"Not authorized liquidator"` | `liquidate` called by an address that is not the owner-approved liquidator | "You are not authorised to liquidate this position." |
| `"Contract not initialized"` | A function guarded by `initialized` is called before `initialize` | "Contract setup is incomplete. Contact the team." |
| `"Already initialized"` | `initialize` is called a second time | "Contract is already initialized." |
| `"Invalid lending token"` | Zero address passed for the lending token during initialization | "Invalid lending token address." |
| `"Invalid vault address"` | Zero address passed for the vault during initialization | "Invalid vault address." |
| `"Invalid token address"` | Zero address passed when adding a collateral token | "Invalid collateral token address." |
| `"Invalid price feed address"` | Zero address passed for a Chainlink price feed | "Invalid price feed address." |
| `"Token already supported"` | `addCollateralToken` called for a token that is already registered | "This collateral token is already supported." |
| `"Token not supported"` | `removeCollateralToken` or a borrow call references an unregistered token | "This token is not accepted as collateral." |
| `"Invalid collateral factor"` | Collateral factor is zero, above 100, or not less than the liquidation threshold | "Collateral factor must be between 1 and 99 and below the liquidation threshold." |
| `"Invalid liquidation threshold"` | Liquidation threshold is above 100 or not greater than the collateral factor | "Liquidation threshold must be between the collateral factor and 100." |
| `"Origination fee too high"` | Origination fee rate exceeds 1000 basis points (10 %) | "Origination fee cannot exceed 10 %." |
| `"Liquidation penalty too high"` | Liquidation penalty exceeds 2000 basis points (20 %) | "Liquidation penalty cannot exceed 20 %." |
| `"Amount must be greater than zero"` | A deposit, withdrawal, or borrow of zero is attempted | "Amount must be greater than zero." |
| `"Insufficient collateral"` | Withdrawal would exceed the user's posted collateral balance | "Insufficient collateral balance." |
| `"Cannot withdraw collateral locked for loan"` | Withdrawal would leave less collateral than the locked amount | "Some of your collateral is locked against an active loan." |
| `"Transfer failed"` | An ERC-20 `transfer` or `transferFrom` returns false | "Token transfer failed. Check your balance and allowance." |
| `"No collateral deposited"` | Borrow attempted with zero total collateral value | "You must deposit collateral before borrowing." |
| `"Existing loan must be repaid first"` | A new borrow is attempted while a loan is already active | "Repay your existing loan before opening a new one." |
| `"Insufficient vault liquidity"` | Borrow amount exceeds the vault's available liquidity | "The vault does not have enough liquidity for this loan." |
| `"Loan exceeds collateral limit"` | Requested borrow value exceeds `collateralValue * collateralFactor / 100` | "Loan amount exceeds your borrowing limit." |
| `"Insufficient collateral for this loan"` | Collateral value is below the required level after fee application | "Insufficient collateral to cover this loan amount." |
| `"No active loan"` | Repay or liquidation called when the user has no active loan | "You have no active loan to repay." |
| `"Must repay full debt amount"` | Partial repayment attempted (protocol requires full repayment) | "Full repayment is required. Partial repayments are not supported." |
| `"No active loan"` (liquidation) | `liquidate` called for a borrower with no active loan | "No active loan found for this borrower." |
| `"Loan is not liquidatable"` | Health factor is ≥ 100 (position is healthy) | "This loan is not eligible for liquidation." |
| `"Debt repayment failed"` | Liquidator's ERC-20 transfer for debt repayment fails | "Debt repayment transfer failed." |
| `"Collateral transfer failed"` | Transfer of seized collateral to liquidator fails | "Collateral transfer failed." |
| `"Emergency withdrawal failed"` | Owner's emergency withdrawal transfer fails | "Emergency withdrawal failed." |

---

### `NdiFiStaking.sol`

Uses `require` with string messages.

| Revert string | Trigger condition | Suggested user-facing message |
|---|---|---|
| `"Zero address"` | A zero address is passed for stake token, reward token, or vault during construction | "Invalid contract address provided." |
| `"Vault asset mismatch"` | Stake token does not match the vault's underlying asset | "Stake token does not match the vault asset." |
| `"Stake amount invalid"` | Stake amount is below `minStake` or above `maxStake` | "Stake amount must be between the minimum and maximum allowed." |
| `"Already staked"` | User attempts to stake while already holding an active (non-withdrawn) stake | "You already have an active stake. Unstake first." |
| `"No active stake"` | Claim, unstake request, or withdrawal called with no active stake | "You have no active stake." |
| `"No rewards"` | Claim called when pending rewards are zero | "No rewards available to claim yet." |
| `"Already requested"` | `requestWithdrawal` called when a withdrawal is already pending | "A withdrawal request is already open." |
| `"No withdrawal requested"` | `withdraw` called without a prior `requestWithdrawal` | "Submit a withdrawal request first." |
| `"Too early"` | Withdrawal attempted before the cooldown period (`WITHDRAW_WAIT`) has elapsed | "The cooldown period has not passed yet." |
| `"Already withdrawn"` | Withdrawal called on a stake that has already been withdrawn | "This stake has already been withdrawn." |
| `"No profits"` | `distributeVaultProfits` called when profit is zero | "No vault profits to distribute." |

---

### `NdiPoint.sol`

Uses `require` with string messages prefixed `"NdiPoint: "`.

| Revert string | Trigger condition | Suggested user-facing message |
|---|---|---|
| `"NdiPoint: initial owner cannot be zero address"` | Constructor receives a zero address for the initial owner | "Owner address cannot be zero." |
| `"NdiPoint: cannot mint to zero address"` | `mint` target is the zero address | "Cannot mint to the zero address." |
| `"NdiPoint: minting would exceed max supply"` | Mint would push total supply above `MAX_SUPPLY` (1 billion NDI) | "Mint would exceed the maximum token supply." |
| `"NdiPoint: arrays length mismatch"` | `batchDistributeRewards` receives arrays of unequal length | "Recipients and amounts arrays must be the same length." |
| `"NdiPoint: empty arrays"` | `batchDistributeRewards` receives empty arrays | "At least one recipient is required." |
| `"NdiPoint: reward distribution would exceed max supply"` | Batch or single reward distribution would push total supply above `MAX_SUPPLY` | "Reward distribution would exceed the maximum token supply." |
| `"NdiPoint: cannot distribute to zero address"` | A recipient in a distribution call is the zero address | "Cannot distribute rewards to the zero address." |
| `"NdiPoint: amount must be greater than zero"` | A distribution amount is zero | "Distribution amount must be greater than zero." |
| `"NdiPoint: cannot authorize zero address"` | `authorizeContract` receives a zero address | "Cannot authorize the zero address." |
| `"NdiPoint: cannot recover own tokens"` | `recoverTokens` is called with the NdiPoint contract address itself | "Cannot recover the protocol's own token." |
| `"NdiPoint: cannot recover to zero address"` | `recoverTokens` target address is zero | "Recovery destination cannot be the zero address." |

---

## Stellar / Soroban contracts

Soroban errors are integer-keyed `contracterror` enums. Clients receive the numeric code; map it to a message using the tables below.

### `NdiLending` — `LendingError`

Source: `stellar/contracts/ndi_lending/src/errors.rs`

| Code | Variant | Trigger condition | Suggested user-facing message |
|---|---|---|---|
| 1 | `InvalidAmount` | A deposit, withdraw, borrow, or repay amount is zero or negative | "Amount must be greater than zero." |
| 2 | `DepositCapExceeded` | Deposit would push total managed assets above the deposit cap | "Deposit limit reached. The vault is at capacity." |
| 3 | `InsufficientShares` | Owner does not hold enough shares for a withdraw or redeem | "Insufficient share balance for this withdrawal." |
| 4 | `InsufficientLiquidity` | Not enough idle assets in the vault (the rest is lent out) | "Insufficient vault liquidity for this operation." |
| 5 | `ZeroShares` | Deposit is too small to mint at least one share | "Deposit amount is too small." |
| 6 | `ZeroAssets` | Redeem is too small to return at least one asset unit | "Share amount is too small to redeem." |
| 7 | `NoBorrower` | `borrow` called when no borrower address has been set | "No authorized borrower configured." |
| 8 | `DebtOutstanding` | `set_borrower` called while debt is still outstanding | "Repay all debt before changing the borrower." |
| 9 | `NoDebt` | `repay` called when there is no outstanding debt | "No debt to repay." |
| 10 | `InvalidRate` | Interest rate is outside 0–`MAX_RATE` | "Interest rate is out of the allowed range." |
| 11 | `InvalidCap` | Deposit cap set to zero or below | "Deposit cap must be greater than zero." |
| 12 | `MathOverflow` | An internal arithmetic operation overflowed | "Internal calculation error. Please try a smaller amount." |

---

### `NdiStaking` — `StakingError`

Source: `stellar/contracts/ndi_staking/src/errors.rs`

| Code | Variant | Trigger condition | Suggested user-facing message |
|---|---|---|---|
| 1 | `InvalidAmount` | Stake or fund_rewards amount is zero or negative | "Amount must be greater than zero." |
| 2 | `StakeOutOfRange` | Stake amount is below `min_stake` or above `max_stake` | "Stake amount must be within the allowed range." |
| 3 | `AlreadyStaked` | User attempts to stake while already holding an active stake | "You already have an active stake." |
| 4 | `NoActiveStake` | Claim, request_unstake, unstake, or emergency_withdraw called with no stake | "You have no active stake." |
| 5 | `NoRewards` | `claim` called when pending rewards are zero | "No rewards available to claim." |
| 6 | `InsufficientRewardPool` | Reward payout would exceed the funded reward pool | "The reward pool is insufficient. Contact the protocol owner." |
| 7 | `UnstakeAlreadyRequested` | `request_unstake` called when a request is already open | "An unstake request is already pending." |
| 8 | `UnstakeNotRequested` | `unstake` called without a prior `request_unstake` | "Submit an unstake request first." |
| 9 | `CooldownNotElapsed` | `unstake` called before the cooldown period has elapsed | "The cooldown period has not passed yet." |
| 10 | `InvalidConfig` | Constructor arguments are inconsistent (e.g. min_stake > max_stake) | "Invalid staking configuration." |
| 11 | `MathOverflow` | An internal arithmetic operation overflowed | "Internal calculation error. Please try a smaller amount." |

---

## Frontend integration notes

- **EVM**: errors are ABI-encoded. Decode the `data` field of a reverted transaction against the ABI to match the selector to a custom error or extract the string from a `require`-style revert.
- **Soroban**: the SDK surfaces the error code as an integer inside a `SorobanRpcError`. Map the `(contractAddress, code)` pair to the table above.
- If you receive an error code not listed here, treat it as an unexpected contract version and show a generic "Transaction failed — please update the app" message.
