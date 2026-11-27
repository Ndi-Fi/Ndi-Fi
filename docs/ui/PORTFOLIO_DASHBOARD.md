# Portfolio Dashboard Layout

> Closes #139

## Overview

The portfolio dashboard is the main landing screen for authenticated users. It aggregates a user's lending deposits, active loans, staked positions, and pending rewards into a single view. The goal is to give users immediate situational awareness of their financial position without requiring them to navigate between sections.

---

## Layout Structure

The dashboard uses a two-column grid on desktop (≥ 1280 px), a single-column stacked layout on tablet (768–1279 px), and a single-column layout on mobile (< 768 px).

```
┌─────────────────────────────────────────────────────┐
│  Net Worth Summary Bar                              │
│  Total value (USD) · Net APY · Chain selector       │
├──────────────────────────┬──────────────────────────┤
│  Deposits section        │  Loans section           │
│  (card list / table)     │  (card list / table)     │
├──────────────────────────┼──────────────────────────┤
│  Stakes section          │  Rewards section         │
│  (card list / table)     │  (claimable list)        │
└──────────────────────────┴──────────────────────────┘
```

On tablet and mobile both columns collapse to a single column, stacked in the order: Summary → Deposits → Loans → Stakes → Rewards.

---

## Section Specifications

### Net Worth Summary Bar

- Displays the user's **total portfolio value in USD**, calculated as:
  `deposits + staked value + pending rewards − outstanding loan value`
- Shows a **Net APY** figure: the blended yield across all deposits and stakes minus borrow costs.
- A **chain selector** (dropdown or pill group) filters the view to one chain or shows all chains combined.
- Sticky at the top of the scrollable content area on desktop.

### Deposits Section

Each deposit is shown as a **card** (see Cards vs Tables below) containing:

| Field | Detail |
|---|---|
| Asset | Token symbol and icon |
| Supplied | Token amount + USD equivalent |
| APY | Current supply APY |
| Collateral | Toggle indicator (on/off) |
| Actions | Withdraw, Supply More |

### Loans Section

Each active loan is shown as a card containing:

| Field | Detail |
|---|---|
| Asset | Token symbol and icon |
| Borrowed | Token amount + USD equivalent |
| APY | Current borrow APY |
| Health Factor | Mini gauge (see [Health Factor Design](./HEALTH_FACTOR.md)) |
| Actions | Repay, Borrow More |

### Stakes Section

Each staked position is shown as a card containing:

| Field | Detail |
|---|---|
| LP Token | Token pair and icon |
| Staked Amount | Token amount + USD equivalent |
| Reward Rate | NDI per day estimate |
| Unlock Date | Cooldown end date, or "Available now" |
| Actions | Unstake, Add Stake |

### Rewards Section

Lists claimable reward tokens, one row per token:

| Field | Detail |
|---|---|
| Token | NDI (or other reward token) |
| Claimable | Token amount + USD equivalent |
| Source | Staking pool name |
| Action | Claim button |

A **Claim All** button at the top of the section batches all pending claims into one transaction.

---

## Cards vs Tables Decision

| Breakpoint | Deposits | Loans | Stakes | Rewards |
|---|---|---|---|---|
| Desktop (≥ 1280 px) | Table | Table | Table | Table |
| Tablet (768–1279 px) | Cards | Cards | Cards | List rows |
| Mobile (< 768 px) | Cards | Cards | Cards | List rows |

**Rationale:** Tables are more scannable when multiple columns are visible. On narrower viewports, cards stack fields vertically without horizontal scrolling. The switch happens at 768 px. Tables must remain horizontally scrollable if the viewport is resized below their natural minimum width.

---

## USD Totals and Per-Chain Grouping

- All USD values use the asset's price feed at the time of the last page load, with a staleness indicator if the price is older than 60 seconds.
- When **All Chains** is selected, sections group positions by chain with a subtle chain label header above each group:
  ```
  ── Ethereum ──────────────────
  [card] [card]
  ── Stellar ───────────────────
  [card]
  ```
- Cross-chain totals in the summary bar are summed in USD regardless of chain.
- Chain-specific positions that share the same underlying asset (e.g., USDC on Ethereum and USDC on Stellar) are listed separately, not merged.

---

## Empty-State and First-Visit Designs

### First-Visit (no positions)

Display a full-width onboarding panel in place of the section grids:

```
┌───────────────────────────────────────────┐
│  [Illustration: abstract vault/wallet]    │
│                                           │
│  Your portfolio is empty                  │
│  Start by supplying assets to earn yield  │
│  or stake LP tokens for NDI rewards.      │
│                                           │
│  [Supply Assets]   [Stake LP Tokens]      │
└───────────────────────────────────────────┘
```

- The illustration is decorative and has `aria-hidden="true"`.
- The two CTAs link to the Supply and Stake flows respectively.

### Per-Section Empty States

When a user has activity in some sections but not others, each empty section shows an inline prompt:

| Section | Message | CTA |
|---|---|---|
| Deposits | "No deposits yet" | Supply Assets |
| Loans | "No active loans" | Borrow |
| Stakes | "No staked positions" | Stake LP Tokens |
| Rewards | "No rewards to claim" | — |

The Rewards section with no claimable rewards does not show a CTA. It shows only the message and suppresses the Claim All button.

---

## Responsive Behaviour

- The summary bar is always full-width.
- On desktop the two-column grid uses `gap: 24px` and equal column widths.
- On tablet and mobile the sections stack with `gap: 16px`.
- Cards within a section use a 1-column layout on mobile and a 2-column wrap on tablet when space allows (min card width 280 px).
- Table rows are keyboard-navigable; action buttons within rows are reachable by Tab and activated by Enter/Space.

---

## Accessibility

- All section headings use `<h2>` elements so screen-reader users can jump between sections.
- USD values include a visually hidden label, e.g., `<span class="sr-only">USD equivalent: </span>$1,234.56`.
- Color is not the sole indicator for any state; icons and text labels accompany color-coded elements (health factor uses both color and a text label).
- The chain selector announces the selected chain to assistive technology via `aria-live="polite"` on the summary bar.
- Focus management: when the chain filter changes, focus remains on the selector and the updated content is announced via a live region rather than a focus jump.
