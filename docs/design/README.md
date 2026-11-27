# Ndi-Fi Frontend Design System

This directory is the UI/UX design specification for the Ndi-Fi frontend. It
covers the four screens that together form the public product surface:

| Spec | Issue | What it covers |
|---|---|---|
| [01 — Landing page & protocol overview](01-landing-page.md) | #136 | Hero, feature sections, stats strip, how-it-works, responsive layout |
| [02 — Lending flow screens](02-lending-flows.md) | #137 | Deposit / withdraw / borrow / repay / liquidate, state map, health-factor & risk viz, handoff |
| [03 — Staking flow screens](03-staking-flows.md) | #138 | Stake / claim / unstake / emergency-withdraw, cooldown, penalties, rewards viz, ETH ↔ Stellar parity |
| [04 — Wallet connection states & flows](04-wallet-connection.md) | #140 | Connect states, network switch, account menu, mobile wallet patterns |
| [05 — Dark mode & WCAG AA contrast](05-dark-mode.md) | #147 | Dark-first theming, contrast audit of every colour pair per screen, no-flash theme switching |
| [06 — Onboarding & first-run experience](06-onboarding.md) | #152 | Guided tour, contextual hints, when to prompt for a wallet, borrowing risk education, skip/replay |
| [Error states & recovery guidance](../../web/components/error/README.md) | #145 | Templates for contract reverts, network and wallet errors; en/es/fr copy; `<ndi-error>` |
| [Icons & iconography guidelines](../../web/components/icon/README.md) | #146 | 46-icon SVG set, sizing/alignment/colour rules, accessibility, `<ndi-icon>` |

Specs 05–06 and the error/icon guides ship with working, tested code in
`web/` (`web/design-tokens/`, `web/theme/`, `web/components/`). For colour
values, the tokens in `web/design-tokens/` are the implemented source of truth.

These are **design specs**, not implementation. There is no frontend codebase
yet; the deliverable is wireframes, state maps, visualization specs and
handoff notes an engineer can build from. Every numeric value, error and
status referenced in the flows is grounded in the contracts in `src/` and
`stellar/contracts/`, so the handoff is buildable as written.

## Scope: two chains, one product

Ndi-Fi runs on Ethereum (Solidity, `src/`) and Stellar (Soroban,
`stellar/contracts/`). The frontend must present both as one coherent product
while respecting the differences that matter to users:

- **Lending — Ethereum** has two contracts: `NdiFiVault` (ERC-4626
  deposit/withdraw into `nzETH` shares) and `NdiFiLending` (collateralized
  borrow/repay with Chainlink price feeds, health factor and liquidation).
- **Lending — Stellar** is a single ERC-4626-style vault (`ndi_lending`) over a
  SEP-41 asset (XLM or USDC) where one owner-approved borrower draws liquidity
  at a fixed APR, raising the share price for depositors. There is no
  per-user collateralized borrow on Stellar in the MVP.
- **Staking — Ethereum** stakes Uniswap V3 NFT positions (`NdiStaking`); the
  `NdiFiStaking` variant stakes an ERC-20 into an ERC-4626 vault for a linear
  APY in NDI.
- **Staking — Stellar** stakes a SEP-41 LP token and earns NDI; unstake needs a
  cooldown, or `emergency_withdraw` forfeits pending rewards.

Designs mark chain-specific behaviour explicitly. Anything not marked is
shared and identical across chains.

## Design tokens

The protocol has no published brand. The tokens below are the **proposed**
visual language for the frontend. They are intentionally small, dark-first
(DeFi default) and high-contrast for accessibility. Pick them up verbatim in
the build; do not invent new values per screen.

### Color

| Token | Value | Use |
|---|---|---|
| `--bg-base` | `#0B0E11` | App background |
| `--bg-surface` | `#141921` | Cards, panels, inputs |
| `--bg-surface-raised` | `#1B2230` | Hover, dropdowns, modals |
| `--border-subtle` | `#232B38` | Card borders, dividers |
| `--text-primary` | `#F5F7FA` | Body copy, headings |
| `--text-secondary` | `#9AA6B2` | Labels, metadata |
| `--text-muted` | `#5C6773` | Disabled, hints |
| `--accent` | `#5B8DEF` | Primary actions, links, focus ring |
| `--accent-strong` | `#3F6FD9` | Primary button hover/press |
| `--positive` | `#2EBA8A` | Safe health factor, success, APR up |
| `--warning` | `#E8A33D` | Caution, cooldown active, near threshold |
| `--negative` | `#E5534E` | Liquidatable, error, loss |
| `--ndi` | `#A06BFF` | NDI token accent (rewards branding only) |

Semantic aliases keep screen code readable: `--health-safe` = `--positive`,
`--health-caution` = `--warning`, `--health-danger` = `--negative`.

### Typography

```
font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
font-family mono (addresses, amounts, hashes): "JetBrains Mono", ui-monospace, monospace;
```

| Style | Size / weight | Line height | Used for |
|---|---|---|---|
| Display | 48 / 700 | 1.05 | Hero headline |
| H1 | 32 / 700 | 1.15 | Page titles |
| H2 | 24 / 700 | 1.2 | Section titles |
| H3 | 18 / 600 | 1.3 | Card titles |
| Body | 16 / 400 | 1.5 | Paragraphs |
| Label | 13 / 600 | 1.2 | Field labels, tags (uppercase, letter-spacing 0.04em) |
| Mono | 14 / 500 | 1.4 | Addresses, amounts, IDs |

### Spacing, radius, elevation

4px base scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 64`. Card radius `12px`,
button/input radius `8px`, pill radius `999px`. Elevation is two steps only:
`--shadow-card` (`0 1px 0 rgba(255,255,255,0.03), 0 8px 24px rgba(0,0,0,0.35)`)
and `--shadow-modal` (same plus `0 0 0 1px var(--border-subtle)`). No drop
shadows on text.

### Motion

- State transitions (hover, focus, enabled→disabled): `120ms ease-out`.
- Modal/sheet enter: `200ms ease-out`; exit `150ms ease-in`.
- Loading shimmer: `1.2s` linear infinite, `--bg-surface` → `--bg-surface-raised`.
- Countdown/progress: animate width over the real remaining duration, never a
  fake spinner.

### Number formatting

- Native token amounts: up to 6 significant decimals, thousands separators.
- Stellar amounts: contracts work in the asset's smallest unit (XLM = 7-decimal
  stroops; USDC = 6 decimals). Show the human amount in inputs, never the raw
  smallest unit. See `02-lending-flows.md` §units.
- Health factor: render as `1.23x` (contract returns an integer where `100` =
  `1.00x` on Ethereum; Stellar has no per-user health factor).
- Percentages: one decimal. APR vs APY must never be swapped — NdiFiStaking is
  APY, `ndi_lending` and `ndi_staking` rates are APR.
- Addresses: `0x1234…abcd` truncation with full value on click (see
  `04-wallet-connection.md` §account-menu).

## Shared components

These recur across all four specs; define them once here.

- **`<AmountInput>`** — numeric input with a right-aligned asset picker, a
  "Max" button (fills `maxWithdraw` / `maxRedeem` / wallet balance as
  appropriate), and a live "≈ X.XX shares" preview underneath. Rejects
  negative, non-numeric, and values above the on-chain max.
- **`<HealthGauge>`** — semi-circular gauge, green/amber/red by threshold. See
  `02-lending-flows.md` §risk.
- **`<StatChip>`** — label + value, mono value, secondary label. Used by the
  stats strip and per-screen positions.
- **`<TxToast>`** — queued / pending / success / failed states with a link to
  the explorer (Etherscan / Stellar Expert) and a "view in wallet" action.
- **`<ChainBadge>`** — small pill showing the active chain + network, reused
  by the wallet button and every action confirm sheet.
- **`<EmptyState>`** — icon, one-line title, one-line hint, optional CTA.
- **`<ErrorState>`** — icon, plain-English cause, the raw contract code for
  power users, and a single recovery action.

## Responsiveness

Mobile-first. Breakpoints:

- `< 640px` — single column, bottom action sheet replaces modals, hero stacks
  vertically, stats strip becomes a 2×2 grid.
- `640–1024px` — two-column where it helps, hero side-by-side.
- `> 1024px` — full desktop grid; max content width `1200px`, centred.

Every wireframe below ships a desktop and a mobile variant. Touch targets
`≥ 44px`. No hover-dependent affordances on `< 1024px` — always pair hover
states with a visible control.

## Accessibility (applies to all four specs)

- All color pairs meet WCAG AA at the sizes above (verified for
  `--text-primary`/`--bg-base`, `--text-secondary`/`--bg-surface`, and the
  semantic health colors against their surfaces).
- Every interactive element is reachable and operable by keyboard; the visible
  focus ring is `2px` `--accent` with `2px` offset.
- Loading, success and error states are conveyed by text and icon, **not** by
  color alone (e.g. a green checkmark with the word "Confirmed", a red ⚠ with
  the error message).
- Live regions (`aria-live="polite"`) on amounts, health factor, countdowns
  and tx toasts so screen readers announce state changes.
- Motion respects `prefers-reduced-motion`: shimmer and progress animations
  become static, countdowns show the remaining number only.

## How to use these specs to build

1. Implement the tokens and shared components above first.
2. Build wallet connection (#140) — every other screen depends on it.
3. Build the landing page (#136) — it links into lending and staking.
4. Build lending (#137) and staking (#138) positions; they share the same
   "position card" skeleton and the same state map vocabulary.
5. Wire each action to the exact contract calls listed in the **Handoff**
   section of its spec.

## Status

Design draft for review. Open questions are flagged inline with **Q:**.
Acceptance criteria for each issue are reproduced at the end of its spec with
checkboxes.
