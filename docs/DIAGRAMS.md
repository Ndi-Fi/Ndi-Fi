# Core Flow Diagrams

This document contains Mermaid sequence and flow diagrams for the key operations in the Ndi-Fi protocol. All diagrams are kept in source form so they stay in sync with contract changes and render natively in GitHub, Docusaurus, and most modern Markdown viewers.

> **Keeping diagrams up to date:** When a contract changes a flow (new guard, new event, changed actor), update the corresponding diagram in the same PR. Diagrams that drift from contract behavior are more harmful than no diagrams.

---

## 1. Deposit into NdiFiVault / NdiLending (Solidity)

A user deposits an ERC-20 asset into the vault and receives vault shares in return.

```mermaid
sequenceDiagram
    actor User
    participant ERC20 as ERC-20 Asset
    participant Vault as NdiFiVault
    participant Shares as Vault Shares (ERC-4626)

    User->>ERC20: approve(vault, amount)
    User->>Vault: deposit(amount, receiver)
    Vault-->>Vault: check maintenanceOngoing
    Vault-->>Vault: check stakingCap
    Vault->>ERC20: transferFrom(user, vault, amount)
    Vault->>Shares: _mint(receiver, shares)
    Vault-->>User: emit Deposit(user, receiver, amount, shares)
```

---

## 2. Borrow (NdiFiLending — Solidity)

A borrower posts collateral and draws a loan from the vault's available liquidity.

```mermaid
sequenceDiagram
    actor Borrower
    participant Collateral as ERC-20 Collateral
    participant Lending as NdiFiLending
    participant Vault as NdiFiVault
    participant LendToken as Lending Token (e.g. DAI)

    Borrower->>Collateral: approve(lending, collateralAmount)
    Borrower->>Lending: depositCollateral(token, amount)
    Lending->>Collateral: transferFrom(borrower, lending, amount)

    Borrower->>Lending: borrow(amount)
    Lending-->>Lending: check collateralValue ≥ requiredCollateralValue
    Lending-->>Lending: calculate originationFee
    Lending-->>Lending: lock collateral proportionally
    Lending->>Vault: withdrawFromVault(netLoanAmount)
    Vault->>LendToken: transfer(lending, netLoanAmount)
    Lending->>LendToken: transfer(borrower, netLoanAmount)
    Lending-->>Borrower: emit LoanOpened(borrower, amount, fee, dueAmount)
```

---

## 3. Repay loan (NdiFiLending — Solidity)

The borrower repays the full outstanding debt to unlock their collateral.

```mermaid
sequenceDiagram
    actor Borrower
    participant LendToken as Lending Token
    participant Lending as NdiFiLending
    participant Vault as NdiFiVault

    Borrower->>LendToken: approve(lending, totalDebt)
    Borrower->>Lending: repay(totalDebt)
    Lending-->>Lending: verify loan is active
    Lending-->>Lending: verify amount == totalDebt
    Lending->>LendToken: transferFrom(borrower, lending, totalDebt)
    Lending->>Vault: depositToVault(totalDebt)
    Lending-->>Lending: unlock collateral
    Lending-->>Borrower: emit LoanRepaid(borrower, totalDebt)
```

---

## 4. Liquidation (NdiFiLending — Solidity)

When a borrower's health factor drops below 100, an authorised liquidator can repay their debt and seize collateral at a discount.

```mermaid
sequenceDiagram
    actor Liquidator
    participant LendToken as Lending Token
    participant Lending as NdiFiLending
    participant Collateral as ERC-20 Collateral
    participant Vault as NdiFiVault

    Liquidator->>Lending: liquidate(borrower)
    Lending-->>Lending: check caller is owner-approved liquidator
    Lending-->>Lending: calculate healthFactor
    Lending-->>Lending: assert healthFactor < 100
    Liquidator->>LendToken: approve(lending, totalDebt)
    Lending->>LendToken: transferFrom(liquidator, lending, totalDebt)
    Lending->>Vault: depositToVault(totalDebt)
    Lending-->>Lending: calculate seizedCollateral (debt + liquidationPenalty)
    Lending->>Collateral: transfer(liquidator, seizedCollateral)
    Lending-->>Liquidator: emit LoanLiquidated(borrower, liquidator, totalDebt, seizedCollateral)
```

---

## 5. Stake (NdiFiStaking — Solidity)

A user deposits vault shares to start earning NDI rewards.

```mermaid
sequenceDiagram
    actor User
    participant StakeToken as Stake Token (vault shares)
    participant Staking as NdiFiStaking

    User->>StakeToken: approve(staking, amount)
    User->>Staking: stake(amount)
    Staking-->>Staking: check amount in [minStake, maxStake]
    Staking-->>Staking: check no existing active stake
    Staking->>StakeToken: transferFrom(user, staking, amount)
    Staking-->>Staking: record StakeInfo (amount, startTime)
    Staking-->>User: emit Staked(user, amount)
```

---

## 6. Unstake with cooldown (NdiFiStaking — Solidity)

Unstaking is a two-step process: request then withdraw after the cooldown.

```mermaid
sequenceDiagram
    actor User
    participant Staking as NdiFiStaking
    participant StakeToken as Stake Token
    participant Reward as NDI Reward Token

    User->>Staking: requestWithdrawal()
    Staking-->>Staking: record WithdrawalRequest (timestamp)
    Staking-->>User: emit WithdrawalRequested(user, timestamp)

    Note over User,Staking: WITHDRAW_WAIT period passes

    User->>Staking: withdraw()
    Staking-->>Staking: check cooldown elapsed
    Staking-->>Staking: calculate pendingRewards
    Staking->>Reward: transfer(user, pendingRewards)
    Staking->>StakeToken: transfer(user, stakedAmount)
    Staking-->>User: emit Withdrawn(user, stakedAmount, pendingRewards)
```

---

## 7. Lending vault deposit (Stellar / Soroban)

```mermaid
sequenceDiagram
    actor Depositor
    participant Asset as SEP-41 Asset (XLM/USDC)
    participant Lending as NdiLending

    Depositor->>Lending: deposit(from, amount, min_shares)
    Lending-->>Lending: assert not paused
    Lending-->>Lending: check amount > 0 → else InvalidAmount
    Lending-->>Lending: check amount ≤ remaining cap → else DepositCapExceeded
    Lending-->>Lending: calculate shares → check > 0 → else ZeroShares
    Lending->>Asset: transfer(from → contract, amount)
    Lending-->>Depositor: return shares minted
```

---

## 8. Borrow and repay (Stellar / Soroban)

```mermaid
sequenceDiagram
    actor Borrower as Borrower (owner-approved)
    participant Asset as SEP-41 Asset
    participant Lending as NdiLending

    Borrower->>Lending: borrow(amount)
    Lending-->>Lending: require_auth(borrower)
    Lending-->>Lending: check borrower set → else NoBorrower
    Lending-->>Lending: check amount > 0 → else InvalidAmount
    Lending-->>Lending: check liquidity ≥ amount → else InsufficientLiquidity
    Lending-->>Lending: accrue interest
    Lending-->>Lending: record debt principal
    Lending->>Asset: transfer(contract → borrower, amount)

    Note over Borrower,Lending: Time passes, interest accrues

    Borrower->>Asset: approve(lending, debt + interest)
    Borrower->>Lending: repay(from, amount)
    Lending-->>Lending: require_auth(from)
    Lending-->>Lending: check debt > 0 → else NoDebt
    Lending-->>Lending: accrue interest, calculate total owed
    Lending->>Asset: transfer(from → contract, amount)
    Lending-->>Lending: clear debt record
    Borrower-->>Borrower: debt cleared
```

---

## 9. Staking on Stellar

```mermaid
sequenceDiagram
    actor User
    participant LP as LP Token (SEP-41)
    participant Staking as NdiStaking
    participant NDI as NdiToken (NDI)

    User->>Staking: stake(user, amount)
    Staking-->>Staking: require_auth(user)
    Staking-->>Staking: check amount > 0 → else InvalidAmount
    Staking-->>Staking: check min_stake ≤ amount ≤ max_stake → else StakeOutOfRange
    Staking-->>Staking: check no active stake → else AlreadyStaked
    Staking->>LP: transfer(user → contract, amount)
    Staking-->>Staking: record StakeInfo

    Note over User,Staking: Cooldown period after request_unstake

    User->>Staking: request_unstake(user)
    Staking-->>Staking: mark unstake_requested_at
    User->>Staking: unstake(user)
    Staking-->>Staking: check cooldown elapsed → else CooldownNotElapsed
    Staking-->>Staking: calculate pending rewards
    Staking->>NDI: transfer(contract → user, rewards)
    Staking->>LP: transfer(contract → user, staked amount)
```

---

## 10. High-level protocol overview

```mermaid
flowchart TD
    subgraph EVM ["Ethereum / EVM"]
        V[NdiFiVault\nERC-4626]
        L[NdiFiLending]
        S[NdiFiStaking]
        P[NdiPoint\nNDI token]

        V -- "liquidity" --> L
        L -- "repayments + fees" --> V
        S -- "staked shares" --> V
        P -- "NDI rewards" --> S
    end

    subgraph Stellar ["Stellar / Soroban"]
        SL[NdiLending\nvault shares]
        SS[NdiStaking]
        ST[NdiToken\nNDI]

        SL -- "liquidity" --> SL
        ST -- "rewards" --> SS
    end

    User1([EVM user]) --> V
    User1 --> L
    User1 --> S
    User2([Stellar user]) --> SL
    User2 --> SS
```

---

*Diagrams are written in [Mermaid](https://mermaid.js.org/) syntax. To render them locally, use the [Mermaid Live Editor](https://mermaid.live/) or any Markdown renderer with Mermaid support.*
