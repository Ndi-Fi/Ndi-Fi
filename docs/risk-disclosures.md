# Ndi-Fi Risk Disclosures

> **Read this before using the protocol.**  
> Participation in Ndi-Fi carries significant financial risk. The disclosures
> below describe the principal risks for each product. This document is not
> investment advice, and nothing here constitutes a promise of returns or
> solvency. You may lose some or all of the assets you deposit.
>
> _A formal legal review is required before any mainnet deployment. The team
> will commission independent legal counsel to review and supplement these
> disclosures prior to launch._

---

## Lending

### Smart contract risk

The `NdiFiLending` and `NdiFiVault` contracts have not yet been audited by an
independent security firm. Bugs or vulnerabilities in the code could allow an
attacker to drain deposited funds or manipulate loan accounting. Even audited
contracts carry residual risk. See [Audit readiness](AUDIT_READINESS.md) for
the current checklist status.

### Oracle / price feed risk

Loan health is calculated using Chainlink price feeds. If a feed is manipulated,
stale, or temporarily unavailable, the protocol may compute incorrect health
factors — either triggering unjust liquidations or failing to liquidate
under-collateralized positions in time. See [Oracle doc](ORACLE.md) for the
feed setup and fallback design.

### Liquidation risk

If the value of your collateral falls faster than the liquidation process can
execute, your collateral may be seized at a loss. Network congestion, gas
spikes, or low liquidator participation can delay liquidations, leaving the
protocol under-collateralized and potentially exposing depositors to bad debt.

### Collateral concentration risk

During Phase 1 the protocol accepts a limited set of collateral assets. High
correlation between assets in a market downturn can cause simultaneous
liquidations across many positions, amplifying the risks above.

### Borrower repayment risk

Borrowers who fail to maintain a healthy collateral ratio face liquidation.
Monitor your health factor regularly and add collateral or repay promptly if it
approaches the liquidation threshold (currently 85 %).

---

## Staking

### Smart contract risk

The `NdiFiStaking` contract has not yet been independently audited. A bug could
prevent withdrawals, miscalculate rewards, or allow an attacker to claim funds
that do not belong to them.

### Reward token supply risk

Staking rewards are paid by transferring `rewardToken` from the contract
balance. If the contract is not adequately funded, reward claims will fail.
There is no on-chain guarantee of reward continuity; the team is responsible for
maintaining sufficient reward token reserves.

### Lock-up and liquidity risk

Staked assets are subject to a **21-day withdrawal waiting period**. During
this window you cannot access your principal. If you need liquidity urgently,
you will not be able to retrieve your funds before the period expires.

### Vault share price risk

Staked assets are deposited into an ERC-4626 vault. The vault's share price can
decrease if the underlying strategy incurs losses, which would reduce the amount
of assets you receive on withdrawal.

### Known reward calculation bug

The current implementation marks a position as `withdrawn = true` before it
computes the final reward payment in `executeWithdrawal()`, which causes the
final reward to be zero. If you want to receive all rewards, call `claimRewards()`
before calling `executeWithdrawal()`. This is a known issue and will be fixed
before mainnet launch. See
[NdiFiStaking_README.md](../NdiFiStaking_README.md) for details.

---

## General / Protocol-wide

### Upgradeability risk

Core contracts in Phase 1 are **not upgradeable**. Security fixes require
deploying new contracts and migrating funds, each of which carries its own
operational risk. See [Upgradeability doc](UPGRADEABILITY.md).

### Admin key risk

Until Phase 3 (DAO governance), all privileged functions — setting the
collateral factor, authorizing contracts, pausing the protocol — are controlled
by a small number of private keys. Compromise, loss, or misuse of those keys
would have serious consequences. The team will use multi-signature wallets and a
time-lock before mainnet launch.

### Regulatory risk

The legal status of DeFi protocols varies by jurisdiction and continues to
evolve. Users are responsible for complying with laws and regulations applicable
to them. Ndi-Fi makes no representation about the legal permissibility of using
this protocol in any specific jurisdiction.

### Economic and market risk

Crypto asset prices are highly volatile. Systemic market events — flash crashes,
liquidity crises, or cross-protocol contagion — can rapidly change the risk
profile of positions and may exceed what the protocol's parameters were designed
to handle.

---

## Where these disclosures appear

This document is the canonical source. The same content must be surfaced in two
additional places before mainnet launch:

1. **App footer** — a condensed version linking back here, rendered by the
   `<ndi-footer>` component.
2. **Onboarding flow** — users must acknowledge key risks (smart contract,
   liquidation, lock-up) before making their first deposit or stake.

---

## Related docs

- [Audit readiness checklist](AUDIT_READINESS.md)
- [Oracle design](ORACLE.md)
- [Vault ERC-4626 conformance](VAULT_ERC4626.md)
- [Interest rate model](interest-rate-model.md)
- [Security policy](../SECURITY.md)
- [Roadmap](../Roadmap.md)
