# Ndi-Fi Risk Disclosures

> **Read this before using the protocol.**
> Participation in Ndi-Fi involves significant financial risk. The disclosures below describe the principal risks for each product. This is not investment advice, and nothing here constitutes a promise of returns. You may lose some or all of the assets you deposit.
>
> _A formal legal review is required before any mainnet deployment. The team will commission independent legal counsel to review and supplement these disclosures prior to launch._

---

## Lending

### Smart contract risk
The `NdiFiLending` and `NdiFiVault` contracts have not yet been audited by an independent security firm. Bugs or vulnerabilities in the code could allow an attacker to drain deposited funds or manipulate loan accounting. Even audited contracts carry residual risk.

### Oracle / price feed risk
Loan health is calculated using Chainlink price feeds. If a price feed is manipulated, stale, or temporarily unavailable, the protocol may compute incorrect health factors — either triggering unjust liquidations or failing to liquidate under-collateralized positions in time.

### Liquidation risk
If the value of your collateral falls faster than the liquidation process can execute, your collateral may be seized at a loss. Network congestion, gas spikes, or low liquidator participation can delay liquidations, leaving the protocol under-collateralized and potentially exposing depositors to bad debt.

### Collateral concentration risk
During Phase 1 the protocol accepts a limited set of collateral assets. High correlation between collateral assets in a market downturn can cause simultaneous liquidations across many positions, amplifying the above risks.

### Borrower repayment risk
Borrowers who fail to maintain a healthy collateral ratio face liquidation. Users should monitor their health factor and add collateral or repay promptly if it approaches the liquidation threshold.

---

## Staking

### Smart contract risk
The `NdiFiStaking` contract has not yet been independently audited. A bug could prevent withdrawals, incorrectly calculate rewards, or allow an attacker to claim funds that do not belong to them.

### Reward token supply risk
Staking rewards are paid by transferring `rewardToken` from the contract balance. If the contract is not adequately funded, reward claims will fail. The team is responsible for maintaining sufficient reward token reserves, and there is no on-chain guarantee of reward continuity.

### Lock-up / liquidity risk
Staked assets are subject to a **21-day withdrawal waiting period**. During this window you cannot access your principal. If you need liquidity urgently, you will not be able to retrieve your funds before the period expires.

### Vault share price risk
Staked assets are deposited into an ERC-4626 vault. The vault's share price can decrease if the underlying strategy incurs losses, which would reduce the amount of assets you receive on withdrawal.

### Reward calculation bug (known)
The current implementation sets `withdrawn = true` before computing final rewards in `executeWithdrawal()`. This means the final reward payment is zero unless you call `claimRewards()` before executing your withdrawal. This is a known issue and will be fixed in an upcoming release. See [NdiFiStaking_README.md](../NdiFiStaking_README.md#security-considerations--known-caveats) for details.

---

## General / Protocol-wide

### Upgradeability risk
Core contracts in Phase 1 are not upgradeable. This means security fixes require deploying new contracts and migrating funds. A migration process carries its own operational risks.

### Governance and admin key risk
Until Phase 3 (DAO governance), all privileged functions — setting the collateral factor, authorizing contracts, pausing the protocol — are controlled by a small number of private keys. Compromise, loss, or misuse of those keys would have serious consequences for the protocol. The team will use multi-signature wallets and a time-lock before mainnet launch.

### Regulatory risk
The legal status of DeFi protocols varies by jurisdiction and continues to evolve. Users are responsible for complying with the laws and regulations applicable to them. The Ndi-Fi team makes no representation about the legal permissibility of using this protocol in any specific jurisdiction.

### Economic and market risk
Crypto asset prices are highly volatile. Systemic market events (flash crashes, liquidity crises, protocol contagion) can rapidly change the risk profile of positions and may exceed what the protocol's parameters were designed to handle.

---

## Where these disclosures appear

These risk disclosures are surfaced in two places in the dApp:

1. **App footer** — a persistent link labeled "Risk Disclosures" on every page.
2. **Onboarding flow** — a summary is shown and must be acknowledged the first time a user connects their wallet.

---

## Legal review note (pre-mainnet)

Before the protocol is deployed to Ethereum mainnet, the founding team will:

1. Engage independent legal counsel to review these disclosures and assess regulatory obligations.
2. Determine whether additional jurisdiction-specific disclosures are required.
3. Obtain a written legal opinion covering the product offering.

This document will be updated to reflect the outcome of that review.
