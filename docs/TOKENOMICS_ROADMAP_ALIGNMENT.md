# Ndi-Fi: Tokenomics & Roadmap Alignment

This document explains how the NDI token design and the economic parameters
in the smart contracts connect to each phase of the project roadmap. It is
intended for contributors, investors, and community members who want to
understand how the token incentives evolve as the protocol matures.

For the full tokenomics breakdown see `Tokenomics.md`. For the full roadmap
see `Roadmap.md`.

---

## 1. Token supply overview

| Parameter | Value | Source |
|---|---|---|
| Max supply (`MAX_SUPPLY`) | 1,000,000,000 NDI | `NdiPoint.sol` constant |
| Initial mint | 100,000,000 NDI (10%) | Minted to deployer on construction |
| Reserved for distribution | 900,000,000 NDI (90%) | Released only via `MINTER_ROLE` / `REWARD_DISTRIBUTOR_ROLE` |

The initial 10% mint gives the protocol treasury enough tokens for early
liquidity mining and partner incentives without pre-selling the full supply.
The remaining 90% stays locked until an authorised address (the protocol's
reward distributor) releases it through `mint` or `distributeRewards`.

---

## 2. Phase-by-phase alignment

### Phase 1 — Foundation & Mainnet Launch (Q4 2025)

**Roadmap goals:** security audits, mainnet deploy, dApp v1, liquidity mining,
documentation.

**Tokenomics levers active in this phase:**

| Lever | Contract | Purpose |
|---|---|---|
| `apy` | `NdiFiStaking` | Attract early stakers with a competitive yield target. |
| `stakingCap` | `NdiFiVault` | Limit TVL during the bootstrapping period to cap protocol risk while trust builds. |
| `originationFeeRate` | `NdiFiLending` | Small fee (suggested ≤ 50 bps) reduces friction for first borrowers. |
| `distributeRewards` | `NdiPoint` | Fund the liquidity mining program by distributing NDI to vault depositors and borrowers. |

**Token distribution in Phase 1:**
The liquidity mining program draws from the reserved 90% supply. Rewards are
sized to cover the target `apy` for stakers plus an additional NDI bonus for
borrowers, keeping the borrowing demand necessary to generate real yield.

**Key risk in this phase:**
If borrowing demand is too low, the vault yield falls below the staked `apy`
target, and the gap must be covered by NDI token emissions. Excessive emissions
in Phase 1 increase sell pressure. The `stakingCap` limits this exposure by
capping the total reward liability.

---

### Phase 2 — Ecosystem Expansion & Feature Growth (Q1–Q2 2026)

**Roadmap goals:** multi-collateral lending, dynamic interest rates, advanced
vault strategies, L2 deployment.

**Tokenomics levers that come online:**

| New feature | Economic effect |
|---|---|
| Multi-collateral lending | More borrowing demand → higher vault yield → stakers earn more from real yield and need fewer NDI subsidies. |
| Dynamic interest rate model | Interest rate rises with utilisation, which increases vault yield proportionally and reduces the protocol's reliance on NDI emissions to satisfy the `apy` target. |
| Advanced vault strategies | Vault can seek yield from external protocols, further reducing the NDI emission rate needed to maintain competitive returns. |
| L2 deployment | Lower transaction costs make small-value staking and borrowing economical, broadening the user base and distributing NDI rewards more widely. |

**Parameter adjustments expected in this phase:**
- `originationFeeRate` can be raised modestly as the lending market deepens.
- `collateralFactor` can be widened for high-quality, liquid collateral types.
- `apy` target may be reduced as organic vault yield compensates more of the return.

---

### Phase 3 — Decentralisation & Community Governance (Q3–Q4 2026)

**Roadmap goals:** governance portal, Ndi-Fi DAO, ownership transfer, community
treasury, first governance proposals.

**Tokenomics role of NDI shifts from incentive to governance:**

| Activity | Before Phase 3 | After Phase 3 |
|---|---|---|
| Adjusting `collateralFactor` | Owner transaction | DAO vote |
| Adjusting `apy` | Owner transaction | DAO vote |
| Adjusting `liquidationPenalty` | Owner transaction | DAO vote |
| Directing treasury revenue | Owner decision | DAO proposal |
| Minting new NDI | Owner / `MINTER_ROLE` | DAO-controlled contract |

This transition means NDI holders who stake their tokens for voting power have a
direct stake in every economic parameter. The protocol's revenue (origination
fees, excess vault yield) flows to a DAO-controlled treasury, which the community
can direct toward buybacks, grants, or further incentives.

**Token unlock schedule alignment:**
Phase 3 is the natural time to begin unlocking a portion of the reserved 90%
supply for governance participants, because governance creates a utility sink
(locked NDI for voting) that offsets sell pressure from new emissions.

---

### Phase 4 — Long-Term Vision & Self-Sustainment (2027+)

**Roadmap goals:** real-world asset (RWA) collateral, ecosystem grants, under-
collateralised lending, continuous DAO innovation.

**Tokenomics in a mature protocol:**

| Goal | Tokenomics mechanism |
|---|---|
| RWA collateral | New collateral types require DAO approval and new Chainlink (or Reflector, on Stellar) price feeds. Each new type expands the borrowing base and vault yield. |
| Ecosystem grants | DAO treasury distributes NDI to builders creating protocol extensions. This redirects inflation toward ecosystem growth rather than pure user incentives. |
| Under-collateralised lending | Identity/reputation scores could earn borrowers better `collateralFactor` terms, increasing borrowing demand without proportionally increasing collateral lock-up. |
| Buybacks | If treasury revenue exceeds grant and operational needs, the DAO can vote to buy NDI from the open market and burn it, reducing the circulating supply and rewarding long-term holders. |

---

## 3. Economic flywheel and NDI emission rate

The flywheel is healthy when organic vault yield (from real borrowing demand)
covers most or all of the staking `apy`, so the NDI emission rate can remain low.

```
NDI rewards ──▶ Attract stakers ──▶ TVL grows ──▶ Borrowers have liquidity
     ▲                                                        │
     │                                                        ▼
NDI emission     ◀── Reduce emissions ◀── Fees + yield ◀── Borrowers pay fees
     │
     └── If flywheel stalls: raise apy or increase emissions temporarily
```

**Emission rate milestones by phase:**

| Phase | Expected NDI emission rate | Why |
|---|---|---|
| 1 (bootstrap) | High — supplementing thin organic yield | Attracting first liquidity |
| 2 (expansion) | Declining — organic yield growing | More borrowers, better strategies |
| 3 (DAO) | Low — DAO-managed, demand-based | Governance utility absorbs supply |
| 4 (mature) | Minimal or deflationary | Buybacks + grants replace incentive emissions |

---

## 4. Contract parameters and their roadmap alignment

The table below maps each configurable parameter to the roadmap phase where it
is primarily relevant, and identifies who controls it.

| Parameter | Contract | Phase | Controller | Notes |
|---|---|---|---|---|
| `apy` | `NdiFiStaking` | 1–2 | Owner → DAO (Phase 3) | Primary lever for attracting stakers. |
| `minStake` / `maxStake` | `NdiFiStaking` | 1–3 | Owner → DAO | Concentration limits. |
| `WITHDRAW_WAIT` (21 days) | `NdiFiStaking` | All | Hardcoded | Protects TVL stability; not adjustable on-chain. |
| `stakingCap` | `NdiFiVault` | 1–2 | Owner → DAO | Risk ceiling on TVL. |
| `collateralFactor` | `NdiFiLending` | 2–4 | Owner → DAO | Capital efficiency vs. risk. |
| `liquidationThreshold` | `NdiFiLending` | 2–4 | Owner → DAO | Buffer between borrow limit and liquidation. |
| `originationFeeRate` | `NdiFiLending` | 1–4 | Owner → DAO | Direct revenue lever. |
| `liquidationPenalty` | `NdiFiLending` | 2–4 | Owner → DAO | Incentivises third-party liquidators. |

---

## 5. Stellar/Soroban alignment

The Soroban contracts in `stellar/` follow the same economic model but with
platform-specific adjustments:

| Economic concept | Ethereum parameter | Stellar parameter |
|---|---|---|
| Staking yield | `apy` (percentage) | `reward_rate` (scaled ×1e7) |
| Lending APR | None in Solidity | `interest_rate` (scaled ×1e7) |
| Vault cap | `stakingCap` | `deposit_cap` |
| Withdrawal delay | `WITHDRAW_WAIT` (21 days hardcoded) | `cooldown` (constructor argument) |
| Token supply cap | `MAX_SUPPLY` (1B, 18 decimals) | `cap` (1B × 10^7, 7 decimals) |

The Stellar version fixes several economic bugs in the Solidity contracts
(documented in `docs/stellar/MIGRATION.md §4`), most importantly:

- **Interest model:** `ndi_lending` tracks outstanding debt separately from the
  vault balance, so the share price stays fair when funds are lent out. Solidity
  depositors bear the full cost of loans.
- **Staking principal isolation:** `ndi_staking` fixes the shared-shares bug
  where the first withdrawer could drain all stakers' principals.

---

## 6. Summary

The NDI token serves three distinct functions across the roadmap:

1. **Incentive token (Phases 1–2):** High emission rate bootstraps liquidity and
   borrowing demand.
2. **Governance token (Phase 3):** NDI holders vote on every economic parameter
   and direct the treasury.
3. **Value-accrual token (Phase 4):** Buybacks, grants, and RWA integration
   make holding NDI economically attractive independently of yield incentives.

The contract parameters (`apy`, `collateralFactor`, `originationFeeRate`, etc.)
are the dials the protocol turns to execute this progression. In Phases 1–2 the
founding team controls them; from Phase 3 onward the DAO takes over.
